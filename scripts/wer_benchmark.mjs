import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Paired Multilingual WER & Acoustic Filtering Benchmark for L-easy
 * ------------------------------------------------------------------
 * Evaluates identical raw 16-bit PCM recordings across:
 *   - Conditions: Raw (HPF OFF) vs. 2nd-Order 120 Hz Butterworth Biquad (HPF ON)
 *   - Backends: Google Gemini 2.5 Flash (L-easy /api/transcribe prompt) vs. OpenAI/Local Whisper
 *   - Metrics: Broadband RMS (dBFS), Broadband SNR (dB), WER (%), CER (%)
 *
 * Usage:
 *   node scripts/wer_benchmark.mjs --dry-run
 *   node scripts/wer_benchmark.mjs benchmarks/manifest.json [--raw-rate 24000] [--whisper-cmd whisper]
 */

function loadEnvFile(envPath = ".env") {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

/**
 * Decode standard RIFF/WAVE 16-bit PCM (or 32-bit IEEE float) into mono Float64Array [-1, 1].
 * Falls back cleanly to headerless signed 16-bit LE mono PCM when RIFF header is absent.
 */
export function decodeWavOrRawPcm(buffer, rawFallbackRate = 24000) {
  const isRiff =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE";

  if (!isRiff) {
    const sampleCount = Math.floor(buffer.length / 2);
    const samples = new Float64Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
    }
    return {
      format: "raw-pcm-s16le",
      sampleRate: rawFallbackRate,
      channels: 1,
      bitsPerSample: 16,
      samples,
    };
  }

  let offset = 12;
  let audioFormat = 1;
  let channels = 1;
  let sampleRate = 48000;
  let bitsPerSample = 16;
  let dataStart = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === "fmt " && chunkDataStart + 16 <= buffer.length) {
      audioFormat = buffer.readUInt16LE(chunkDataStart);
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === "data") {
      dataStart = chunkDataStart;
      dataSize = Math.min(chunkSize, buffer.length - chunkDataStart);
      break;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataStart === -1) {
    throw new Error("Invalid RIFF/WAVE file: missing 'data' chunk.");
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameSize = channels * bytesPerSample;
  const frameCount = Math.floor(dataSize / frameSize);
  const samples = new Float64Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let monoSum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const pos = dataStart + i * frameSize + ch * bytesPerSample;
      let val = 0;
      if (audioFormat === 1 && bitsPerSample === 16) {
        val = buffer.readInt16LE(pos) / 32768.0;
      } else if (audioFormat === 3 && bitsPerSample === 32) {
        val = buffer.readFloatLE(pos);
      } else if (audioFormat === 1 && bitsPerSample === 8) {
        val = (buffer.readUInt8(pos) - 128) / 128.0;
      } else {
        throw new Error(`Unsupported WAV encoding: format=${audioFormat}, bits=${bitsPerSample}`);
      }
      monoSum += val;
    }
    samples[i] = monoSum / channels;
  }

  return {
    format: "riff-wave",
    sampleRate,
    channels,
    bitsPerSample,
    samples,
  };
}

/**
 * Encode mono Float64Array [-1, 1] into a standard 16-bit PCM RIFF/WAVE Buffer.
 */
export function encodeWavPcm16(samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // PCM fmt chunk size
  buf.writeUInt16LE(1, 20);  // audioFormat = 1 (PCM)
  buf.writeUInt16LE(1, 22);  // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);  // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, int16)), 44 + i * 2);
  }
  return buf;
}

/**
 * Exact 2nd-order Butterworth High-Pass Biquad Filter (Audio EQ Cookbook).
 * Matches Web Audio BiquadFilterNode { type: "highpass", frequency: 120, Q: 0.707 }.
 */
export function applyHighPassBiquad(samples, sampleRate, cutoffHz = 120, q = 0.707) {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * q);

  const b0 = (1 + cosW0) / 2;
  const b1 = -(1 + cosW0);
  const b2 = (1 + cosW0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;

  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  const out = new Float64Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < samples.length; n++) {
    const x0 = samples[n];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    out[n] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

/**
 * Compute broadband RMS level (dBFS), sub-120 Hz energy share, and broadband SNR (dB) across 20 ms frames
 * using 10th-percentile frame energy (noise floor) vs. 90th-percentile frame energy (active speech).
 */
export function computeAcousticMetrics(samples, sampleRate, filteredSamples = null) {
  if (!samples.length) {
    return { rmsDbfs: -96, noiseFloorDbfs: -96, speechPeakDbfs: -96, broadbandSnrDb: 0, sub120HzPct: 0 };
  }

  let totalSq = 0;
  for (let i = 0; i < samples.length; i++) totalSq += samples[i] * samples[i];
  const meanPow = totalSq / samples.length;
  const rms = Math.sqrt(meanPow);
  const rmsDbfs = 20 * Math.log10(Math.max(1e-5, rms));

  let sub120HzPct = 0;
  if (filteredSamples && filteredSamples.length === samples.length && meanPow > 0) {
    let filtSq = 0;
    for (let i = 0; i < filteredSamples.length; i++) filtSq += filteredSamples[i] * filteredSamples[i];
    const filtPow = filtSq / filteredSamples.length;
    sub120HzPct = Math.max(0, ((meanPow - filtPow) / meanPow) * 100);
  }

  const frameLen = Math.max(1, Math.round(sampleRate * 0.02));
  const framePowers = [];
  for (let start = 0; start + frameLen <= samples.length; start += frameLen) {
    let fp = 0;
    for (let j = 0; j < frameLen; j++) {
      const v = samples[start + j];
      fp += v * v;
    }
    framePowers.push(fp / frameLen);
  }
  if (framePowers.length === 0) framePowers.push(meanPow);

  framePowers.sort((a, b) => a - b);
  const p10 = framePowers[Math.floor((framePowers.length - 1) * 0.1)];
  const p90 = framePowers[Math.floor((framePowers.length - 1) * 0.9)];

  const noiseFloorDbfs = 10 * Math.log10(Math.max(1e-10, p10));
  const speechPeakDbfs = 10 * Math.log10(Math.max(1e-10, p90));
  const broadbandSnrDb = Math.max(0, 10 * Math.log10(Math.max(1e-10, p90) / Math.max(1e-10, p10)));

  return {
    rmsDbfs: Number(rmsDbfs.toFixed(2)),
    noiseFloorDbfs: Number(noiseFloorDbfs.toFixed(2)),
    speechPeakDbfs: Number(speechPeakDbfs.toFixed(2)),
    broadbandSnrDb: Number(broadbandSnrDb.toFixed(2)),
    sub120HzPct: Number(sub120HzPct.toFixed(2)),
  };
}

function intToEnglishWords(numStr) {
  const n = Number(numStr);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return numStr;
  if (n >= 1900 && n <= 2099) {
    const hi = Math.floor(n / 100);
    const lo = n % 100;
    const hiW = intToEnglishWords(String(hi));
    if (lo === 0) return `${hiW} hundred`;
    if (lo < 10) return `${hiW} oh ${intToEnglishWords(String(lo))}`;
    return `${hiW} ${intToEnglishWords(String(lo))}`;
  }
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + intToEnglishWords(String(n % 100)) : "");
  if (n < 1_000_000) return intToEnglishWords(String(Math.floor(n / 1000))) + " thousand" + (n % 1000 ? " " + intToEnglishWords(String(n % 1000)) : "");
  if (n < 1_000_000_000) return intToEnglishWords(String(Math.floor(n / 1_000_000))) + " million" + (n % 1_000_000 ? " " + intToEnglishWords(String(n % 1_000_000)) : "");
  return intToEnglishWords(String(Math.floor(n / 1_000_000_000))) + " billion" + (n % 1_000_000_000 ? " " + intToEnglishWords(String(n % 1_000_000_000)) : "");
}

/**
 * Unicode-safe text normalization preserving Latin, Cyrillic, Kazakh letters, and digits,
 * plus fair normalization of English numerals (e.g., 85% -> eighty five percent, 1941 -> nineteen forty one)
 * and common compound forms (alma ata, frontline, wartime).
 */
export function normalizeText(text, language = "English") {
  let s = String(text ?? "").normalize("NFC").toLowerCase();
  if (language === "English") {
    s = s
      .replace(/(\d),(\d{3})\b/g, "$1$2")
      .replace(/(\d)\.(\d+)/g, "$1 point $2")
      .replace(/%/g, " percent ")
      .replace(/\bworld war\s+ii\b/g, "world war two")
      .replace(/\b316th\b/g, "three hundred sixteenth")
      .replace(/\b310th\b/g, "three hundred tenth")
      .replace(/\b8th\b/g, "eighth")
      .replace(/\bfrontline\b/g, "front line")
      .replace(/\bwartime\b/g, "war time")
      .replace(/\balma-?ata\b/g, "alma ata")
      .replace(/\bkaraganda\b/g, "karaganda")
      .replace(/(\d+)/g, (_, d) => ` ${intToEnglishWords(d)} `);
  } else if (language === "Russian") {
    s = s.replace(/ё/g, "е");
  }

  return s
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinCounts(refItems, hypItems) {
  const n = refItems.length;
  const m = hypItems.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  const op = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 0=match/sub, 1=del, 2=ins

  for (let i = 1; i <= n; i++) {
    dp[i][0] = i;
    op[i][0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = j;
    op[0][j] = 2;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refItems[i - 1] === hypItems[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        op[i][j] = 0;
      } else {
        const sub = dp[i - 1][j - 1] + 1;
        const del = dp[i - 1][j] + 1;
        const ins = dp[i][j - 1] + 1;
        if (sub <= del && sub <= ins) {
          dp[i][j] = sub;
          op[i][j] = 0;
        } else if (del <= ins) {
          dp[i][j] = del;
          op[i][j] = 1;
        } else {
          dp[i][j] = ins;
          op[i][j] = 2;
        }
      }
    }
  }

  let subs = 0, dels = 0, ins = 0;
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && op[i][j] === 0) {
      if (refItems[i - 1] !== hypItems[j - 1]) subs++;
      i--;
      j--;
    } else if (i > 0 && (j === 0 || op[i][j] === 1)) {
      dels++;
      i--;
    } else {
      ins++;
      j--;
    }
  }
  return { subs, dels, ins, distance: dp[n][m], refLen: n };
}

export function computeWerCer(reference, hypothesis, language = "English") {
  const refNorm = normalizeText(reference, language);
  const hypNorm = normalizeText(hypothesis, language);
  const refWords = refNorm ? refNorm.split(" ") : [];
  const hypWords = hypNorm ? hypNorm.split(" ") : [];

  const w = levenshteinCounts(refWords, hypWords);
  const werPct = w.refLen > 0 ? (w.distance / w.refLen) * 100 : 0;

  const refChars = Array.from(refNorm.replace(/\s+/g, ""));
  const hypChars = Array.from(hypNorm.replace(/\s+/g, ""));
  const c = levenshteinCounts(refChars, hypChars);
  const cerPct = c.refLen > 0 ? (c.distance / c.refLen) * 100 : 0;

  return {
    werPct: Number(werPct.toFixed(2)),
    cerPct: Number(cerPct.toFixed(2)),
    subs: w.subs,
    dels: w.dels,
    ins: w.ins,
    distance: w.distance,
    refWords: w.refLen,
  };
}

export function meanAndSampleSd(values) {
  if (!values.length) return { mean: null, sd: null };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length < 2) return { mean: Number(mean.toFixed(2)), sd: 0 };
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return { mean: Number(mean.toFixed(2)), sd: Number(Math.sqrt(variance).toFixed(2)) };
}

function erfcApprox(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? ans : 2 - ans;
}

function binomialComb(n, k) {
  if (k < 0 || k > n) return 0;
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = (res * (n - i + 1)) / i;
  }
  return res;
}

/**
 * Paired two-sided Wilcoxon signed-rank test + exact binomial sign test.
 * Convention: d_i = hpf_i - raw_i (d_i < 0 indicates HPF improved / lowered error).
 */
export function wilcoxonSignedRank(rawValues, hpfValues) {
  if (rawValues.length !== hpfValues.length) {
    throw new Error("wilcoxonSignedRank: paired arrays must have equal length");
  }
  let improved = 0;
  let worsened = 0;
  let tied = 0;
  const nonzero = [];

  for (let i = 0; i < rawValues.length; i++) {
    const diff = Number((hpfValues[i] - rawValues[i]).toFixed(6));
    if (Math.abs(diff) <= 1e-9) {
      tied++;
    } else {
      if (diff < 0) improved++;
      else worsened++;
      nonzero.push({ diff, abs: Math.abs(diff) });
    }
  }

  const m = improved + worsened;
  let signTestP = 1;
  if (m > 0) {
    const kMin = Math.min(improved, worsened);
    let tail = 0;
    for (let i = 0; i <= kMin; i++) tail += binomialComb(m, i);
    signTestP = Math.min(1, Number((2 * tail * Math.pow(0.5, m)).toFixed(4)));
  }

  const nEff = nonzero.length;
  if (nEff === 0) {
    return {
      nTotal: rawValues.length,
      nEff: 0,
      improved,
      worsened,
      tied,
      wPlus: 0,
      wMinus: 0,
      wStat: 0,
      z: 0,
      pValue: 1,
      pValueExact: 1,
      pValueApprox: 1,
      method: "exact_twosided",
      zeroHandling: "wilcoxon_exclude_zeros",
      signTestP,
    };
  }

  nonzero.sort((a, b) => a.abs - b.abs);
  const ranks = new Array(nEff);
  let wPlus = 0;
  let wMinus = 0;
  let tieCorrection = 0;
  let idx = 0;
  while (idx < nEff) {
    let end = idx + 1;
    while (end < nEff && Math.abs(nonzero[end].abs - nonzero[idx].abs) <= 1e-9) end++;
    const t = end - idx;
    if (t > 1) tieCorrection += t * (t * t - 1);
    const avgRank = (idx + 1 + end) / 2;
    for (let r = idx; r < end; r++) {
      ranks[r] = avgRank;
      if (nonzero[r].diff > 0) wPlus += avgRank;
      else wMinus += avgRank;
    }
    idx = end;
  }

  const wStat = Math.min(wPlus, wMinus);
  const meanW = (nEff * (nEff + 1)) / 4;
  const varW = (nEff * (nEff + 1) * (2 * nEff + 1) - 0.5 * tieCorrection) / 24;
  const z = varW > 0 ? (wStat - meanW) / Math.sqrt(varW) : 0;
  const pApprox = varW > 0 ? Math.min(1, Math.max(0, erfcApprox(Math.abs(z) / Math.SQRT2))) : 1;

  let pExact = null;
  if (nEff <= 20) {
    const totalRankSum = wPlus + wMinus;
    const totalMasks = 1 << nEff;
    let extremeCount = 0;
    for (let mask = 0; mask < totalMasks; mask++) {
      let sPlus = 0;
      for (let i = 0; i < nEff; i++) {
        if ((mask & (1 << i)) !== 0) sPlus += ranks[i];
      }
      const sMin = Math.min(sPlus, totalRankSum - sPlus);
      if (sMin <= wStat + 1e-9) extremeCount++;
    }
    pExact = Math.min(1, extremeCount / totalMasks);
  }

  const primaryP = pExact !== null ? pExact : pApprox;
  return {
    nTotal: rawValues.length,
    nEff,
    improved,
    worsened,
    tied,
    wPlus: Number(wPlus.toFixed(2)),
    wMinus: Number(wMinus.toFixed(2)),
    wStat: Number(wStat.toFixed(2)),
    z: Number(z.toFixed(3)),
    pValue: Number(primaryP.toFixed(4)),
    pValueExact: pExact !== null ? Number(pExact.toFixed(4)) : null,
    pValueApprox: Number(pApprox.toFixed(4)),
    method: pExact !== null ? "exact_twosided" : "asymptotic_normal",
    zeroHandling: "wilcoxon_exclude_zeros",
    signTestP,
  };
}

async function transcribeWithGemini(wavBuffer, language, expectedWords = 0, initialTemperature = null, { strictModel = false } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { skipped: true, reason: "missing GEMINI_API_KEY" };

  const prompt =
    `Transcribe this entire audio recording verbatim from the very beginning (0:00) to the very end. ` +
    `The spoken language is ${language}. ` +
    `The recording may contain multiple consecutive sentences or speaker turns separated by brief pauses; ` +
    `do NOT stop after the first sentence, pause, or speaker—transcribe every single spoken sentence until the audio file finishes. ` +
    `Return only the spoken words without timestamps, speaker labels, or commentary.`;

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const models = strictModel
    ? [primaryModel]
    : Array.from(
        new Set([
          primaryModel,
          "gemini-3.5-flash-lite",
          "gemini-3.5-flash",
          "gemini-3.8-flash",
          "gemini-2.5-flash",
        ].filter(Boolean)),
      );

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const minWordsThreshold = expectedWords > 0 ? Math.floor(expectedWords * 0.55) : 0;
  const maxAttempts = strictModel ? 5 : 3;
  let lastErr = "";
  for (const model of models) {
    let bestFallback = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const baseTemp = initialTemperature !== null ? initialTemperature : 0.15;
      const temperature = Number(Math.min(0.7, baseTemp + attempt * 0.15).toFixed(2));
      let res;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            signal: AbortSignal.timeout(65_000),
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { inlineData: { mimeType: "audio/wav", data: wavBuffer.toString("base64") } },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: { temperature },
            }),
          },
        );
      } catch (err) {
        const causeDetail = err?.cause ? ` (${err.cause.code || ""} ${err.cause.message || err.cause})` : "";
        lastErr = `Gemini fetch error (${model}, attempt ${attempt + 1}): ${err?.name || "Error"} ${err?.message || err}${causeDetail}`;
        console.warn(`  [Gemini retry] ${lastErr}`);
        if (attempt + 1 < maxAttempts) {
          await sleep(strictModel ? 3000 * (attempt + 1) : 2500);
          continue;
        }
        break;
      }
      if (res.ok) {
        const data = await res.json();
        const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
        const normWordCount = normalizeText(text, language).split(" ").filter(Boolean).length;
        if (!bestFallback || normWordCount > bestFallback.normWordCount) {
          bestFallback = { skipped: false, model, text, normWordCount };
        }
        if (minWordsThreshold > 0 && normWordCount < minWordsThreshold && attempt + 1 < maxAttempts) {
          console.warn(
            `  [Gemini early-EOS guard] ${model} attempt ${attempt + 1} returned ${normWordCount}/${expectedWords} words (<${minWordsThreshold}); retrying...`,
          );
          await sleep(1000);
          continue;
        }
        return { skipped: false, model: bestFallback.model, text: bestFallback.text, normWordCount: bestFallback.normWordCount };
      }
      const errBody = await res.text();
      lastErr = `Gemini API HTTP ${res.status} (${model}): ${errBody.slice(0, 220)}`;
      if ((res.status === 429 || res.status === 503 || res.status >= 500) && attempt + 1 < maxAttempts) {
        await sleep(strictModel ? 3000 * (attempt + 1) : 1500);
        continue;
      }
      if (res.status === 404 || res.status === 503 || res.status === 429) {
        break;
      }
      throw new Error(lastErr);
    }
    if (bestFallback && bestFallback.normWordCount > 0) {
      return { skipped: false, model: bestFallback.model, text: bestFallback.text, normWordCount: bestFallback.normWordCount };
    }
  }
  throw new Error(lastErr || "No Gemini candidate model succeeded");
}

const localWhisperPipelines = new Map();

function resampleTo16k(samples, fromRate) {
  const targetRate = 16000;
  if (fromRate === targetRate) return Float32Array.from(samples);
  if (fromRate === 48000) {
    const outLen = Math.floor(samples.length / 3);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * 3;
      out[i] = (samples[idx] + samples[idx + 1] + samples[idx + 2]) / 3;
    }
    return out;
  }
  const ratio = fromRate / targetRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = pos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

async function getLocalWhisperPipeline(modelId = "Xenova/whisper-base") {
  if (!localWhisperPipelines.has(modelId)) {
    const p = (async () => {
      const modUrl = new URL("../benchmarks/tools/node_modules/@huggingface/transformers/dist/transformers.node.mjs", import.meta.url);
      const { pipeline } = await import(modUrl.href);
      return pipeline("automatic-speech-recognition", modelId);
    })();
    localWhisperPipelines.set(modelId, p);
  }
  return localWhisperPipelines.get(modelId);
}

async function disposeLocalWhisperPipeline(modelId) {
  if (!localWhisperPipelines.has(modelId)) return;
  try {
    const inst = await localWhisperPipelines.get(modelId);
    if (inst && typeof inst.dispose === "function") await inst.dispose();
  } catch {}
  localWhisperPipelines.delete(modelId);
}

async function transcribeWithWhisper(wavPath, wavBuffer, samples, sampleRate, language, whisperCmd, useLocalWhisper, localModelId = "Xenova/whisper-base") {
  const langCode = language === "Kazakh" ? "kk" : language === "Russian" ? "ru" : "en";
  const whisperLangName = language === "Kazakh" ? "kazakh" : language === "Russian" ? "russian" : "english";
  const openAiKey = process.env.OPENAI_API_KEY;

  if (useLocalWhisper) {
    const transcriber = await getLocalWhisperPipeline(localModelId);
    const audio16k = resampleTo16k(samples, sampleRate);
    const out = await transcriber(audio16k, {
      language: whisperLangName,
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      no_repeat_ngram_size: 3,
    });
    return { skipped: false, model: localModelId, text: String(out?.text ?? "").trim() };
  }

  if (openAiKey) {
    const form = new FormData();
    form.append("file", new Blob([wavBuffer], { type: "audio/wav" }), path.basename(wavPath));
    form.append("model", "whisper-1");
    form.append("language", langCode);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI Whisper HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { skipped: false, text: String(data.text ?? "").trim() };
  }

  if (whisperCmd) {
    const outDir = path.dirname(wavPath);
    execFileSync(whisperCmd, [wavPath, "--model", "base", "--language", language, "--output_format", "txt", "--output_dir", outDir], {
      stdio: "pipe",
    });
    const txtPath = path.join(outDir, `${path.parse(wavPath).name}.txt`);
    const text = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, "utf8").trim() : "";
    return { skipped: false, text };
  }

  return { skipped: true, reason: "SKIPPED (use --local-whisper, OPENAI_API_KEY, or --whisper-cmd)" };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function runDryRun(rawRate) {
  console.log("=== Paired WER Benchmark Dry-Run ===");

  // 1. Synthetic 2-second 48 kHz WAV containing 70 Hz HVAC rumble + 1000 Hz speech-band bursts
  const sr = 48000;
  const totalSamples = sr * 2;
  const synth = new Float64Array(totalSamples);
  for (let n = 0; n < totalSamples; n++) {
    const t = n / sr;
    const hvacRumble = 0.25 * Math.sin(2 * Math.PI * 65 * t) + 0.15 * Math.sin(2 * Math.PI * 90 * t);
    const inSpeechWindow = (t >= 0.4 && t <= 0.9) || (t >= 1.2 && t <= 1.8);
    const speechBurst = inSpeechWindow
      ? 0.22 * Math.sin(2 * Math.PI * 440 * t) + 0.18 * Math.sin(2 * Math.PI * 1200 * t)
      : 0;
    synth[n] = hvacRumble + speechBurst;
  }

  const synthWavBuf = encodeWavPcm16(synth, sr);
  const parsedSynth = decodeWavOrRawPcm(synthWavBuf, rawRate);
  assert(parsedSynth.format === "riff-wave" && parsedSynth.sampleRate === 48000, "RIFF/WAVE round-trip failed");

  const filteredSynth = applyHighPassBiquad(parsedSynth.samples, parsedSynth.sampleRate, 120, 0.707);
  const rawMetrics = computeAcousticMetrics(parsedSynth.samples, parsedSynth.sampleRate);
  const hpfMetrics = computeAcousticMetrics(filteredSynth, parsedSynth.sampleRate);

  console.log(`Synthetic RIFF/WAVE Raw  -> RMS=${rawMetrics.rmsDbfs} dBFS, Broadband SNR=${rawMetrics.broadbandSnrDb} dB`);
  console.log(`Synthetic RIFF/WAVE HPF  -> RMS=${hpfMetrics.rmsDbfs} dBFS, Broadband SNR=${hpfMetrics.broadbandSnrDb} dB`);
  assert(hpfMetrics.rmsDbfs < rawMetrics.rmsDbfs, "120 Hz HPF should attenuate sub-120 Hz HVAC energy");
  assert(hpfMetrics.broadbandSnrDb > rawMetrics.broadbandSnrDb, "120 Hz HPF should raise broadband SNR");

  // 2. Test headerless raw 16-bit LE PCM fallback on repo file if present
  if (fs.existsSync("lecture_biology.wav")) {
    const rawBuf = fs.readFileSync("lecture_biology.wav");
    const parsedBio = decodeWavOrRawPcm(rawBuf, rawRate);
    const filteredBio = applyHighPassBiquad(parsedBio.samples, parsedBio.sampleRate, 120, 0.707);
    const mRaw = computeAcousticMetrics(parsedBio.samples, parsedBio.sampleRate);
    const mHpf = computeAcousticMetrics(filteredBio, parsedBio.sampleRate);
    console.log(
      `Repo file lecture_biology.wav (${parsedBio.format} @ ${parsedBio.sampleRate} Hz, ${(parsedBio.samples.length / parsedBio.sampleRate).toFixed(2)} s): ` +
        `Raw RMS=${mRaw.rmsDbfs} dBFS (SNR=${mRaw.broadbandSnrDb} dB) -> HPF RMS=${mHpf.rmsDbfs} dBFS (SNR=${mHpf.broadbandSnrDb} dB)`,
    );
  }

  // 3. WER unit checks (0%, 25%, 100%, plus Kazakh & Russian Cyrillic)
  const w0 = computeWerCer("Деректер құрылымы және алгоритмдер", "Деректер құрылымы, және алгоритмдер!", "Kazakh");
  const wRuYo = computeWerCer("Ещё три ёлки на берёзе в 2024 году", "Еще три елки на березе в 2024 году", "Russian");
  const wKzSpec = computeWerCer("Ғылым мен өнер, ұлттық тіл, һәкім", "ғылым мен өнер ұлттық тіл һәкім", "Kazakh");
  const w25 = computeWerCer("one two three four", "one two X four", "English");
  const w100 = computeWerCer("алгоритм графы", "", "Russian");
  assert(w0.werPct === 0, `Expected 0% WER for identical Kazakh phrase, got ${w0.werPct}`);
  assert(wRuYo.werPct === 0, `Expected 0% WER for Russian yo->e & preserved digits, got ${wRuYo.werPct}`);
  assert(wKzSpec.werPct === 0, `Expected 0% WER for Kazakh Cyrillic letters, got ${wKzSpec.werPct}`);
  assert(w25.werPct === 25, `Expected 25% WER for 1/4 substitution, got ${w25.werPct}`);
  assert(w100.werPct === 100, `Expected 100% WER for full deletion, got ${w100.werPct}`);

  const stats = meanAndSampleSd([78, 82, 89, 79, 92]);
  assert(stats.mean === 84 && stats.sd === 6.2, `Expected mean=84, sample SD=6.2, got ${stats.mean}/${stats.sd}`);
  assert(w25.distance === 1 && w25.refWords === 4, `Expected word distance=1, refWords=4, got ${w25.distance}/${w25.refWords}`);

  // 4. Wilcoxon signed-rank (exact two-sided) & exact binomial sign test unit checks
  const wil = wilcoxonSignedRank([10, 12, 8, 14, 10, 11], [8, 9, 10, 12, 10, 12]);
  assert(wil.improved === 3 && wil.worsened === 2 && wil.tied === 1 && wil.nEff === 5, `Unexpected Wilcoxon counts: ${JSON.stringify(wil)}`);
  assert(wil.method === "exact_twosided" && wil.pValueExact === 0.5 && wil.signTestP === 1, `Unexpected Wilcoxon exact p: ${JSON.stringify(wil)}`);
  const wil4 = wilcoxonSignedRank([10, 12, 14, 16], [9, 10, 11, 12]);
  assert(wil4.wStat === 0 && wil4.pValueExact === 0.125, `Expected 2/16=0.125 for n=4 all positive, got ${wil4.pValueExact}`);

  // 5. Silence-snapped window split check
  const dummySr = 48000;
  const dummySig = new Float64Array(dummySr * 15);
  for (let i = 0; i < dummySig.length; i++) {
    const t = i / dummySr;
    const isGap = (t >= 4.8 && t <= 5.2) || (t >= 9.8 && t <= 10.2);
    dummySig[i] = isGap ? 0.0001 : 0.2 * Math.sin(2 * Math.PI * 300 * t);
  }
  const winBufs = splitSamplesAtSilence(dummySig, dummySr, 3, dummySig);
  assert(winBufs.length === 3 && winBufs.every((b) => b.length > 44), "splitSamplesAtSilence failed");

  console.log("WER/CER, word-error, sample SD, Wilcoxon, and silence-split unit checks passed.");
}

/**
 * Split samples deterministically into `numWindows` slices snapped to the lowest-energy 20 ms
 * silence frame within +/- 4 s of each target boundary on `refSamplesForSplit`, encoding each slice
 * as a 16 kHz mono 16-bit PCM WAV buffer for Gemini.
 */
export function splitSamplesAtSilence(samples, sampleRate, numWindows = 3, refSamplesForSplit = samples) {
  const n = samples.length;
  const ref = refSamplesForSplit && refSamplesForSplit.length === n ? refSamplesForSplit : samples;
  const frameLen = Math.max(1, Math.round(sampleRate * 0.02));
  const searchRadius = Math.round(sampleRate * 4.0);
  const boundaries = [0];

  for (let k = 1; k < numWindows; k++) {
    const target = Math.round((k / numWindows) * n);
    const minPos = Math.max(boundaries[boundaries.length - 1] + sampleRate, target - searchRadius);
    const maxPos = Math.min(n - sampleRate - frameLen, target + searchRadius);
    let bestPos = target;
    let bestEnergy = Infinity;
    for (let pos = minPos; pos <= maxPos; pos += frameLen) {
      let sq = 0;
      for (let j = 0; j < frameLen; j++) {
        const v = ref[pos + j];
        sq += v * v;
      }
      if (sq < bestEnergy) {
        bestEnergy = sq;
        bestPos = pos + Math.floor(frameLen / 2);
      }
    }
    boundaries.push(bestPos);
  }
  boundaries.push(n);

  const wavBuffers16k = [];
  for (let w = 0; w < numWindows; w++) {
    const slice = samples.subarray(boundaries[w], boundaries[w + 1]);
    const pcm16k = sampleRate > 16000 ? resampleTo16k(slice, sampleRate) : slice;
    wavBuffers16k.push(encodeWavPcm16(pcm16k, Math.min(16000, sampleRate)));
  }
  return wavBuffers16k;
}

async function runGeminiMulti(wavBuffer, language, runs = 1, expectedWords = 0, label = "Raw", windowedSamples = null, { strictModel = false } = {}) {
  const results = [];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const runWindowedOnce = async (runIdx) => {
    const { samples, sampleRate, refSamplesForSplit } = windowedSamples;
    const winBufs = splitSamplesAtSilence(samples, sampleRate, 3, refSamplesForSplit);
    const expectedPerWindow = expectedWords > 0 ? Math.round(expectedWords / winBufs.length) : 0;
    const temp = Number((0.15 + runIdx * 0.05).toFixed(2));
    const winTexts = [];
    let lastModel = null;
    for (let w = 0; w < winBufs.length; w++) {
      const wr = await transcribeWithGemini(winBufs[w], language, expectedPerWindow, temp, { strictModel });
      if (wr.skipped) return wr;
      winTexts.push(wr.text);
      if (wr.model) lastModel = wr.model;
      if (w + 1 < winBufs.length) await sleep(200);
    }
    const joined = winTexts.filter(Boolean).join(" ").trim();
    const normWordCount = normalizeText(joined, language).split(" ").filter(Boolean).length;
    return { skipped: false, model: lastModel, text: joined, normWordCount, windowed: winBufs.length };
  };

  const concurrency = 1;
  let nextIdx = 0;
  const minFullWords = expectedWords > 0 ? Math.floor(expectedWords * 0.75) : 0;
  async function worker() {
    while (nextIdx < runs) {
      const idx = nextIdx++;
      const temp = Number((0.15 + idx * 0.05).toFixed(2));
      let res;
      if (windowedSamples && windowedSamples.samples.length / windowedSamples.sampleRate > 155) {
        res = await runWindowedOnce(idx);
      } else {
        res = await transcribeWithGemini(wavBuffer, language, expectedWords, temp, { strictModel });
        if (!res.skipped && windowedSamples && minFullWords > 0 && (res.normWordCount ?? 0) < minFullWords) {
          console.warn(
            `    [${label} run ${idx + 1}/${runs}] ${res.normWordCount}/${expectedWords} words (<${minFullWords}); falling back to 3-window split...`,
          );
          res = await runWindowedOnce(idx);
        }
      }
      results[idx] = res;
      console.log(
        `    [${label} run ${idx + 1}/${runs}] ${res.model ?? "skipped"}: ${res.normWordCount ?? 0} words${res.windowed ? ` (${res.windowed} windows)` : ""}`,
      );
      if (nextIdx < runs) await sleep(250);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function runBenchmark(
  manifestPath,
  rawRate,
  whisperCmd,
  {
    acousticOnly = false,
    useLocalWhisper = false,
    outPrefix = "en_real",
    geminiRuns = 1,
    skipLargeWhisper = false,
    skipWhisper = false,
    skipGemini = false,
    strictModel = false,
  } = {},
) {
  loadEnvFile(".env");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("Manifest must be a non-empty JSON array.");
  }

  fs.mkdirSync("benchmarks", { recursive: true });
  const checkpointPath = `benchmarks/checkpoint_${outPrefix}.json`;
  let checkpoint = {};
  if (fs.existsSync(checkpointPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
    } catch {
      checkpoint = {};
    }
  }
  const saveCheckpoint = () => {
    const out = {};
    for (const c of clipItems) {
      out[c.item.id] = {
        geminiModelsUsed: Array.from(c.geminiModelsUsed),
        gRawRuns: c.gRawRuns,
        gHpfRuns: c.gHpfRuns,
        wBaseRaw: c.wBaseRaw,
        wBaseHpf: c.wBaseHpf,
        wLargeRaw: c.wLargeRaw,
        wLargeHpf: c.wLargeHpf,
      };
    }
    fs.writeFileSync(checkpointPath, JSON.stringify(out, null, 2), "utf8");
  };

  const clipItems = [];
  for (const item of manifest) {
    console.log(`\n[Benchmark] Preparing acoustics ${item.id} (${item.language}, ${item.zone}): ${item.wavPath}`);
    const buf = fs.readFileSync(item.wavPath);
    const decoded = decodeWavOrRawPcm(buf, rawRate);
    const durationSec = Number((decoded.samples.length / decoded.sampleRate).toFixed(2));
    const rawWavBuf = decoded.format === "riff-wave" ? buf : encodeWavPcm16(decoded.samples, decoded.sampleRate);
    const filteredSamples = applyHighPassBiquad(decoded.samples, decoded.sampleRate, 120, 0.707);
    const filteredWavBuf = encodeWavPcm16(filteredSamples, decoded.sampleRate);

    const parsedPath = path.parse(item.wavPath);
    const hpfPath = path.join(parsedPath.dir, `${parsedPath.name}.hpf120.wav`);
    fs.writeFileSync(hpfPath, filteredWavBuf);

    const rawAcoustic = computeAcousticMetrics(decoded.samples, decoded.sampleRate, filteredSamples);
    const hpfAcoustic = computeAcousticMetrics(filteredSamples, decoded.sampleRate);
    console.log(
      `  Acoustic (${durationSec}s @ ${decoded.sampleRate} Hz): Raw=${rawAcoustic.rmsDbfs} dBFS (Floor=${rawAcoustic.noiseFloorDbfs} dBFS, SNR_bb=${rawAcoustic.broadbandSnrDb} dB) | ` +
        `HPF120=${hpfAcoustic.rmsDbfs} dBFS (SNR_bb=${hpfAcoustic.broadbandSnrDb} dB, Sub-120Hz=${rawAcoustic.sub120HzPct}%)`,
    );

    const refWordsCount = computeWerCer(item.referenceText, item.referenceText, item.language).refWords;
    const saved = checkpoint[item.id] ?? {};
    clipItems.push({
      item,
      decoded,
      durationSec,
      rawWavBuf,
      filteredSamples,
      filteredWavBuf,
      hpfPath,
      rawAcoustic,
      hpfAcoustic,
      refWords: refWordsCount,
      geminiModelsUsed: new Set(saved.geminiModelsUsed ?? []),
      gRawRuns: Array.isArray(saved.gRawRuns) ? saved.gRawRuns : [],
      gHpfRuns: Array.isArray(saved.gHpfRuns) ? saved.gHpfRuns : [],
      wBaseRaw: saved.wBaseRaw ?? null,
      wBaseHpf: saved.wBaseHpf ?? null,
      wLargeRaw: saved.wLargeRaw ?? null,
      wLargeHpf: saved.wLargeHpf ?? null,
    });
  }

  if (!acousticOnly) {
    // Downsample 48 kHz -> 16 kHz mono 16-bit PCM WAV after HPF so Gemini payloads stay ~2.8-5.4 MB
    // while retaining 100% of the 120 Hz HPF attenuation and the 0-8 kHz speech band.
    const toGeminiBuf = (bufOrig, sampOrig, sampleRate) => {
      if (sampleRate <= 16000) return bufOrig;
      const pcm16k = resampleTo16k(sampOrig, sampleRate);
      return encodeWavPcm16(pcm16k, 16000);
    };

    // Stage 1: Gemini K runs per condition (reuse valid checkpointed clips; unless --skip-gemini restores all)
    if (!skipGemini) {
      const pinnedModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      const isClipGeminiValid = (c) => {
        if (c.gRawRuns.length !== geminiRuns || c.gHpfRuns.length !== geminiRuns) return false;
        const minOk = c.refWords > 0 ? Math.floor(c.refWords * 0.75) : 1;
        return [...c.gRawRuns, ...c.gHpfRuns].every(
          (r) => r && !r.skipped && (r.normWordCount ?? 0) >= minOk && (!strictModel || r.model === pinnedModel),
        );
      };

      for (const c of clipItems) {
        if (isClipGeminiValid(c)) {
          console.log(`\n[Gemini x${geminiRuns}] ${c.item.id} (${c.item.language}, ${c.item.zone}) -> reused valid checkpoint.`);
          continue;
        }
        console.log(`\n[Gemini x${geminiRuns}] ${c.item.id} (${c.item.language}, ${c.item.zone}, ${c.refWords} words)`);
        const gRawBuf = toGeminiBuf(c.rawWavBuf, c.decoded.samples, c.decoded.sampleRate);
        const gHpfBuf = toGeminiBuf(c.filteredWavBuf, c.filteredSamples, c.decoded.sampleRate);
        console.log(`  Payload size: ${(gRawBuf.length / (1024 * 1024)).toFixed(2)} MB (16 kHz PCM WAV)`);
        c.geminiModelsUsed.clear();
        c.gRawRuns = await runGeminiMulti(gRawBuf, c.item.language, geminiRuns, c.refWords, `${c.item.id} Raw`, {
          samples: c.decoded.samples,
          sampleRate: c.decoded.sampleRate,
          refSamplesForSplit: c.decoded.samples,
        }, { strictModel });
        c.gHpfRuns = await runGeminiMulti(gHpfBuf, c.item.language, geminiRuns, c.refWords, `${c.item.id} HPF`, {
          samples: c.filteredSamples,
          sampleRate: c.decoded.sampleRate,
          refSamplesForSplit: c.decoded.samples,
        }, { strictModel });
        for (const r of [...c.gRawRuns, ...c.gHpfRuns]) {
          if (r?.model) c.geminiModelsUsed.add(r.model);
        }
        saveCheckpoint();
        const rawWers = c.gRawRuns.map((r) => (r.skipped ? null : computeWerCer(c.item.referenceText, r.text, c.item.language).werPct)).filter((v) => v !== null);
        const hpfWers = c.gHpfRuns.map((r) => (r.skipped ? null : computeWerCer(c.item.referenceText, r.text, c.item.language).werPct)).filter((v) => v !== null);
        const msRaw = meanAndSampleSd(rawWers);
        const msHpf = meanAndSampleSd(hpfWers);
        console.log(`  Gemini (${Array.from(c.geminiModelsUsed).join(",")}) Raw=${msRaw.mean}±${msRaw.sd}% | HPF=${msHpf.mean}±${msHpf.sd}%`);
      }
    } else {
      console.log(`\n[Gemini] Skipped network inference (--skip-gemini); loaded checkpoint from ${checkpointPath}.`);
    }

    // Stage 2: Whisper Base (loaded once, then disposed cleanly)
    if (!skipWhisper && (useLocalWhisper || process.env.OPENAI_API_KEY || whisperCmd)) {
      console.log(`\n[Whisper Base] Transcribing ${clipItems.length} clips (Raw + HPF)...`);
      for (const c of clipItems) {
        c.wBaseRaw = await transcribeWithWhisper(c.item.wavPath, c.rawWavBuf, c.decoded.samples, c.decoded.sampleRate, c.item.language, whisperCmd, useLocalWhisper, "Xenova/whisper-base");
        c.wBaseHpf = await transcribeWithWhisper(c.hpfPath, c.filteredWavBuf, c.filteredSamples, c.decoded.sampleRate, c.item.language, whisperCmd, useLocalWhisper, "Xenova/whisper-base");
        saveCheckpoint();
        const mRaw = c.wBaseRaw.skipped ? null : computeWerCer(c.item.referenceText, c.wBaseRaw.text, c.item.language);
        const mHpf = c.wBaseHpf.skipped ? null : computeWerCer(c.item.referenceText, c.wBaseHpf.text, c.item.language);
        console.log(`  ${c.item.id}: Raw=${mRaw?.werPct}% (${mRaw?.distance}w) | HPF=${mHpf?.werPct}% (${mHpf?.distance}w)`);
      }
      if (useLocalWhisper) await disposeLocalWhisperPipeline("Xenova/whisper-base");
    }

    // Stage 3: Whisper Large-v3-Turbo (strong 809M baseline, loaded once then disposed)
    if (!skipWhisper && useLocalWhisper && !skipLargeWhisper) {
      console.log(`\n[Whisper Large-v3-Turbo] Transcribing ${clipItems.length} clips (Raw + HPF)...`);
      for (const c of clipItems) {
        c.wLargeRaw = await transcribeWithWhisper(c.item.wavPath, c.rawWavBuf, c.decoded.samples, c.decoded.sampleRate, c.item.language, whisperCmd, true, "onnx-community/whisper-large-v3-turbo");
        c.wLargeHpf = await transcribeWithWhisper(c.hpfPath, c.filteredWavBuf, c.filteredSamples, c.decoded.sampleRate, c.item.language, whisperCmd, true, "onnx-community/whisper-large-v3-turbo");
        saveCheckpoint();
        const mRaw = computeWerCer(c.item.referenceText, c.wLargeRaw.text, c.item.language);
        const mHpf = computeWerCer(c.item.referenceText, c.wLargeHpf.text, c.item.language);
        console.log(`  ${c.item.id}: Raw=${mRaw.werPct}% (${mRaw.distance}w) | HPF=${mHpf.werPct}% (${mHpf.distance}w)`);
      }
      await disposeLocalWhisperPipeline("onnx-community/whisper-large-v3-turbo");
    }
  }

  const rows = [];
  const transcriptLogs = [];
  for (const c of clipItems) {
    if (acousticOnly) {
      rows.push({
        id: c.item.id,
        language: c.item.language,
        zone: c.item.zone,
        durationSec: c.durationSec,
        refWords: c.refWords,
        rawRmsDbfs: c.rawAcoustic.rmsDbfs,
        hpfRmsDbfs: c.hpfAcoustic.rmsDbfs,
        sub120HzPct: c.rawAcoustic.sub120HzPct,
        rawNoiseFloorDbfs: c.rawAcoustic.noiseFloorDbfs,
        hpfNoiseFloorDbfs: c.hpfAcoustic.noiseFloorDbfs,
        rawSnrDb: c.rawAcoustic.broadbandSnrDb,
        hpfSnrDb: c.hpfAcoustic.broadbandSnrDb,
      });
      continue;
    }

    const gRawMetrics = c.gRawRuns.filter((r) => !r.skipped).map((r) => computeWerCer(c.item.referenceText, r.text, c.item.language));
    const gHpfMetrics = c.gHpfRuns.filter((r) => !r.skipped).map((r) => computeWerCer(c.item.referenceText, r.text, c.item.language));
    const gRawWerStats = meanAndSampleSd(gRawMetrics.map((m) => m.werPct));
    const gHpfWerStats = meanAndSampleSd(gHpfMetrics.map((m) => m.werPct));
    const gRawErrStats = meanAndSampleSd(gRawMetrics.map((m) => m.distance));
    const gHpfErrStats = meanAndSampleSd(gHpfMetrics.map((m) => m.distance));

    const wBaseRawM = c.wBaseRaw && !c.wBaseRaw.skipped ? computeWerCer(c.item.referenceText, c.wBaseRaw.text, c.item.language) : null;
    const wBaseHpfM = c.wBaseHpf && !c.wBaseHpf.skipped ? computeWerCer(c.item.referenceText, c.wBaseHpf.text, c.item.language) : null;
    const wLargeRawM = c.wLargeRaw && !c.wLargeRaw.skipped ? computeWerCer(c.item.referenceText, c.wLargeRaw.text, c.item.language) : null;
    const wLargeHpfM = c.wLargeHpf && !c.wLargeHpf.skipped ? computeWerCer(c.item.referenceText, c.wLargeHpf.text, c.item.language) : null;

    rows.push({
      id: c.item.id,
      language: c.item.language,
      zone: c.item.zone,
      durationSec: c.durationSec,
      refWords: c.refWords,
      rawRmsDbfs: c.rawAcoustic.rmsDbfs,
      hpfRmsDbfs: c.hpfAcoustic.rmsDbfs,
      sub120HzPct: c.rawAcoustic.sub120HzPct,
      rawNoiseFloorDbfs: c.rawAcoustic.noiseFloorDbfs,
      hpfNoiseFloorDbfs: c.hpfAcoustic.noiseFloorDbfs,
      rawSnrDb: c.rawAcoustic.broadbandSnrDb,
      hpfSnrDb: c.hpfAcoustic.broadbandSnrDb,
      geminiModel: Array.from(c.geminiModelsUsed).join("|"),
      geminiRawWerMean: gRawWerStats.mean ?? "",
      geminiRawWerSd: gRawWerStats.sd ?? "",
      geminiHpfWerMean: gHpfWerStats.mean ?? "",
      geminiHpfWerSd: gHpfWerStats.sd ?? "",
      geminiRawErrMean: gRawErrStats.mean ?? "",
      geminiRawErrSd: gRawErrStats.sd ?? "",
      geminiHpfErrMean: gHpfErrStats.mean ?? "",
      geminiHpfErrSd: gHpfErrStats.sd ?? "",
      wLargeRawWer: wLargeRawM?.werPct ?? "",
      wLargeHpfWer: wLargeHpfM?.werPct ?? "",
      wLargeRawErr: wLargeRawM?.distance ?? "",
      wLargeHpfErr: wLargeHpfM?.distance ?? "",
      wBaseRawWer: wBaseRawM?.werPct ?? "",
      wBaseHpfWer: wBaseHpfM?.werPct ?? "",
      wBaseRawErr: wBaseRawM?.distance ?? "",
      wBaseHpfErr: wBaseHpfM?.distance ?? "",
    });

    transcriptLogs.push({
      id: c.item.id,
      language: c.item.language,
      zone: c.item.zone,
      refWords: c.refWords,
      geminiModelsUsed: Array.from(c.geminiModelsUsed),
      referenceText: c.item.referenceText,
      geminiRawRuns: c.gRawRuns.map((r, i) => ({ run: i + 1, model: r.model, text: r.text ?? r.reason, metrics: gRawMetrics[i] })),
      geminiHpfRuns: c.gHpfRuns.map((r, i) => ({ run: i + 1, model: r.model, text: r.text ?? r.reason, metrics: gHpfMetrics[i] })),
      whisperLargeRawText: c.wLargeRaw?.text ?? "",
      whisperLargeHpfText: c.wLargeHpf?.text ?? "",
      whisperBaseRawText: c.wBaseRaw?.text ?? "",
      whisperBaseHpfText: c.wBaseHpf?.text ?? "",
    });
  }

  fs.mkdirSync("benchmarks", { recursive: true });
  const csvPath = `benchmarks/results_${outPrefix}.csv`;
  const transcriptsPath = `benchmarks/transcripts_${outPrefix}.json`;
  const summaryPath = `benchmarks/summary_${outPrefix}.md`;
  const statsPath = `benchmarks/stats_${outPrefix}.json`;

  const header = Object.keys(rows[0]).join(",");
  const csvLines = [header, ...rows.map((r) => Object.values(r).join(","))];
  fs.writeFileSync(csvPath, csvLines.join("\n"), "utf8");
  if (!acousticOnly) {
    fs.writeFileSync(transcriptsPath, JSON.stringify(transcriptLogs, null, 2), "utf8");
  }

  const fmt = (arr) => {
    const nums = arr.filter((v) => typeof v === "number" && Number.isFinite(v));
    if (!nums.length) return "SKIPPED";
    const { mean, sd } = meanAndSampleSd(nums);
    return `${mean} ± ${sd}`;
  };

  const md = [
    `# Paired Acoustic Filtering & ASR Benchmark (${outPrefix}, geminiRuns=${geminiRuns})`,
    "",
    "| Recording ID | Lang | Zone | Dur (s) | Ref Words | SNR_bb Raw -> HPF (dB) | Gemini Raw WER (%) | Gemini HPF WER (%) | Gemini Errs (R->H) | Whisper-Large-v3T WER (R->H) | Whisper-Base WER (R->H) |",
    "| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
  ];
  for (const r of rows) {
    md.push(
      `| ${r.id} | ${r.language} | ${r.zone} | ${r.durationSec} | ${r.refWords} | ${r.rawSnrDb} -> ${r.hpfSnrDb} | ` +
        `${r.geminiRawWerMean}±${r.geminiRawWerSd} | ${r.geminiHpfWerMean}±${r.geminiHpfWerSd} | ${r.geminiRawErrMean} -> ${r.geminiHpfErrMean} | ` +
        `${r.wLargeRawWer} -> ${r.wLargeHpfWer} | ${r.wBaseRawWer} -> ${r.wBaseHpfWer} |`,
    );
  }
  const langs = Array.from(new Set(rows.map((r) => r.language)));
  for (const lang of langs) {
    const sub = rows.filter((r) => r.language === lang);
    md.push(
      `| **${lang} Mean±SD** | **${lang}** | **N=${sub.length}** | ${fmt(sub.map((x) => x.durationSec))} | ${fmt(sub.map((x) => x.refWords))} | ` +
        `${fmt(sub.map((x) => x.rawSnrDb))} -> ${fmt(sub.map((x) => x.hpfSnrDb))} | ` +
        `${fmt(sub.map((x) => x.geminiRawWerMean))} | ${fmt(sub.map((x) => x.geminiHpfWerMean))} | ${fmt(sub.map((x) => x.geminiRawErrMean))} -> ${fmt(sub.map((x) => x.geminiHpfErrMean))} | ` +
        `${fmt(sub.map((x) => x.wLargeRawWer))} -> ${fmt(sub.map((x) => x.wLargeHpfWer))} | ${fmt(sub.map((x) => x.wBaseRawWer))} -> ${fmt(sub.map((x) => x.wBaseHpfWer))} |`,
    );
  }

  let statsObj = {};
  if (!acousticOnly) {
    const computeSuite = (subset, label) => {
      const out = { label, n: subset.length };
      const addTest = (key, rawKey, hpfKey) => {
        const valid = subset.filter((x) => typeof x[rawKey] === "number" && typeof x[hpfKey] === "number");
        if (valid.length > 0) {
          out[key] = wilcoxonSignedRank(valid.map((x) => x[rawKey]), valid.map((x) => x[hpfKey]));
        }
      };
      addTest("geminiWer", "geminiRawWerMean", "geminiHpfWerMean");
      addTest("geminiErr", "geminiRawErrMean", "geminiHpfErrMean");
      addTest("whisperLargeWer", "wLargeRawWer", "wLargeHpfWer");
      addTest("whisperLargeErr", "wLargeRawErr", "wLargeHpfErr");
      addTest("whisperBaseWer", "wBaseRawWer", "wBaseHpfWer");
      addTest("whisperBaseErr", "wBaseRawErr", "wBaseHpfErr");
      return out;
    };

    statsObj.all = computeSuite(rows, `All (N=${rows.length})`);
    statsObj.byLanguage = {};
    for (const lang of langs) {
      statsObj.byLanguage[lang] = computeSuite(rows.filter((r) => r.language === lang), lang);
    }
    fs.writeFileSync(statsPath, JSON.stringify(statsObj, null, 2), "utf8");

    md.push("", "## Paired Wilcoxon Signed-Rank & Sign Test Summary (Raw vs. 120 Hz HPF)", "");
    for (const [k, res] of Object.entries(statsObj.all)) {
      if (typeof res === "object" && res !== null && "nEff" in res) {
        md.push(
          `- **${k} (N=${res.nTotal}, n_eff=${res.nEff}, ${res.method})**: improved=${res.improved}, worsened=${res.worsened}, tied=${res.tied} | W=${res.wStat}, exact p=${res.pValue.toFixed(2)} (${res.pValue}), approx p=${res.pValueApprox}, Sign test p=${res.signTestP.toFixed(2)}`,
        );
      }
    }
  }

  fs.writeFileSync(summaryPath, md.join("\n"), "utf8");
  console.log(`\nWrote ${csvPath}, ${summaryPath}${!acousticOnly ? `, and ${statsPath}` : ""}`);
}

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase();

if (isEntrypoint) {
  const args = process.argv.slice(2);
  let dryRun = false;
  let acousticOnly = false;
  let useLocalWhisper = false;
  let skipLargeWhisper = false;
  let skipWhisper = false;
  let skipGemini = false;
  let strictModel = process.env.STRICT_GEMINI_MODEL === "1";
  let rawRate = 24000;
  let whisperCmd = null;
  let outPrefix = "en_real";
  let geminiRuns = 1;
  let manifestArg = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--acoustic-only") acousticOnly = true;
    else if (a === "--local-whisper") useLocalWhisper = true;
    else if (a === "--skip-large-whisper") skipLargeWhisper = true;
    else if (a === "--skip-whisper") skipWhisper = true;
    else if (a === "--skip-gemini") skipGemini = true;
    else if (a === "--strict-model") strictModel = true;
    else if (a === "--raw-rate") rawRate = Number(args[++i]) || 24000;
    else if (a === "--whisper-cmd") whisperCmd = args[++i] ?? null;
    else if (a === "--out-prefix") outPrefix = args[++i] || "en_real";
    else if (a === "--gemini-runs") geminiRuns = Math.max(1, Number(args[++i]) || 1);
    else if (!a.startsWith("--") && !manifestArg) manifestArg = a;
  }

  if (dryRun || !manifestArg) {
    runDryRun(rawRate);
  } else {
    await runBenchmark(manifestArg, rawRate, whisperCmd, {
      acousticOnly,
      useLocalWhisper,
      outPrefix,
      geminiRuns,
      skipLargeWhisper,
      skipWhisper,
      skipGemini,
      strictModel,
    });
  }
}
