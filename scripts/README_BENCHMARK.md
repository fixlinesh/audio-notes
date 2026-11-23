# Reproducible Paired Multilingual ASR & Filtering Benchmark (L-easy)

This harness executes paired acoustic evaluation (`Raw` vs. second-order `120 Hz` Butterworth high-pass Biquad filter, `Q = 0.707`) on identical WAV sources with normalized Levenshtein WER/CER, exact two-sided Wilcoxon signed-rank tests, and binomial sign tests.

## 1. Datasets & Track Preparation
- **English (`EN_01_STATS` to `EN_04_BUMPS`)**: Real coursework presentation clips paired with reference scripts verified manually against audio playback in `benchmarks/reference_transcripts/` (raw student audio is excluded pending publication consent).
- **Russian & Kazakh (`RU_01`–`RU_03`, `KZ_01`–`KZ_03`)**: 12 concatenated test utterances per language from open CC-BY-4.0 **Google FLEURS** (`benchmarks/manifest_ru_kz_fleurs.json`) mixed deterministically (`seed = 20270224`) by `scripts/prepare_fleurs_multilingual.mjs` into Quiet, Moderate (`~15 dB SNR_bb`), and Noisy (`~7.5 dB SNR_bb`) sub-115 Hz HVAC + room noise profiles.

## 2. Reproducing Results
```bash
# Offline unit & DSP sanity checks:
node scripts/wer_benchmark.mjs --dry-run

# Reconstruct deterministic RU/KZ 3-zone WAVs from FLEURS metadata/cache:
node scripts/prepare_fleurs_multilingual.mjs

# Strict single-model 5-run Gemini benchmark (requires GEMINI_API_KEY in .env) + local Whisper Large-v3-Turbo & Base:
node scripts/wer_benchmark.mjs benchmarks/manifest_all_10.json --gemini-runs 5 --strict-model --local-whisper --out-prefix all_10
```

Published outputs:
- `benchmarks/results_all_10.csv`
- `benchmarks/summary_all_10.md`
- `benchmarks/stats_all_10.json`
