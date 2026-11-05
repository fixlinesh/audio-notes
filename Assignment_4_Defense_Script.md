# Assignment 4 — Полный сценарий защиты на Русском и Английском (Task 6 — 10%)

**Project:** `L-easy — Audio Recognition-Centric Lecture Assistant with Smart Classroom Acoustic Telemetry`  
**Academic Group & Program:** `Group IT-2613 · Computer Science (Astana IT University)`  
**Live Competition Link (открывается без логина):** `https://audio-notes-6wbf.vercel.app`  

**Состав команды и роли:**
1. **Auelbek Zhibek (Ауелбек Жибек)** — User Research, 5-Stage Customer Journey Map (CJM), Literature Review & Data Analysis
2. **Amangeldinov Yeraly (Амангельдинов Ералы)** — System Architecture, Cloud PostgreSQL 15 Database, Row-Level Security (RLS) & Serverless Gemini API
3. **Klenov Askhat (Кленов Асхат)** — Frontend React 19 PWA, Smart Acoustic Sensor UI, Usability Testing ($N=5$) & A1 Poster Design

---

## 🇷🇺 ВАРИАНТ 1: ПОЛНАЯ РЕЧЬ НА РУССКОМ ЯЗЫКЕ (6 минут)

### Часть 1: Защита постера A1 (2 минуты — говорят все 3 участника)

> **Важное правило Task 6:** Во время 2-минутного рассказа по постеру (`Assignment_4_Poster_A1.pdf`) должен выступить **каждый из трёх участников**, показывая рукой на блоки `1`–`11`, и каждый обязательно произносит **1 предложение о своём личном вкладе**.

#### ⏱️ 0:00 – 0:50 | Блоки 1, 2, 3 и 4 (Проблема, пользователи, доказательства и конкуренты) — *Спикер 1: Жибек (Auelbek Zhibek)*
> «Здравствуйте, уважаемый преподаватель и жюри! Мы команда проекта **L-easy** из группы **IT-2613, Computer Science**, Astana IT University (**Блок 1**).  
> В **Блоке 2** показана наша главная проблема: университетские STEM-лекции на английском, русском и казахском языках идут со скоростью **135–160 слов в минуту** в шумных аудиториях. Наша целевая персона — **Аружан, 19 лет, студентка CS** — физически не успевает одновременно слушать лектора, переводить сложные термины и писать конспект.  
> В **Блоке 3** приведены доказательства: наш опрос показал, что **75%** студентов теряют нить лекции при ведении заметок, а **62.5%** испытывают трудности с терминологией. При этом научные работы Radford et al. [1] и Kurdi et al. [12] доказывают, что автоматические тесты повышают запоминание материала на **40%**.  
> В **Блоке 4** мы сравнили конкурентов — *Otter.ai, Notta, Fireflies и Knowt*: ни один из них не объединяет поддержку трёх языков (EN/RU/KZ), генерацию тестов и умный датчик акустики аудитории.  
> **Мой личный вклад в проект** — проведение обзора литературы из 18 источников, разработка 5-этапной карты пути пользователя (Customer Journey Map) в **Блоке 5** и статистический анализ данных в Excel».

---

#### ⏱️ 0:50 – 1:20 | Блоки 5, 6 и 7 (Решение, CJM, Архитектура, БД и Умный датчик) — *Спикер 2: Ералы (Amangeldinov Yeraly)*
> «Спасибо, Жибек! В **Блоках 5 и 6** показаны наше решение и 4-уровневая облачная архитектура. Когда студент включает запись в шумной потоковой аудитории (свыше **60 дБ**), наш **умный акустический сенсор на базе Web Audio API** в реальном времени измеряет уровень фонового шума в децибелах (dB) и отношение сигнал/шум (SNR), автоматически включая аппаратный фильтр высоких частот **Biquad High-Pass Filter**.  
> Далее серверные функции **Vercel** и модель **Google Gemini** формируют структурированный конспект, глоссарий, флеш-карточки и тест из 8 вопросов.  
> Все данные хранятся в облачной базе **PostgreSQL 15 на Supabase** из 5 связанных таблиц: к таблицам из Assignment 3 (`recordings`, `flashcards`, `quiz_questions`) мы добавили две новые таблицы для Task 4 — `smart_audio_telemetry` (для логов шума dB, SNR и точности ASR) и `journey_support_logs`, защищённые на уровне ядра политиками **Row-Level Security (`auth.uid() = user_id`)**.  
> **Мой личный вклад в проект** — проектирование облачной базы данных PostgreSQL, настройка безопасности RLS, написание SQL-запросов и разработка серверного API на Vercel».

---

#### ⏱️ 1:20 – 2:00 | Блоки 7, 8, 9, 10 и 11 (Функции, тестирование, результаты и QR-код) — *Спикер 3: Асхат (Klenov Askhat)*
> «Спасибо, Ералы! В **Блоке 7** представлены скриншоты всех работающих экранов нашего приложения.  
> В **Блоке 8** показаны результаты юзабилити-тестирования с **5 независимыми студентами AITU**. По их отзывам мы внедрили два ключевых улучшения *До / После*: во-первых, убрали обязательную регистрацию на входе, добавив **Open Jury Demo Mode** и кнопку симуляции в 1 клик, что сократило время выполнения сценария на **40.8%** (со **142 до 84 секунд**) при **100% успешности (5 из 5)**; во-вторых, добавили живую шкалу акустического датчика dB/SNR, повысив оценку удобства SUS с **73.5 до 84.5 баллов (уровень Grade A)**.  
> В **Блоке 9** наш анализ 20 лекционных сессий доказал, что умный фильтр Biquad повышает точность распознавания речи в шумных залах с **76.4% до 91.1% (+14.7%)** и сокращает время подготовки к экзаменам на **68%**.  
> **Мой личный вклад в проект** — разработка фронтенда на React 19 и Tailwind CSS, реализация визуального акустического сенсора, проведение тестов и верстка постера A1.  
> Сейчас вы можете отсканировать **QR-код в Блоке 10** — сайт `audio-notes-6wbf.vercel.app` открывается мгновенно без логина, и мы переходим к живой демонстрации!»

---

### Часть 2: Живая демонстрация продукта (2 минуты — на экране или телефоне)

> **Кто кликает и комментирует:** Асхат и Ералы (показывают сайт `https://audio-notes-6wbf.vercel.app`).

1. **Шаг 1 (0:00 – 0:20) — Вход без логина (Open Jury Demo Mode):**
   * *Слова (Асхат):* «Мы открываем рабочую ссылку `audio-notes-6wbf.vercel.app`. Как требуют правила конкурса, сайт открывается **сразу без регистрации и пароля** в режиме *Competition Jury Demo Mode*. Здесь уже предзагружены 3 реальные лекции AITU (Алгоритм Дейкстры, Трансформеры в ИИ и Нормализация БД)».
2. **Шаг 2 (0:20 – 0:50) — Умный акустический датчик и запись / симуляция:**
   * *Слова (Асхат):* «Переходим на вкладку **Запись (Record)**. Здесь в реальном времени работает наш **Smart Classroom Acoustic Telemetry Sensor (Task 4)**: он показывает уровень шума в децибелах (Ambient Noise dB), чистоту сигнала SNR и статус фильтра **Biquad High-Pass Filter: Auto-Active**. Нажимаем кнопку **⚡ 1-Tap Classroom Simulation** (или загружаем файл), и за 3 секунды ИИ проходит все 4 стадии обработки».
3. **Шаг 3 (0:50 – 1:15) — Умный конспект, термины и экспорт в PDF:**
   * *Слова (Жибек):* «Открываем готовую лекцию во вкладке **Конспект (Notes)**. Студент может переключаться между академическим (**Original**) и простым (**Simplified**) объяснением, изучать ключевые тезисы (**Key Points**), глоссарий терминов на русском, английском или казахском языках и в один клик сохранить красивый PDF-конспект».
4. **Шаг 4 (1:15 – 1:40) — Тест из 8 вопросов, карточки с озвучкой и ИИ-преподаватель:**
   * *Слова (Ералы):* «Переходим во вкладку **ИИ-Учитель и Самопроверка (Study / AI Teacher)**. Здесь автоматически сгенерирован тест из **8 вопросов** с мгновенным объяснением правильного ответа, флеш-карточки для активного припоминания с голосовой озвучкой (Text-to-Speech) и диалоговый чат с ИИ-преподавателем строго по контексту лекции».
5. **Шаг 5 (1:40 – 2:00) — Инспектор базы данных PostgreSQL и телеметрии (Assignment 3 + Assignment 4):**
   * *Слова (Ералы):* «Возвращаемся на главный экран и нажимаем **Inspect DB & Telemetry**. Здесь наглядно показано, где хранятся данные в **Supabase PostgreSQL 15**, приведена сводная таблица анализа 20 сессий по акустическим зонам и честная таблица статуса функций **Done / Partly / Planned**».

---

### Часть 3: Ответы на индивидуальные вопросы жюри на Русском (2 минуты)

#### Вопросы для **Ералы (Amangeldinov Yeraly — БД, Архитектура, Безопасность):**
* **Вопрос 1: Где хранятся ваши данные и как изменилась база данных в Assignment 4 по сравнению с Assignment 3?**
  * **Ответ:** «Все данные хранятся в облачной реляционной СУБД **PostgreSQL 15 на платформе Supabase** (`qcathxqziocmdjqflrsv.supabase.co`). В Assignment 3 у нас было 4 таблицы (`auth.users`, `recordings`, `flashcards`, `quiz_questions`). В Assignment 4 мы обновили схему (`assignment4_database.sql`) и добавили 2 новые таблицы со связями `FOREIGN KEY ... ON DELETE CASCADE`: таблицу `smart_audio_telemetry` (хранит уровень шума в дБ, SNR, скорость речи WPM, статус фильтра Biquad и точность ASR) и таблицу `journey_support_logs` (логирует прохождение этапов CJM и время выполнения задачи)».
* **Вопрос 2: Как обеспечивается кибербезопасность и защита от утечки ключей ИИ?**
  * **Ответ:** «Во-первых, на всех таблицах PostgreSQL включена защита на уровне ядра **Row-Level Security (RLS)** с политикой `auth.uid() = user_id`, что исключает доступ к чужим лекциям (защита от IDOR). Во-вторых, все запросы параметризованы через PostgREST, что полностью блокирует SQL-инъекции. В-третьих, ключ `GEMINI_API_KEY` хранится исключительно в серверных переменных окружения Vercel и никогда не попадает в браузер клиента».

#### Вопросы для **Асхата (Klenov Askhat — Фронтенд, Умный датчик, Тестирование):**
* **Вопрос 1: Как именно работает ваш умный акустический датчик в браузере?**
  * **Ответ:** «Он реализован через нативный браузерный **Web Audio API** (`AudioContext`, `AnalyserNode` и `BiquadFilterNode`). Во время записи микрофона анализатор в оперативной памяти считывает амплитудно-частотный спектр, вычисляет уровень фонового шума в децибелах (dB) и отношение сигнал/шум (SNR). Если шум в аудитории превышает 60 дБ, автоматически включается фильтр верхних частот (`BiquadFilterNode`), который отсекает низкочастотный гул проекторов, вентиляции и эхо аудитории перед отправкой на транскрибацию».
* **Вопрос 2: Какие проблемы вы нашли при тестировании на пользователях и что изменили?**
  * **Ответ:** «Мы протестировали продукт на 5 студентах AITU вне нашей команды. Первая проблема: экран обязательной регистрации задерживал пользователей (среднее время прохождения составляло 142 секунды, успешность 80%). Мы добавили **Zero-Login Jury Demo Mode** и кнопку симуляции в 1 клик, благодаря чему время сократилось на **40.8% — до 84 секунд**, а успешность выросла до **100% (5 из 5)**. Вторая проблема: студенты в шумных кабинетах не понимали, работает ли шумоподавление — мы вывели живую панель индикаторов dB и SNR, что подняло оценку SUS с **73.5 до 84.5**».

#### Вопросы для **Жибек (Auelbek Zhibek — Исследование, CJM, Анализ данных):**
* **Вопрос 1: Расскажите про вашу Customer Journey Map (CJM). На каком этапе была главная боль пользователя?**
  * **Ответ:** «Наша карта пути следует за персоной **Аружан (19 лет, студентка CS)** через 5 этапов: 1) Осознание проблемы на быстрой лекции (145 слов/мин); 2) Поиск и открытие веб-приложения по QR-коду; 3) Первичная настройка в шумной аудитории (64 дБ); 4) Ежедневное использование конспектов и тестов; 5) Поддержка и экспорт в PDF. Главные трудности возникали на **Этапе 2** (барьер регистрации) и **Этапе 3** (шум аудитории 64 дБ), которые мы решили введением открытого демо-режима и автоматического фильтра Biquad».
* **Вопрос 2: Что показал ваш анализ данных 20 сессий в листах `Data` и `Analysis`?**
  * **Ответ:** «Мы проанализировали 20 лекционных сессий в трёх акустических зонах. В тихих комнатах (<45 дБ) точность распознавания речи составляет **96.7%**. В шумных лекционных залах (>60 дБ) без фильтра отношение сигнал/шум падает до **+5.4 дБ**, точность распознавания падает до **76.4%**, а средний балл за тест — до **68.5%**. При включении нашего умного фильтра в шумных залах SNR вырастает до **+12.9 дБ**, точность распознавания поднимается до **91.1% (+14.7%)**, а результаты тестов студентов растут до **84.0% (+15.5%)**».

---
---

## 🇬🇧 OPTION 2: FULL SPEECH IN ENGLISH (6 Minutes)

### Part 1: 2-Minute Poster Explanation (Shared by All 3 Team Members)

> **Rule Reminder:** Every team member must speak during the 2-minute poster walkthrough (`Assignment_4_Poster_A1.pdf`), point to blocks `1`–`11`, and state **1 sentence about their own contribution**.

#### ⏱️ 0:00 – 0:50 | Blocks 1, 2, 3 & 4 (Title, Problem, Users, Evidence & Competitors) — *Speaker 1: Auelbek Zhibek*
> "Good afternoon, respected instructor and jury! We are Team **L-easy** from **Group IT-2613, Computer Science** at Astana IT University (**Block 1**).  
> As shown in **Block 2**, university STEM lectures in English, Russian, and Kazakh run at **135 to 160 words per minute** in noisy halls. Our target persona, **Aruzhan (age 19, CS student)**, cannot simultaneously listen to the lecturer, translate complex terms, and write structured notes without missing key explanations.  
> In **Block 3**, our baseline survey proved that **75%** of students fail to listen and take notes simultaneously, and **62.5%** struggle with terminology, while peer-reviewed studies by Radford et al. [1] and Kurdi et al. [12] prove that auto-generated active-recall quizzes boost retention by **40%**.  
> In **Block 4**, we compared *Otter.ai, Notta, Fireflies, and Knowt*—none of them combine English, Russian, and Kazakh support with active-recall testing and a real-time classroom acoustic sensor.  
> **My personal contribution** was conducting the 18-source literature review, designing the 5-stage Customer Journey Map in **Block 5**, and building the Task 4 Excel Data and Analysis sheets."

---

#### ⏱️ 0:50 – 1:20 | Blocks 5, 6 & 7 (Proposed Solution, CJM, Tech Stack, Database & Smart Sensor) — *Speaker 2: Amangeldinov Yeraly*
> "Thank you, Zhibek! **Blocks 5 and 6** illustrate our solution and 4-tier cloud architecture. When a student records in a noisy lecture hall above **60 dB**, L-easy's **Web Audio API Smart Acoustic Sensor** measures ambient noise in decibels (dB) and Signal-to-Noise Ratio (SNR) in real time, automatically engaging a hardware-accelerated **Biquad High-Pass Filter**.  
> Next, **Vercel Serverless Functions** and **Google Gemini** generate structured notes, glossary terms, flashcards, and an 8-question quiz.  
> All data is stored in a 5-table **PostgreSQL 15 database on Supabase Cloud**: expanding our Assignment 3 schema (`recordings`, `flashcards`, `quiz_questions`), we added `smart_audio_telemetry` (logging dB, SNR, and ASR accuracy) and `journey_support_logs`, all protected by kernel-level **Row-Level Security (`auth.uid() = user_id`)**.  
> **My personal contribution** was engineering the cloud PostgreSQL database schema, RLS security policies, analytical SQL queries, and the Vercel serverless Gemini API pipeline."

---

#### ⏱️ 1:20 – 2:00 | Blocks 7, 8, 9, 10 & 11 (Functions, Usability Testing, Results & QR Code) — *Speaker 3: Klenov Askhat*
> "Thank you, Yeraly! **Block 7** shows real screenshots of our working product.  
> In **Block 8**, we evaluated L-easy with **$N=5$ external university students**. Based on their feedback, we implemented two concrete before/after improvements: first, we removed the login barrier by adding **Open Jury Demo Mode** and a **1-Tap Classroom Simulation**, cutting task completion time by **40.8%** (from **142 seconds to 84 seconds**) with a **100% (5/5) success rate**; second, we added the live dB/SNR acoustic telemetry strip, raising our System Usability Scale (SUS) score from **73.5 to 84.5 (Grade A)**.  
> In **Block 9**, our 20-session telemetry dataset proves that our Smart Biquad Filter boosts noisy-hall speech recognition accuracy from **76.4% to 91.1% (+14.7%)** and reduces exam revision time by **68%**.  
> **My personal contribution** was developing the React 19 PWA frontend, building the live Web Audio acoustic sensor UI, running the usability tests, and designing the A1 poster.  
> Please scan the **QR code in Block 10**—`audio-notes-6wbf.vercel.app` opens immediately without a login, and we will now demonstrate it live!"

---

### Part 2: 2-Minute Live Product Demonstration in English (`https://audio-notes-6wbf.vercel.app`)

1. **Step 1 (0:00 – 0:20) — Instant Access Without Login (Open Jury Demo Mode):**
   * *Askhat:* "We open `audio-notes-6wbf.vercel.app`. Following competition rules, it launches immediately **without any login wall** in *Competition Jury Demo Mode*, pre-loaded with 3 AITU STEM lectures (Dijkstra's Algorithm, AI Transformers, and Database Normalization)."
2. **Step 2 (0:20 – 0:50) — Smart Classroom Acoustic Sensor & 1-Tap Simulation:**
   * *Askhat:* "Clicking **Record**, you see our **Smart Classroom Acoustic Telemetry Sensor (Task 4)** measuring live **Ambient Noise (dB)**, **SNR Clarity (+dB)**, and **Biquad High-Pass Filter: Auto-Active**. By clicking **⚡ 1-Tap Classroom Simulation** (or uploading a lecture file), our 4-stage AI pipeline completes in under 4 seconds."
3. **Step 3 (0:50 – 1:15) — Structured Summary, Glossary & PDF Export:**
   * *Zhibek:* "Inside the **Notes** tab, students toggle between **Original** and **Simplified** explanations, review bulleted **Key Points** and the **Technical Glossary** in English, Russian, or Kazakh, and export a formatted study sheet via **Print / Save PDF**."
4. **Step 4 (1:15 – 1:40) — 8-Question Quiz, TTS Flashcards & AI Teacher:**
   * *Yeraly:* "In the **AI Teacher / Self-Check** tab, students take an interactive **8-question multiple-choice quiz** with instant explanations, flip **active-recall flashcards** with voice Text-to-Speech (`🔊`), and ask the **AI Teacher** context-aware questions."
5. **Step 5 (1:40 – 2:00) — Cloud PostgreSQL Database & Smart Telemetry Inspector:**
   * *Yeraly:* "Back on the Home screen, clicking **Inspect DB & Telemetry** reveals our live **Supabase PostgreSQL 15** schema, the **20-session acoustic zone analysis table**, and our transparent **Done / Partly / Planned** feature matrix."

---

### Part 3: 2-Minute Individual Q&A in English

#### For **Amangeldinov Yeraly** (Database, Architecture & Security):
* **Q1: Where is your data stored, and how did your database evolve from Assignment 3 to Assignment 4?**
  * **A:** "All data is hosted in **PostgreSQL 15 on Supabase Cloud** (`qcathxqziocmdjqflrsv.supabase.co`). In Assignment 3 we had 4 tables (`auth.users`, `recordings`, `flashcards`, `quiz_questions`). In Assignment 4 (`assignment4_database.sql`), we added 2 normalized tables linked via `ON DELETE CASCADE` foreign keys: `smart_audio_telemetry` (capturing ambient dB, SNR, WPM, Biquad filter state, and ASR accuracy) and `journey_support_logs` (logging CJM stages and task duration)."
* **Q2: How do you secure student data and API credentials?**
  * **A:** "Every PostgreSQL table enforces kernel-level **Row-Level Security (RLS)** checking `auth.uid() = user_id`, preventing unauthorized cross-tenant access. All database queries use parameterized prepared statements to prevent SQL injection, and our `GEMINI_API_KEY` is strictly isolated on Vercel serverless functions."

#### For **Klenov Askhat** (Frontend, Smart Sensor & Usability Testing):
* **Q1: How does the Smart Classroom Acoustic Sensor work technically?**
  * **A:** "It uses the browser's **Web Audio API** (`AudioContext`, `AnalyserNode`, and `BiquadFilterNode`). While capturing audio, it samples frequency bins in memory to compute ambient decibels (dB) and Signal-to-Noise Ratio (SNR). Whenever room noise exceeds 60 dB, the high-pass Biquad filter automatically attenuates low-frequency HVAC hum and echo prior to transcription."
* **Q2: What changed Before vs. After your usability testing with $N=5$ students?**
  * **A:** "First, removing the mandatory login screen via **Open Jury Demo Mode** and **1-Tap Simulation** reduced mean task completion time by **40.8%** (from **142 s to 84 s**) and raised completion from **80% to 100%**. Second, adding the live **dB/SNR acoustic status bar** helped users verify noise filtering, increasing our SUS usability score from **73.5 to 84.5 (Grade A)**."

#### For **Auelbek Zhibek** (User Research, CJM & Data Analysis):
* **Q1: Walk us through your Customer Journey Map (CJM) and its main pain points.**
  * **A:** "Our 5-stage CJM tracks Persona **Aruzhan (age 19, CS student)** through: (1) Problem awareness in a 145 WPM lecture, (2) Accessing our PWA via QR code, (3) Initial setup in a noisy 64 dB hall, (4) Daily usage for multilingual notes and quizzes, and (5) Cloud sync and PDF export. The two biggest friction points were **Stage 2 sign-up friction** and **Stage 3 classroom reverberation**, solved by our Zero-Login Demo Mode and automatic Biquad noise filter."
* **Q2: What are the key quantitative findings from your 20-session Data and Analysis sheets?**
  * **A:** "Across $N=20$ sessions, quiet rooms (<45 dB) achieved **96.7%** ASR accuracy. In noisy lecture halls (>60 dB) with the filter OFF, SNR dropped to **+5.4 dB**, ASR accuracy fell to **76.4%**, and average quiz scores dropped to **68.5%**. With our Smart Filter ON in noisy halls, SNR rose to **+12.9 dB**, ASR accuracy jumped to **91.1% (+14.7%)**, and student quiz scores improved to **84.0% (+15.5%)**."
