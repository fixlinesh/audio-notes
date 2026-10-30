# Assignment 4 — 6-Minute Defense Script & Individual Q&A Guide (Task 6 — 10%)

**Project:** `L-easy — Audio Recognition-Centric Lecture Assistant with Smart Classroom Acoustic Telemetry`  
**Academic Group & Program:** `Group IT-2613 · Computer Science (Astana IT University)`  
**Live Competition Link (Opens Without Login):** `https://audio-notes-6wbf.vercel.app`  
**Team Members:**
1. **Auelbek Zhibek** — User Research, 5-Stage Customer Journey Map (CJM), Literature Review & Data Analysis
2. **Klenov Askhat** — Frontend React 19 PWA, Smart Acoustic Sensor UI, Usability Testing ($N=5$) & A1 Poster Design
3. **Amangeldinov Yeraly** — System Architecture, Cloud PostgreSQL 15 Database, Row-Level Security (RLS) & Serverless Gemini API

---

## Part 1: 2-Minute Poster Explanation (Shared by All 3 Team Members)

> **Rule Reminder:** Every team member must speak during the 2-minute poster walkthrough and state **1 sentence about their own contribution**. Point directly to the numbered blocks (`1` through `11`) on `Assignment_4_Poster_A1.pdf`.

### ⏱️ 0:00 – 0:25 | Title, Problem & Target Users (Blocks 1 & 2) — *Speaker: Auelbek Zhibek*
**English Speech:**
> "Good afternoon, respected jury! We are Team **L-easy** from Group **IT-2613 (Computer Science)** at Astana IT University (**Block 1**). University STEM lectures in English, Russian, and Kazakh run at 135 to 160 words per minute in reverberant halls. As shown in **Block 2**, our target persona **Aruzhan (age 19, CS student)** cannot simultaneously listen, translate unfamiliar terms, and write structured notes without missing key explanations."

### ⏱️ 0:25 – 0:50 | Evidence from Research & Existing Solutions (Blocks 3 & 4) — *Speaker: Auelbek Zhibek*
**English Speech:**
> "In **Block 3**, our baseline survey ($N=8$) proved that **75%** of students fail to listen and take notes simultaneously, and **62.5%** struggle with foreign terminology, while peer-reviewed studies by Radford et al. [1] and Kurdi et al. [12] show active-recall quizzes boost retention by **40%**. In **Block 4**, we compared Otter.ai, Notta, Fireflies, and Knowt—none of them combine Kazakh/Russian/English support with a real-time classroom acoustic noise sensor. **My personal contribution** was conducting the literature review, designing the 5-stage Customer Journey Map in **Block 5**, and building the Task 4 Excel Data and Analysis sheets."

### ⏱️ 0:50 – 1:20 | Proposed Solution, CJM, Tech Stack & Smart Sensor (Blocks 5, 6 & 7) — *Speaker: Amangeldinov Yeraly*
**English Speech:**
> "To solve this, **Block 5** and **Block 6** show our 4-tier cloud architecture. When a student enters a noisy lecture hall above **60 dB**, L-easy's **Web Audio API Smart Acoustic Sensor** measures ambient decibels (dB) and Signal-to-Noise Ratio (SNR) in real time and automatically engages a hardware-accelerated **Biquad high-pass noise filter**. Behind Vercel serverless functions and Google Gemini 2.5 Flash, all data is persisted in a 5-table **Supabase PostgreSQL 15** database (`recordings`, `flashcards`, `quiz_questions`, `smart_audio_telemetry`, and `journey_support_logs`) protected by kernel-level Row-Level Security (`auth.uid() = user_id`). **My personal contribution** was engineering the PostgreSQL schema, RLS policies, SQL analytical queries, and the Gemini serverless API pipeline."

### ⏱️ 1:20 – 1:45 | Testing, Improvements & Quantitative Results (Blocks 8 & 9) — *Speaker: Klenov Askhat*
**English Speech:**
> "In **Block 7**, all core screens work live today. As shown in **Block 8**, we tested L-easy with **$N=5$ external university students**. Based on their feedback, we made two concrete before/after improvements: first, we removed the login wall by adding **Open Jury Demo Mode** and a **1-Tap Classroom Simulation**, cutting task completion time by **40.8%** (from **142 seconds to 84 seconds**) with **100% (5/5) success**; second, we added the live dB/SNR sensor strip, raising our SUS score from **73.5 to 84.5 (Grade A)**. In **Block 9**, our 20-session telemetry analysis proves the Smart Biquad Filter boosts noisy-hall ASR accuracy from **76.4% to 91.1% (+14.7%)** and cuts exam prep time by **68%**."

### ⏱️ 1:45 – 2:00 | Live Link, QR Code & Next Steps (Blocks 9, 10 & 11) — *Speaker: Klenov Askhat*
**English Speech:**
> "**My personal contribution** was building the React 19 PWA interface, integrating the Web Audio acoustic sensor bar, and running the usability tests. You can scan the QR code in **Block 10** right now—`audio-notes-6wbf.vercel.app` opens immediately without a login on any phone or laptop!"

---

## Part 2: 2-Minute Live Product Demonstration (`https://audio-notes-6wbf.vercel.app`)

> **Goal:** Show the main user scenario in **5 clear steps** (plus where Assignment 3 database rows and Assignment 4 smart telemetry data live).

1. **Step 1 — Instant Access Without Login (0:00 – 0:20):**
   - Open `https://audio-notes-6wbf.vercel.app` (or ask the jury to scan the QR code on Block 10).
   - Point out the **Green Banner** at the top: *"Competition Jury Demo Mode (No Login Required)"* and the 3 pre-loaded AITU STEM lectures (`CS101 · Graph Theory & Dijkstra`, `AI202 · Attention & Transformers`, `DB301 · Database Normalization & RLS`).
2. **Step 2 — Smart Classroom Acoustic Sensor & 1-Tap Simulation (0:20 – 0:50):**
   - Click **"Start Recording"** (or the Microphone tab).
   - Point to the **Smart Classroom Acoustic Telemetry Sensor (Task 4)** card showing live **Ambient Noise (dB)**, **SNR Clarity (+dB)**, and **Biquad High-Pass Filter: Auto-Active**.
   - Click **"⚡ 1-Tap Classroom Simulation"** (or record 5 seconds of live voice) so the jury sees the 4-stage AI pipeline (`Audio Capture → Speech-to-Text → Multilingual Summary → Quiz & Flashcards`) complete in ~2 seconds.
3. **Step 3 — Multilingual Summary & Glossary (EN / RU / KZ) (0:50 – 1:15):**
   - Open the generated lecture note. Switch between **Original** and **Simplified** explanations, scroll through the **Key Points** and **Key Terms Glossary**, and click **Print / Save PDF**.
4. **Step 4 — Active Recall Quiz (8 Questions), TTS Flashcards & AI Teacher (1:15 – 1:40):**
   - Open the **AI Teacher / Self-Check** tab.
   - Answer 1 question in the **8-question Quiz** (showing instant green/red explanation feedback), flip a **Flashcard** with voice Text-to-Speech (`🔊`), and ask the **AI Teacher** a quick question about the lecture.
5. **Step 5 — Cloud PostgreSQL Database & Smart Telemetry Inspector (A3 + A4) (1:40 – 2:00):**
   - Return to **Home** and click **"Inspect DB & Telemetry"** on the dark card (`Smart Sensor & Data Layer · Working Live`).
   - Show the jury the 5 PostgreSQL tables on `qcathxqziocmdjqflrsv.supabase.co`, the **20-session acoustic zone analysis table** (`Quiet 96.7%`, `Moderate 93.9%`, `Noisy Filter ON 91.1%` vs `Filter OFF 76.4%`), and the honest **Done / Partly / Planned** status table.

---

## Part 3: 2-Minute Individual Q&A Preparation (Expected Jury Questions & Answers)

### Questions for **Amangeldinov Yeraly** (Database, Architecture & Security)
1. **Q: Where is your data stored, and how did your database change from Assignment 3 to Assignment 4?**
   - **A:** All data is stored in **PostgreSQL 15 on Supabase Cloud** (`qcathxqziocmdjqflrsv.supabase.co`). In Assignment 3 we had 4 tables (`auth.users`, `recordings`, `flashcards`, `quiz_questions`). In Assignment 4 (`assignment4_database.sql`), we added 2 new normalized tables linked by foreign keys: `smart_audio_telemetry` (storing ambient dB, SNR, WPM, Biquad filter status, and ASR accuracy) and `journey_support_logs` (tracking CJM stages 1–5, task time, and SUS scores).
2. **Q: How do you protect student privacy and prevent SQL injection or unauthorized data access?**
   - **A:** First, every table enforces kernel-level **Row-Level Security (RLS)** using `(select auth.uid()) = user_id`, so a user can never read or delete another student's lectures. Second, all queries use parameterized PostgREST prepared statements. Third, our `GEMINI_API_KEY` is isolated inside Vercel serverless functions (`/api/*`), never exposed in the browser.

### Questions for **Klenov Askhat** (Frontend, Smart Sensor & Usability Testing)
1. **Q: How does the Smart Classroom Acoustic Sensor work in the browser?**
   - **A:** It uses the browser's native **Web Audio API** (`AudioContext`, `AnalyserNode`, and `BiquadFilterNode`). While recording, it samples the frequency spectrum in RAM to calculate ambient noise in decibels (dB) and Signal-to-Noise Ratio (SNR). When classroom noise exceeds 60 dB, the high-pass Biquad filter attenuates low-frequency HVAC hum and room reverberation before speech transcription.
2. **Q: What usability problems did you find during testing, and what changed Before vs. After?**
   - **A:** We tested with $N=5$ external AITU students. First, users were slowed down by the mandatory login screen (mean task time 142 s, 80% completion). We added **Zero-Login Jury Demo Mode** and a **1-Tap Simulation button**, dropping task time to **84 s (-40.8%)** with **100% completion**. Second, users in noisy rooms didn't know if noise filtering was active, so we added the live **dB/SNR sensor strip**, raising noisy ASR accuracy from **76.4% to 91.1%** and SUS from **73.5 to 84.5**.

### Questions for **Auelbek Zhibek** (User Research, CJM & Data Analysis)
1. **Q: Walk us through your Customer Journey Map (CJM). Where was the biggest pain point?**
   - **A:** Our CJM follows Persona **Aruzhan (age 19, AITU CS student)** across 5 stages: (1) Awareness in a fast 145 WPM lecture, (2) Searching & opening the zero-install PWA via QR code, (3) Initial Setup in a noisy 64 dB lecture hall, (4) Daily Usage for EN/RU/KZ notes and quizzes, and (5) Support & cloud PDF export. The biggest pain points were **Stage 2 (sign-up friction)** and **Stage 3 (64 dB classroom noise)**, which we solved with Zero-Login Demo Mode and automatic Biquad noise filtering.
2. **Q: What did your Excel / SQL data analysis of the 20 lecture sessions show?**
   - **A:** Across $N=20$ sessions in our `Data` and `Analysis` sheets, quiet rooms (<45 dB) achieved **96.7%** ASR accuracy. In noisy lecture halls (>60 dB) without filtering, SNR dropped to **+5.4 dB** and ASR accuracy fell to **76.4%** (quiz average **68.5%**). With L-easy's Smart Filter active in noisy halls, SNR improved to **+12.9 dB**, ASR accuracy rose to **91.1% (+14.7%)**, and student quiz scores rose to **84.0% (+15.5%)**.
