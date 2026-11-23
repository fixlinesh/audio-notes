# Paired Acoustic Filtering & ASR Benchmark (all_10, geminiRuns=5)

| Recording ID | Lang | Zone | Dur (s) | Ref Words | SNR_bb Raw -> HPF (dB) | Gemini Raw WER (%) | Gemini HPF WER (%) | Gemini Errs (R->H) | Whisper-Large-v3T WER (R->H) | Whisper-Base WER (R->H) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| EN_01_STATS | English | Quiet | 89.09 | 208 | 27.58 -> 27.59 | 6.25±1.52 | 5.67±1.42 | 13 -> 11.8 | 8.17 -> 8.65 | 24.52 -> 23.08 |
| EN_02_SOURCES | English | Moderate | 127.47 | 282 | 30.29 -> 30 | 10.56±1.19 | 9.29±0.95 | 29.8 -> 26.2 | 10.64 -> 17.73 | 21.63 -> 21.28 |
| EN_03_MUSEUM | English | Noisy_1 | 152.41 | 275 | 28.47 -> 28.77 | 3.93±0.9 | 4.51±1.05 | 10.8 -> 12.4 | 5.45 -> 5.82 | 12.36 -> 18.55 |
| EN_04_BUMPS | English | Noisy_2 | 137.9 | 299 | 29.92 -> 30.44 | 10.3±1.09 | 9.63±1.02 | 30.8 -> 28.8 | 9.7 -> 9.36 | 22.41 -> 20.74 |
| RU_01_QUIET | Russian | Quiet | 122.64 | 208 | 38.19 -> 43.54 | 5±1.05 | 4.62±0.55 | 10.4 -> 9.6 | 6.73 -> 8.17 | 33.65 -> 33.17 |
| RU_02_MODERATE | Russian | Moderate | 122.64 | 208 | 15 -> 20.13 | 7.5±1.58 | 5.87±1.33 | 15.6 -> 12.2 | 11.54 -> 12.5 | 34.62 -> 33.17 |
| RU_03_NOISY | Russian | Noisy | 122.64 | 208 | 7.51 -> 12.36 | 14.52±1.2 | 19.13±1.29 | 30.2 -> 39.8 | 17.79 -> 17.31 | 47.6 -> 47.6 |
| KZ_01_QUIET | Kazakh | Quiet | 171.42 | 201 | 53.9 -> 55.02 | 15.52±4.79 | 15.52±5.94 | 31.2 -> 31.2 | 28.86 -> 24.88 | 179.6 -> 155.72 |
| KZ_02_MODERATE | Kazakh | Moderate | 171.42 | 201 | 15.01 -> 20.25 | 25.97±5.91 | 16.92±7.81 | 52.2 -> 34 | 52.74 -> 48.76 | 180.1 -> 134.83 |
| KZ_03_NOISY | Kazakh | Noisy | 171.42 | 201 | 7.51 -> 12.32 | 16.32±2.42 | 17.71±2.07 | 32.8 -> 35.6 | 58.21 -> 70.65 | 133.83 -> 158.71 |
| **English Mean±SD** | **English** | **N=4** | 126.72 ± 27.09 | 266 ± 39.96 | 29.07 ± 1.26 -> 29.2 ± 1.29 | 7.76 ± 3.23 | 7.28 ± 2.57 | 21.1 ± 10.67 -> 19.8 ± 8.96 | 8.49 ± 2.27 -> 10.39 ± 5.13 | 20.23 ± 5.39 -> 20.91 ± 1.87 |
| **Russian Mean±SD** | **Russian** | **N=3** | 122.64 ± 0 | 208 ± 0 | 20.23 ± 16 -> 25.34 ± 16.23 | 9.01 ± 4.94 | 9.87 ± 8.04 | 18.73 ± 10.27 -> 20.53 ± 16.74 | 12.02 ± 5.55 -> 12.66 ± 4.57 | 38.62 ± 7.79 -> 37.98 ± 8.33 |
| **Kazakh Mean±SD** | **Kazakh** | **N=3** | 171.42 ± 0 | 201 ± 0 | 25.47 ± 24.9 -> 29.2 ± 22.71 | 19.27 ± 5.82 | 16.72 ± 1.11 | 38.73 ± 11.69 -> 33.6 ± 2.23 | 46.6 ± 15.61 -> 48.1 ± 22.89 | 164.51 ± 26.57 -> 149.75 ± 13.01 |

## Paired Wilcoxon Signed-Rank & Sign Test Summary (Raw vs. 120 Hz HPF)

- **geminiWer (N=10, n_eff=9, exact_twosided)**: improved=6, worsened=3, tied=1 | W=16.5, exact p=0.52 (0.5156), approx p=0.4768, Sign test p=0.51
- **geminiErr (N=10, n_eff=9, exact_twosided)**: improved=6, worsened=3, tied=1 | W=16, exact p=0.50 (0.4961), approx p=0.4413, Sign test p=0.51
- **whisperLargeWer (N=10, n_eff=10, exact_twosided)**: improved=4, worsened=6, tied=0 | W=19.5, exact p=0.45 (0.4492), approx p=0.4142, Sign test p=0.75
- **whisperLargeErr (N=10, n_eff=10, exact_twosided)**: improved=4, worsened=6, tied=0 | W=20, exact p=0.49 (0.4941), approx p=0.4413, Sign test p=0.75
- **whisperBaseWer (N=10, n_eff=9, exact_twosided)**: improved=7, worsened=2, tied=1 | W=14, exact p=0.36 (0.3594), approx p=0.3139, Sign test p=0.18
- **whisperBaseErr (N=10, n_eff=9, exact_twosided)**: improved=7, worsened=2, tied=1 | W=14, exact p=0.34 (0.3438), approx p=0.3131, Sign test p=0.18