# Reference Transcripts & Reproducibility Provenance

## 1. English Student Presentation Recordings (`EN_01_STATS` to `EN_04_BUMPS`)
- **Files:** `EN_01_STATS.txt`, `EN_02_SOURCES.txt`, `EN_03_MUSEUM.txt`, `EN_04_BUMPS.txt`
- **How references were created:** Each file contains the exact prepared English presentation script written by the student team for their History coursework presentations (`EN_01_STATS` to `EN_04_BUMPS`), verified against audio playback by listening so spoken deviations, phrasing, and numerals match what was actually recorded without using any ASR output (`Gemini` or `Whisper`) as a draft.
- **Notice verbatim speaker slip in `EN_04_BUMPS`:** In `EN_04_BUMPS.txt`, the phrase `"over 1.2 billion residents"` reflects the exact spoken slip made by the presenter on the audio recording (kept verbatim for honest WER scoring).
- **Audio withholding policy:** Raw student audio files (`benchmarks/audio/*.wav`, `.m4a`) are excluded from public Git commits pending explicit written audio publication consent (`Informed_Consent_Form_L-easy.docx`).

## 2. Russian & Kazakh Google FLEURS Benchmarks (`RU_01..RU_03`, `KZ_01..KZ_03`)
- **Corpus:** `google/fleurs` (CC-BY-4.0), `test` split (`ru_ru` and `kk_kz`), prepared by `scripts/prepare_fleurs_multilingual.mjs`.
- **Selected Test IDs (`12` unique utterances per language):**
  - `ru_ru`: `[1917, 1751, 1692, 1757, 1791, 1762, 1668, 1780, 1822, 1763, 1884, 1768]` (`122.64 s`, `208` normalized reference tokens).
  - `kk_kz`: `[1788, 1708, 1994, 1956, 1886, 1859, 1691, 1664, 1692, 1746, 1686, 1844]` (`171.42 s`, `201` normalized reference tokens).
- **Deterministic acoustic mixing (`seed = 20270224`):**
  - Utterances are RMS-normalized (`-26 dBFS`) and separated by `0.18 s` of low-level `-62 dBFS` comfort dither.
  - `Quiet`: clean concatenated FLEURS speech (no artificial noise).
  - `Moderate`: additive `50–112 Hz` hum + sub-115 Hz pink noise + broadband room noise calibrated to `SNR_bb = 15.0 dB`.
  - `Noisy`: same profile calibrated to `SNR_bb = 7.5 dB`.
- Exact utterance transcriptions and aggregate metrics are published in `benchmarks/manifest_ru_kz_fleurs.json`, `benchmarks/results_all_10.csv`, `benchmarks/summary_all_10.md`, and `benchmarks/stats_all_10.json`.
