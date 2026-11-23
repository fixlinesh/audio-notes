import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Readable, Transform } from "node:stream";
import { execFileSync } from "node:child_process";
import {
  decodeWavOrRawPcm,
  encodeWavPcm16,
  applyHighPassBiquad,
  computeAcousticMetrics,
} from "./wer_benchmark.mjs";

const FFMPEG_BIN = path.resolve("benchmarks/tools/node_modules/ffmpeg-static/ffmpeg.exe");
const RAW_DIR = path.resolve("benchmarks/audio/fleurs_raw");
const AUDIO_DIR = path.resolve("benchmarks/audio");
const MANIFEST_PATH = path.resolve("benchmarks/manifest_ru_kz_fleurs.json");
const EN_MANIFEST_PATH = path.resolve("benchmarks/manifest_en_real.json");
const ALL_MANIFEST_PATH = path.resolve("benchmarks/manifest_all_10.json");
const SAMPLE_RATE = 48000;
const SEED = 20270224;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePinkNoise(length, seed) {
  const rand = mulberry32(seed);
  const out = new Float64Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = rand() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
  }
  return unitRmsNormalize(out);
}

function lowPassOnePole(samples, sampleRate, cutoffHz) {
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);
  const out = new Float64Array(samples.length);
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y = y + alpha * (samples[i] - y);
    out[i] = y;
  }
  return unitRmsNormalize(out);
}

function unitRmsNormalize(samples) {
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length)) || 1e-12;
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] / rms;
  return out;
}

function generateRumbleSignal(length, sampleRate, freqsHz, lpfCutoffHz, seed) {
  const pink = generatePinkNoise(length, seed);
  const lpPink = lowPassOnePole(pink, sampleRate, lpfCutoffHz);
  const tones = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (let fIdx = 0; fIdx < freqsHz.length; fIdx++) {
      // Deterministic harmonic weight decay so lower HVAC fundamental dominates naturally
      const w = 1 / (1 + 0.25 * fIdx);
      s += w * Math.sin(2 * Math.PI * freqsHz[fIdx] * t + fIdx * 0.7);
    }
    tones[i] = s;
  }
  const unitTones = unitRmsNormalize(tones);
  const combined = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    combined[i] = 0.65 * unitTones[i] + 0.35 * lpPink[i];
  }
  return unitRmsNormalize(combined);
}

function mixAtGains(speech, rumble, pink, gRumble, gPink) {
  const out = new Float64Array(speech.length);
  for (let i = 0; i < speech.length; i++) {
    out[i] = speech[i] + gRumble * rumble[i] + gPink * pink[i];
  }
  return out;
}

function calibrateZoneMix(speech, rumble, pink, targetSnrDb, noiseRumbleShare) {
  // noiseRumbleShare is the fraction of added noise power routed to the sub-120 Hz rumble track.
  // Because speech has fixed P90 and low noise floor, increasing total noise gain g monotonically lowers SNR_bb.
  const wRumble = Math.sqrt(noiseRumbleShare);
  const wPink = Math.sqrt(1 - noiseRumbleShare);
  let loG = 0.0005;
  let hiG = 0.25;
  let best = null;

  for (let iter = 0; iter < 24; iter++) {
    const g = (loG + hiG) / 2;
    const gRumble = g * wRumble;
    const gPink = g * wPink;
    const mixed = mixAtGains(speech, rumble, pink, gRumble, gPink);
    const hpf = applyHighPassBiquad(mixed, SAMPLE_RATE, 120, 0.707);
    const m = computeAcousticMetrics(mixed, SAMPLE_RATE, hpf);
    const hpfM = computeAcousticMetrics(hpf, SAMPLE_RATE);
    best = { mixed, hpf, gRumble, gPink, rawMetrics: m, hpfMetrics: hpfM };
    if (m.broadbandSnrDb > targetSnrDb) loG = g;
    else hiG = g;
  }

  let peak = 0;
  for (let i = 0; i < best.mixed.length; i++) {
    const a = Math.abs(best.mixed[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0.98) {
    throw new Error(`Calibrated mix clipped (peak=${peak.toFixed(3)}).`);
  }
  return best;
}

async function fetchFleursTsvCandidates(config) {
  const tsvUrl = `https://huggingface.co/datasets/google/fleurs/resolve/main/data/${config}/test.tsv`;
  console.log(`[FLEURS] Fetching metadata TSV: ${tsvUrl}`);
  const res = await fetch(tsvUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`FLEURS TSV HTTP ${res.status} for ${config}: ${(await res.text()).slice(0, 200)}`);
  }
  const tsv = await res.text();
  const candidateMap = new Map();
  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (cols.length < 4 || cols[0] === "id") continue;
    const fleursId = cols[0].trim();
    const fileName = cols[1].trim();
    const text = cols[2].trim();
    const words = text ? text.split(/\s+/) : [];
    if (!fileName.endsWith(".wav") || !text || /\d/.test(text) || words.length < 10 || words.length > 28) {
      continue;
    }
    candidateMap.set(fileName, {
      fleursId,
      fileName,
      words: words.length,
      text,
    });
  }
  return candidateMap;
}

async function streamFleursTarGzCandidates(config, candidateMap, targetCount = 16, maxDownloadBytes = 90 * 1024 * 1024) {
  const tarUrl = `https://huggingface.co/datasets/google/fleurs/resolve/main/data/${config}/audio/test.tar.gz`;
  console.log(`[FLEURS] Streaming tar.gz (${candidateMap.size} clean TSV candidates): ${tarUrl}`);
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const controller = new AbortController();
  const res = await fetch(tarUrl, { signal: controller.signal, redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`FLEURS tar.gz HTTP ${res.status} for ${config}`);
  }

  return await new Promise((resolve, reject) => {
    const netStream = Readable.fromWeb(res.body);
    const gunzip = zlib.createGunzip();
    let downloadedBytes = 0;
    let settled = false;
    let acc = Buffer.alloc(0);
    let current = null; // { meta, size, paddedSize, bytesRead, fileChunks }
    const extracted = [];
    const seenFleursIds = new Set();

    const finish = (err = null) => {
      if (settled) return;
      settled = true;
      try {
        gunzip.destroy();
      } catch {}
      try {
        netStream.destroy();
      } catch {}
      try {
        controller.abort();
      } catch {}
      if (err) reject(err);
      else resolve({ extracted, downloadedBytes });
    };

    const byteCounter = new Transform({
      transform(chunk, _enc, cb) {
        downloadedBytes += chunk.length;
        if (downloadedBytes > maxDownloadBytes) {
          if (extracted.length >= 12) {
            finish(null);
          } else {
            finish(
              new Error(
                `Streamed ${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB from ${config}/audio/test.tar.gz but only matched ${extracted.length} clean clips.`,
              ),
            );
          }
          cb();
          return;
        }
        cb(null, chunk);
      },
    });

    const handleStreamErr = (err) => {
      if (settled) return;
      if (err?.name === "AbortError" || err?.code === "ERR_STREAM_PREMATURE_CLOSE") {
        if (extracted.length >= 12) finish(null);
        else finish(err);
        return;
      }
      finish(err);
    };

    netStream.on("error", handleStreamErr);
    byteCounter.on("error", handleStreamErr);
    gunzip.on("error", handleStreamErr);

    gunzip.on("data", (chunk) => {
      if (settled) return;
      acc = acc.length ? Buffer.concat([acc, chunk]) : chunk;

      while (!settled) {
        if (!current) {
          if (acc.length < 512) break;
          const hdr = acc.subarray(0, 512);
          acc = acc.subarray(512);

          let allZero = true;
          for (let i = 0; i < 512; i++) {
            if (hdr[i] !== 0) {
              allZero = false;
              break;
            }
          }
          if (allZero) {
            finish(null);
            return;
          }

          const rawName = hdr.subarray(0, 100).toString("utf8").replace(/\0.*$/, "").trim();
          const ustarPrefix = hdr.subarray(345, 500).toString("utf8").replace(/\0.*$/, "").trim();
          const fullName = ustarPrefix ? `${ustarPrefix}/${rawName}` : rawName;
          const sizeOct = hdr.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
          const size = parseInt(sizeOct, 8) || 0;
          const typeFlagByte = hdr[156];
          const typeFlag = String.fromCharCode(typeFlagByte);
          const isRegular = typeFlag === "0" || typeFlagByte === 0;
          const baseName = path.posix.basename(fullName);
          const cand = isRegular && candidateMap.has(baseName) ? candidateMap.get(baseName) : null;
          const meta = cand && !seenFleursIds.has(cand.fleursId) ? cand : null;
          const paddedSize = Math.ceil(size / 512) * 512;

          if (paddedSize === 0) {
            continue;
          }
          current = {
            meta,
            size,
            paddedSize,
            bytesRead: 0,
            fileChunks: meta ? [] : null,
          };
        }

        if (current) {
          const remainingTotal = current.paddedSize - current.bytesRead;
          if (acc.length === 0) break;
          const take = Math.min(acc.length, remainingTotal);
          const slice = acc.subarray(0, take);
          acc = acc.subarray(take);

          if (current.meta && current.bytesRead < current.size) {
            const payloadTake = Math.min(take, current.size - current.bytesRead);
            current.fileChunks.push(slice.subarray(0, payloadTake));
          }
          current.bytesRead += take;

          if (current.bytesRead >= current.paddedSize) {
            if (current.meta) {
              const rawBuf = Buffer.concat(current.fileChunks);
              const rawFile = path.join(RAW_DIR, `${config}_utt_${extracted.length}_id${current.meta.fleursId}.src.wav`);
              const wav48File = path.join(RAW_DIR, `${config}_utt_${extracted.length}_id${current.meta.fleursId}.48k.wav`);
              fs.writeFileSync(rawFile, rawBuf);
              execFileSync(
                FFMPEG_BIN,
                ["-y", "-i", rawFile, "-ac", "1", "-ar", String(SAMPLE_RATE), "-sample_fmt", "s16", wav48File],
                { stdio: "pipe" },
              );
              const decoded = decodeWavOrRawPcm(fs.readFileSync(wav48File), SAMPLE_RATE);
              seenFleursIds.add(current.meta.fleursId);
              extracted.push({
                ...current.meta,
                wav48File,
                durationSec: decoded.samples.length / decoded.sampleRate,
                samples: decoded.samples,
              });
              if (extracted.length >= targetCount) {
                finish(null);
                return;
              }
            }
            current = null;
          }
        }
      }
    });

    gunzip.on("end", () => {
      finish(null);
    });

    netStream.pipe(byteCounter).pipe(gunzip);
  });
}

function chooseTwelveUtterances(decodedList) {
  // Pick 12 utterances whose total duration falls near 100-145 s and total words near 180-240.
  if (decodedList.length < 12) {
    throw new Error(`Only ${decodedList.length} clean FLEURS utterances available; expected >= 12.`);
  }
  const pool = decodedList.slice(0, Math.min(decodedList.length, 16));
  const targetCount = 12;
  let bestCombo = null;
  let bestScore = Infinity;
  const current = [];

  function search(startIdx) {
    if (current.length === targetCount) {
      const totalDur = current.reduce((s, x) => s + x.durationSec, 0) + (targetCount - 1) * 0.5;
      const totalWords = current.reduce((s, x) => s + x.words, 0);
      let penalty = 0;
      if (totalDur < 100) penalty += (100 - totalDur) * 4;
      else if (totalDur > 145) penalty += (totalDur - 145) * 4;
      if (totalWords < 180) penalty += (180 - totalWords) * 2;
      else if (totalWords > 240) penalty += (totalWords - 240) * 2;
      penalty += Math.abs(totalDur - 122) * 0.2 + Math.abs(totalWords - 210) * 0.15;
      if (penalty < bestScore) {
        bestScore = penalty;
        bestCombo = current.slice();
      }
      return;
    }
    const need = targetCount - current.length;
    for (let i = startIdx; i <= pool.length - need; i++) {
      current.push(pool[i]);
      search(i + 1);
      current.pop();
    }
  }
  search(0);
  return bestCombo;
}

function concatenateWithGaps(selected, gapSeconds = 0.18, seed = SEED + 777) {
  const gapLen = Math.round(SAMPLE_RATE * gapSeconds);
  const targetUttRms = 10 ** (-26.0 / 20);
  const rng = mulberry32(seed);
  const normClips = selected.map((u) => {
    let sq = 0;
    for (let i = 0; i < u.samples.length; i++) sq += u.samples[i] * u.samples[i];
    const rms = Math.sqrt(sq / Math.max(1, u.samples.length)) || 1e-12;
    const g = targetUttRms / rms;
    const out = new Float64Array(u.samples.length);
    for (let i = 0; i < u.samples.length; i++) out[i] = u.samples[i] * g;
    return out;
  });

  const totalLen =
    normClips.reduce((sum, cl) => sum + cl.length, 0) + gapLen * (normClips.length - 1);
  const joined = new Float64Array(totalLen);
  let cursor = 0;
  for (let i = 0; i < normClips.length; i++) {
    joined.set(normClips[i], cursor);
    cursor += normClips[i].length;
    if (i < normClips.length - 1) {
      // Fill inter-utterance pauses with subtle -62 dBFS comfort dither instead of digital zeros
      // so audio encoders do not misclassify speaker transitions as end-of-stream cutouts.
      for (let k = 0; k < gapLen; k++) {
        joined[cursor + k] = (rng() - 0.5) * 0.0015;
      }
      cursor += gapLen;
    }
  }

  // Ensure peak headroom <= 0.72 so added noise in Moderate/Noisy zones never clips
  let peak = 0;
  for (let i = 0; i < joined.length; i++) peak = Math.max(peak, Math.abs(joined[i]));
  if (peak > 0.72) {
    const headScale = 0.72 / peak;
    for (let i = 0; i < joined.length; i++) joined[i] *= headScale;
  }
  return joined;
}

function findNewestWavForFleursId(config, fleursId) {
  if (!fs.existsSync(RAW_DIR)) return null;
  const re = new RegExp(`^${config}_utt_\\d+_id${fleursId}\\.48k\\.wav$`);
  const candidates = fs
    .readdirSync(RAW_DIR)
    .filter((f) => re.test(f))
    .map((f) => {
      const fullPath = path.join(RAW_DIR, f);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates.length ? candidates[0].fullPath : null;
}

async function loadOrFetchLanguageSelection(langSpec) {
  const { language, config, seedOffset } = langSpec;
  const metaCachePath = path.join(RAW_DIR, `${config}_meta.json`);

  // 1. Try cached _meta.json (save/load 16 utterances offline)
  if (fs.existsSync(metaCachePath)) {
    const cached = JSON.parse(fs.readFileSync(metaCachePath, "utf8"));
    if (Array.isArray(cached) && cached.length >= 12 && cached.every((c) => fs.existsSync(c.wav48File))) {
      const decodedList = cached.map((c) => {
        const decoded = decodeWavOrRawPcm(fs.readFileSync(c.wav48File), SAMPLE_RATE);
        return { ...c, durationSec: decoded.samples.length / decoded.sampleRate, samples: decoded.samples };
      });
      const chosen = chooseTwelveUtterances(decodedList);
      console.log(`[FLEURS Cache] ${language}: loaded ${decodedList.length} cached clips from ${metaCachePath}.`);
      return {
        chosen,
        referenceText: chosen.map((c) => c.text).join(" "),
        fleursIds: chosen.map((c) => c.fleursId),
      };
    }
  }

  // 2. Fallback offline reconstruction from existing manifest_ru_kz_fleurs.json + RAW_DIR .48k.wav files
  if (fs.existsSync(MANIFEST_PATH)) {
    const prevManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    const match = prevManifest.find((m) => m.language === language && Array.isArray(m.fleursIds) && m.fleursIds.length >= 12);
    if (match) {
      const wavFiles = match.fleursIds.map((id) => ({ id, wav48File: findNewestWavForFleursId(config, id) }));
      if (wavFiles.every((w) => w.wav48File && fs.existsSync(w.wav48File))) {
        const chosen = wavFiles.map((w) => {
          const decoded = decodeWavOrRawPcm(fs.readFileSync(w.wav48File), SAMPLE_RATE);
          return {
            fleursId: w.id,
            wav48File: w.wav48File,
            durationSec: decoded.samples.length / decoded.sampleRate,
            samples: decoded.samples,
          };
        });
        const metaOut = chosen.map((c) => ({
          fleursId: c.fleursId,
          wav48File: c.wav48File,
          durationSec: c.durationSec,
        }));
        fs.writeFileSync(
          path.join(RAW_DIR, `${config}_selected_meta.json`),
          JSON.stringify({ fleursIds: match.fleursIds, referenceText: match.referenceText, clips: metaOut }, null, 2),
          "utf8",
        );
        console.log(
          `[FLEURS Cache] ${language}: reconstructed ${chosen.length} unique cached WAVs offline from ${MANIFEST_PATH} + RAW_DIR.`,
        );
        return {
          chosen,
          referenceText: match.referenceText,
          fleursIds: match.fleursIds,
        };
      }
    }
  }

  // 3. Network stream from Hugging Face FLEURS and save _meta.json
  const candidateMap = await fetchFleursTsvCandidates(config);
  const { extracted: decodedList, downloadedBytes } = await streamFleursTarGzCandidates(config, candidateMap, 16, 90 * 1024 * 1024);
  console.log(
    `[FLEURS] ${language}: extracted ${decodedList.length} clean clips using ${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB downloaded.`,
  );
  const metaToCache = decodedList.map(({ samples: _s, ...rest }) => rest);
  fs.writeFileSync(metaCachePath, JSON.stringify(metaToCache, null, 2), "utf8");
  const chosen = chooseTwelveUtterances(decodedList);
  return {
    chosen,
    referenceText: chosen.map((c) => c.text).join(" "),
    fleursIds: chosen.map((c) => c.fleursId),
    seedOffset,
  };
}

async function prepareLanguage(langSpec) {
  const { language, prefix, idPrefix, seedOffset } = langSpec;
  const { chosen, referenceText, fleursIds } = await loadOrFetchLanguageSelection(langSpec);
  const gapSec = 0.18;
  const chosenDur = chosen.reduce((s, x) => s + x.durationSec, 0) + (chosen.length - 1) * gapSec;
  const chosenWords = referenceText.trim().split(/\s+/).length;
  console.log(
    `[FLEURS] ${language}: selected ${chosen.length} IDs [${fleursIds.join(", ")}] -> ${chosenDur.toFixed(2)}s, ${chosenWords} words`,
  );

  const cleanSpeech = concatenateWithGaps(chosen, gapSec, SEED + seedOffset + 77);

  // Quiet zone: unmodified -24.0 dBFS FLEURS speech
  const quietRel = `benchmarks/audio/${prefix}_01_quiet.wav`;
  fs.writeFileSync(path.resolve(quietRel), encodeWavPcm16(cleanSpeech, SAMPLE_RATE));
  const quietHpf = applyHighPassBiquad(cleanSpeech, SAMPLE_RATE, 120, 0.707);
  const qM = computeAcousticMetrics(cleanSpeech, SAMPLE_RATE, quietHpf);
  const qH = computeAcousticMetrics(quietHpf, SAMPLE_RATE);
  console.log(
    `  -> Quiet: Raw=${qM.rmsDbfs} dBFS, SNR_bb ${qM.broadbandSnrDb} -> ${qH.broadbandSnrDb} dB, Sub-120Hz=${qM.sub120HzPct}%`,
  );

  // Moderate HVAC zone: 55/78/102 Hz + LPF<110Hz pink (80% of noise power) + pink broadband (20%) -> SNR_bb ~15.0 dB
  const modRumble = generateRumbleSignal(cleanSpeech.length, SAMPLE_RATE, [55, 78, 102], 110, SEED + seedOffset + 1);
  const modPink = generatePinkNoise(cleanSpeech.length, SEED + seedOffset + 2);
  const modRes = calibrateZoneMix(cleanSpeech, modRumble, modPink, 15.0, 0.80);
  const modRel = `benchmarks/audio/${prefix}_02_moderate.wav`;
  fs.writeFileSync(path.resolve(modRel), encodeWavPcm16(modRes.mixed, SAMPLE_RATE));
  console.log(
    `  -> Moderate: Raw=${modRes.rawMetrics.rmsDbfs} dBFS, SNR_bb ${modRes.rawMetrics.broadbandSnrDb} -> ${modRes.hpfMetrics.broadbandSnrDb} dB, Sub-120Hz=${modRes.rawMetrics.sub120HzPct}%`,
  );

  // Noisy HVAC zone: 50/72/96/112 Hz + LPF<115Hz pink (88% of noise power) + pink broadband (12%) -> SNR_bb ~7.5 dB
  const noisyRumble = generateRumbleSignal(cleanSpeech.length, SAMPLE_RATE, [50, 72, 96, 112], 115, SEED + seedOffset + 3);
  const noisyPink = generatePinkNoise(cleanSpeech.length, SEED + seedOffset + 4);
  const noisyRes = calibrateZoneMix(cleanSpeech, noisyRumble, noisyPink, 7.5, 0.88);
  const noisyRel = `benchmarks/audio/${prefix}_03_noisy.wav`;
  fs.writeFileSync(path.resolve(noisyRel), encodeWavPcm16(noisyRes.mixed, SAMPLE_RATE));
  console.log(
    `  -> Noisy: Raw=${noisyRes.rawMetrics.rmsDbfs} dBFS, SNR_bb ${noisyRes.rawMetrics.broadbandSnrDb} -> ${noisyRes.hpfMetrics.broadbandSnrDb} dB, Sub-120Hz=${noisyRes.rawMetrics.sub120HzPct}%`,
  );

  return [
    { id: `${idPrefix}_01_QUIET`, language, zone: "Quiet", wavPath: quietRel, fleursIds, referenceText },
    { id: `${idPrefix}_02_MODERATE`, language, zone: "Moderate", wavPath: modRel, fleursIds, referenceText },
    { id: `${idPrefix}_03_NOISY`, language, zone: "Noisy", wavPath: noisyRel, fleursIds, referenceText },
  ];
}

async function main() {
  if (!fs.existsSync(FFMPEG_BIN)) {
    throw new Error(`Missing ffmpeg binary at ${FFMPEG_BIN}`);
  }
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const ruEntries = await prepareLanguage({
    language: "Russian",
    config: "ru_ru",
    prefix: "ru",
    idPrefix: "RU",
    seedOffset: 100,
  });

  const kzEntries = await prepareLanguage({
    language: "Kazakh",
    config: "kk_kz",
    prefix: "kz",
    idPrefix: "KZ",
    seedOffset: 200,
  });

  const manifest = [...ruEntries, ...kzEntries];
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\nWrote ${MANIFEST_PATH} (${manifest.length} paired entries).`);

  if (fs.existsSync(EN_MANIFEST_PATH)) {
    const enEntries = JSON.parse(fs.readFileSync(EN_MANIFEST_PATH, "utf8"));
    const allManifest = [...enEntries, ...manifest];
    fs.writeFileSync(ALL_MANIFEST_PATH, JSON.stringify(allManifest, null, 2), "utf8");
    console.log(`Wrote ${ALL_MANIFEST_PATH} (${allManifest.length} paired entries).`);
  }
}

await main();
