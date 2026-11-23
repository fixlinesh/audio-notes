import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UILanguage = "Russian" | "Kazakh" | "English";

export const translations = {
  Russian: {
    // Top Bar & Common
    appName: "L-easy · Audio Notes",
    appSubtitle: "Умные конспекты и AI-помощник",
    greeting: "Привет",
    student: "Студент",
    searchPlaceholder: "Поиск по лекциям, темам и тестам...",
    searchButton: "Поиск",
    profile: "Профиль",
    close: "Закрыть",
    back: "Назад",
    cancel: "Отмена",
    save: "Сохранить",
    delete: "Удалить",
    edit: "Редактировать",
    loading: "Загрузка…",
    today: "Сегодня",
    tomorrow: "Завтра",
    minutes: "мин",
    seconds: "сек",
    items: "шт",

    // Themes & Language
    theme: "Тема оформления",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    themeDefault: "по умолчанию",
    uiLanguage: "Язык интерфейса",

    // Navigation
    navHome: "Главная",
    navRecord: "Запись",
    navLibrary: "Библиотека",
    navNotes: "Конспекты",
    navTests: "Тесты",
    navTeacher: "AI Преподаватель",

    // Demo banner
    juryDemo: "Гостевой режим (Без входа · лекции готовы)",
    signIn: "Войти",
    signOut: "Выйти",

    // Home Screen
    oneTapCapture: "Запись в 1 клик",
    recordLecture: "Записать лекцию",
    recordDesc: "Фильтр 120 Гц HPF (dBFS / SNR_bb), живая речь в текст и умный конспект",
    uploadFile: "Загрузить аудио / PDF",
    uploadDesc: "MP3, WAV, M4A до 100 МБ или PDF слайды",
    todaySchedule: "Расписание занятий",
    addSchedule: "+ Добавить",
    noSchedule: "Занятий на сегодня нет",
    studyStats: "Статистика обучения",
    statLectures: "Лекций в облаке",
    statSummaries: "Конспектов",
    statQuizzes: "Пройдено тестов",
    statMinutes: "Минут аудио",
    recentRecordings: "Недавние записи",
    allRecordings: "Все записи",
    noRecordingsYet: "Пока нет сохранённых записей. Запишите первую лекцию!",
    quickPractice: "Быстрая практика",
    practiceQuizzes: "Тестовые квизы",
    practiceQuizzesDesc: "8 вопросов с разбором",
    practiceCards: "Флеш-карточки",
    practiceCardsDesc: "Термины и активное повторение",

    // Recording Screen
    recordingTitle: "Запись лекции",
    audioSource: "Источник аудио",
    micMode: "Микрофон аудитории",
    uploadMode: "Файл лекции",
    noiseFilterActive: "Шумоподавление активно",
    noiseFilterOff: "Шумоподавление выкл",
    noiseLevel: "Уровень (dBFS)",
    snrClarity: "Широкополосный SNR_bb",
    speechRate: "Темп речи",
    biquadFilter: "Biquad-фильтр",
    biquadDesc: "Отсекает гул вентиляторов, эхо и фоновые шумы аудитории",
    dragDropAudio: "Перетащите аудиофайл сюда или кликните для выбора",
    supportedFormats: "WAV, MP3, M4A, WebM или PDF-слайды",
    startRecord: "Начать запись",
    pauseRecord: "Пауза",
    resumeRecord: "Продолжить",
    stopRecord: "Завершить запись",
    recordingInProgress: "Идёт запись лекции…",
    liveTranscriptPlaceholder: "Говорите в микрофон… Речь будет транскрибироваться в реальном времени.",

    // Lecture Information Screen
    lectureInfoTitle: "Информация о лекции",
    lectureInfoSubtitle: "Проверьте данные перед обработкой",
    fieldTitle: "Название лекции",
    fieldSubject: "Предмет / Курс",
    fieldProfessor: "Преподаватель",
    fieldDate: "Дата",
    fieldSourceLang: "Язык spoken речи",
    fieldOutputLang: "Язык конспекта и тестов",
    generateAiNotes: "Сгенерировать конспект и тесты",

    // Processing Screen
    processingTitle: "Обработка лекции",
    processingDesc: "ИИ анализирует аудио, удаляет шум и создает конспект",
    stepTranscribe: "Распознавание речи через Gemini Flash",
    stepSummarize: "Структурирование конспекта и терминов",
    stepQuiz: "Генерация проверочных вопросов и карточек",
    stepSave: "Синхронизация с Supabase Cloud",
    readyToOpen: "Лекция готова к изучению!",
    openSummary: "Открыть конспект лекции",

    // Summary Screen
    summaryTitle: "Конспект лекции",
    tabStructured: "Структурированный",
    tabSimplified: "Простыми словами",
    tabKeyPoints: "Ключевые пункты",
    tabGlossary: "Глоссарий терминов",
    tabExample: "Практический пример",
    listenAudio: "Прослушать запись лекции",
    exportPdf: "Скачать PDF",
    takeQuiz: "Пройти тест",
    openFlashcards: "Флеш-карточки",
    askTeacher: "Спросить AI Преподавателя",

    // Notes Screen
    notesTitle: "Учебные конспекты",
    printNotes: "Печать / PDF",
    tableOfContents: "Содержание",

    // Tests Screen
    testsTitle: "Тестирование и карточки",
    quizMode: "Квиз (тест)",
    flashcardsMode: "Флеш-карточки",
    questionOf: "Вопрос",
    from: "из",
    yourAnswer: "Ваш ответ",
    correctAnswer: "Верно!",
    incorrectAnswer: "Неверно",
    explanation: "Объяснение",
    nextQuestion: "Следующий вопрос",
    finishQuiz: "Завершить тест",
    quizScore: "Ваш результат",
    retakeQuiz: "Пройти заново",
    flipCard: "Нажмите, чтобы перевернуть карточку",
    prevCard: "Назад",
    nextCard: "Вперёд",
    cardHard: "Сложно",
    cardGood: "Нормально",
    cardEasy: "Легко",
    cardSoon: "Скоро",
    card3Days: "3 дня",
    card7Days: "7 дней",
    allCards: "Все карточки",
    reviewHardOnly: "Повторить только сложные",
    noCardsInCategory: "В этой категории пока нет терминов",

    // AI Teacher Screen
    teacherTitle: "AI Преподаватель 24/7",
    teacherSubtitle: "Персональный репетитор по материалам вашей лекции",
    teacherGreeting: "Здравствуйте! Я изучил вашу лекцию. Задайте любой вопрос или попросите объяснить сложный термин.",
    textChat: "Текстовый чат",
    voiceCall: "Голосовой звонок",
    askAnything: "Задайте вопрос по лекции…",
    endCall: "Завершить звонок",
    speaking: "Преподаватель говорит…",
    listening: "Слушаю вас…",
    typeQuestionPlaceholder: "Задайте вопрос по материалу лекции…",
    send: "Отправить",

    // Library Screen
    libraryTitle: "Моя библиотека лекций",
    librarySubtitle: "Все сохранённые аудиозаписи, конспекты и тесты",
    searchLibrary: "Поиск в библиотеке...",
    filterAll: "Все",
    noLecturesFound: "Лекции не найдены",
    openLecture: "Открыть",
    deleteLecture: "Удалить",
    confirmDelete: "Вы уверены, что хотите удалить эту лекцию?",

    // Auth Screen
    authTitle: "L-easy · Audio Notes",
    authSubtitle: "Умная запись лекций, ИИ-конспекты и тесты на казахском, русском и английском",
    authSignInTab: "Вход в аккаунт",
    authSignUpTab: "Регистрация",
    authName: "Ваше имя и фамилия",
    authUniversity: "Университет / Колледж",
    authEmail: "Email",
    authPassword: "Пароль",
    authShowPass: "Показать",
    authHidePass: "Скрыть",
    authSubmitSignIn: "Войти в L-easy",
    authSubmitSignUp: "Создать аккаунт",
    authGuestDemo: "🚀 Гостевой режим без входа (Guest Preview Mode)",
    authSecuredBy: "🔒 Данные защищены Supabase Row-Level Security (RLS)",
  },

  Kazakh: {
    // Top Bar & Common
    appName: "L-easy · Audio Notes",
    appSubtitle: "Ақылды конспектілер және AI көмекші",
    greeting: "Сәлем",
    student: "Студент",
    searchPlaceholder: "Дәрістер, тақырыптар мен тесттер бойынша іздеу...",
    searchButton: "Іздеу",
    profile: "Профиль",
    close: "Жабу",
    back: "Артқа",
    cancel: "Бас тарту",
    save: "Сақтау",
    delete: "Жою",
    edit: "Өңдеу",
    loading: "Жүктелуде…",
    today: "Бүгін",
    tomorrow: "Ертең",
    minutes: "мин",
    seconds: "сек",
    items: "дана",

    // Themes & Language
    theme: "Безендіру тақырыбы",
    themeLight: "Жарық",
    themeDark: "Қараңғы",
    themeDefault: "әдепкі бойынша",
    uiLanguage: "Интерфейс тілі",

    // Navigation
    navHome: "Басты бет",
    navRecord: "Жазу",
    navLibrary: "Кітапхана",
    navNotes: "Конспектілер",
    navTests: "Тесттер",
    navTeacher: "AI Оқытушы",

    // Demo banner
    juryDemo: "Қонақ режимі (Кірусіз · дәрістер дайын)",
    signIn: "Кіру",
    signOut: "Шығу",

    // Home Screen
    oneTapCapture: "1 басумен жазу",
    recordLecture: "Дәрісті жазу",
    recordDesc: "120 Гц HPF сүзгісі (dBFS / SNR_bb), сөзді мәтінге айналдыру және AI конспект",
    uploadFile: "Аудио / PDF жүктеу",
    uploadDesc: "MP3, WAV, M4A 100 МБ дейін немесе PDF слайдтар",
    todaySchedule: "Сабақ кестесі",
    addSchedule: "+ Қосу",
    noSchedule: "Бүгінге сабақ жоқ",
    studyStats: "Оқу статистикасы",
    statLectures: "Бұлттағы дәрістер",
    statSummaries: "Конспектілер",
    statQuizzes: "Тапсырылған тесттер",
    statMinutes: "Тыңдалған минут",
    recentRecordings: "Соңғы жазбалар",
    allRecordings: "Барлық жазбалар",
    noRecordingsYet: "Әзірге сақталған жазбалар жоқ. Алғашқы дәрісті жазыңыз!",
    quickPractice: "Жылдам жаттығу",
    practiceQuizzes: "Сынақ квиздері",
    practiceQuizzesDesc: "Талдауы бар 8 сұрақ",
    practiceCards: "Флеш-карталар",
    practiceCardsDesc: "Терминдер мен белсенді қайталау",

    // Recording Screen
    recordingTitle: "Дәрісті жазу",
    audioSource: "Аудио көзі",
    micMode: "Аудитория микрофоны",
    uploadMode: "Дәріс файлы",
    noiseFilterActive: "Шу басу қосулы",
    noiseFilterOff: "Шу басу өшірулі",
    noiseLevel: "Деңгей (dBFS)",
    snrClarity: "Кең жолақты SNR_bb",
    speechRate: "Сөйлеу қарқыны",
    biquadFilter: "Biquad-сүзгі",
    biquadDesc: "Желдеткіштер гүрілін, жаңғырықты және бөтен шуды сүзеді",
    dragDropAudio: "Аудиофайлды осында сүйреңіз немесе таңдау үшін басыңыз",
    supportedFormats: "WAV, MP3, M4A, WebM немесе PDF-слайдтар",
    startRecord: "Жазуды бастау",
    pauseRecord: "Кідірту",
    resumeRecord: "Жалғастыру",
    stopRecord: "Жазуды тоқтату",
    recordingInProgress: "Дәріс жазылып жатыр…",
    liveTranscriptPlaceholder: "Микрофонға сөйлеңіз… Сөз нақты уақытта мәтінге айналады.",

    // Lecture Information Screen
    lectureInfoTitle: "Дәріс туралы мәлімет",
    lectureInfoSubtitle: "Өңдеу алдында деректерді тексеріңіз",
    fieldTitle: "Дәрістің атауы",
    fieldSubject: "Пән / Курс",
    fieldProfessor: "Оқытушы",
    fieldDate: "Күні",
    fieldSourceLang: "Сөйлеу тілі",
    fieldOutputLang: "Конспект пен тест тілі",
    generateAiNotes: "Конспект пен тесттер құрастыру",

    // Processing Screen
    processingTitle: "Дәрісті өңдеу",
    processingDesc: "AI аудионы талдап, шуды тазартып, конспект жасайды",
    stepTranscribe: "Gemini Flash арқылы сөзді мәтінге тану",
    stepSummarize: "Конспект пен терминдерді жүйелеу",
    stepQuiz: "Сынақ сұрақтары мен флеш-карталарды жасау",
    stepSave: "Supabase Cloud-пен синхрондау",
    readyToOpen: "Дәріс оқуға дайын!",
    openSummary: "Дәріс конспектісін ашу",

    // Summary Screen
    summaryTitle: "Дәріс конспектісі",
    tabStructured: "Құрылымдалған",
    tabSimplified: "Қарапайым тілмен",
    tabKeyPoints: "Негізгі ойлар",
    tabGlossary: "Терминдер глоссарийі",
    tabExample: "Тәжірибелік мысал",
    listenAudio: "Дәріс аудиосын тыңдау",
    exportPdf: "PDF жүктеу",
    takeQuiz: "Тест тапсыру",
    openFlashcards: "Флеш-карталар",
    askTeacher: "AI Оқытушыдан сұрау",

    // Notes Screen
    notesTitle: "Оқу конспектілері",
    printNotes: "Басып шығару / PDF",
    tableOfContents: "Мазмұны",

    // Tests Screen
    testsTitle: "Тесттер мен карточкалар",
    quizMode: "Квиз (тест)",
    flashcardsMode: "Флеш-карталар",
    questionOf: "Сұрақ",
    from: "ішінен",
    yourAnswer: "Сіздің жауабыңыз",
    correctAnswer: "Дұрыс!",
    incorrectAnswer: "Қате",
    explanation: "Түсіндірме",
    nextQuestion: "Келесі сұрақ",
    finishQuiz: "Тестті аяқтау",
    quizScore: "Сіздің нәтижеңіз",
    retakeQuiz: "Қайта тапсыру",
    flipCard: "Аудару үшін картаны басыңыз",
    prevCard: "Артқа",
    nextCard: "Алға",
    cardHard: "Қиын",
    cardGood: "Орташа",
    cardEasy: "Оңай",
    cardSoon: "Жақында",
    card3Days: "3 күн",
    card7Days: "7 күн",
    allCards: "Барлық карточкалар",
    reviewHardOnly: "Тек қиындарын қайталау",
    noCardsInCategory: "Бұл санатта әзірге терминдер жоқ",

    // AI Teacher Screen
    teacherTitle: "AI Оқытушы 24/7",
    teacherSubtitle: "Сіздің дәріс материалдарыңыз бойынша жеке репетитор",
    teacherGreeting: "Сәлеметсіз бе! Мен дәрісіңізді зерттедім. Кез келген сұрақ қойыңыз немесе түсініксіз терминді түсіндіруді сұраңыз.",
    textChat: "Мәтіндік чат",
    voiceCall: "Дауыстық қоңырау",
    askAnything: "Дәріс бойынша сұрақ қойыңыз…",
    endCall: "Қоңырауды аяқтау",
    speaking: "Оқытушы сөйлеп жатыр…",
    listening: "Сізді тыңдап тұрмын…",
    typeQuestionPlaceholder: "Дәріс бойынша сұрағыңызды жазыңыз…",
    send: "Жіберу",

    // Library Screen
    libraryTitle: "Менің дәрістер кітапханам",
    librarySubtitle: "Барлық сақталған аудиожазбалар, конспектілер мен тесттер",
    searchLibrary: "Кітапханадан іздеу...",
    filterAll: "Барлығы",
    noLecturesFound: "Дәрістер табылмады",
    openLecture: "Ашу",
    deleteLecture: "Жою",
    confirmDelete: "Бұл дәрісті өшіргіңіз келетініне сенімдісіз бе?",

    // Auth Screen
    authTitle: "L-easy · Audio Notes",
    authSubtitle: "Қазақ, орыс және ағылшын тілдеріндегі ақылды дәріс жазбасы, AI-конспектілер мен тесттер",
    authSignInTab: "Аккаунтқа кіру",
    authSignUpTab: "Тіркелу",
    authName: "Атыңыз бен тегіңіз",
    authUniversity: "Университет / Колледж",
    authEmail: "Email",
    authPassword: "Құпиясөз",
    authShowPass: "Көрсету",
    authHidePass: "Жасыру",
    authSubmitSignIn: "L-easy-ге кіру",
    authSubmitSignUp: "Аккаунт құру",
    authGuestDemo: "🚀 Кірусіз қонақ режимі (Guest Preview Mode)",
    authSecuredBy: "🔒 Деректер Supabase Row-Level Security (RLS) арқылы қорғалған",
  },

  English: {
    // Top Bar & Common
    appName: "L-easy · Audio Notes",
    appSubtitle: "Smart Lecture Audio to Notes & AI Tutor",
    greeting: "Hello",
    student: "Student",
    searchPlaceholder: "Search lectures, topics and quizzes...",
    searchButton: "Search",
    profile: "Profile",
    close: "Close",
    back: "Back",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    loading: "Loading…",
    today: "Today",
    tomorrow: "Tomorrow",
    minutes: "min",
    seconds: "sec",
    items: "items",

    // Themes & Language
    theme: "Color Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeDefault: "default",
    uiLanguage: "UI Language",

    // Navigation
    navHome: "Home",
    navRecord: "Record",
    navLibrary: "Library",
    navNotes: "Notes",
    navTests: "Tests",
    navTeacher: "AI Teacher",

    // Demo banner
    juryDemo: "Guest Preview Mode (No login · 3 lectures ready)",
    signIn: "Sign In",
    signOut: "Sign Out",

    // Home Screen
    oneTapCapture: "One-tap capture",
    recordLecture: "Record Lecture",
    recordDesc: "120 Hz Biquad HPF (dBFS / SNR_bb), live speech-to-text & AI summary",
    uploadFile: "Upload Audio / PDF",
    uploadDesc: "MP3, WAV, M4A up to 100 MB or lecture slides in PDF",
    todaySchedule: "Class Schedule",
    addSchedule: "+ Add",
    noSchedule: "No classes scheduled for today",
    studyStats: "Study Statistics",
    statLectures: "Cloud Lectures",
    statSummaries: "Summaries",
    statQuizzes: "Quizzes Passed",
    statMinutes: "Audio Minutes",
    recentRecordings: "Recent Recordings",
    allRecordings: "All Recordings",
    noRecordingsYet: "No saved lectures yet. Record your first lecture!",
    quickPractice: "Quick Practice",
    practiceQuizzes: "Practice Quizzes",
    practiceQuizzesDesc: "8 multiple-choice questions",
    practiceCards: "Flashcards",
    practiceCardsDesc: "Key terms & active recall",

    // Recording Screen
    recordingTitle: "Record Lecture",
    audioSource: "Audio Source",
    micMode: "Auditorium Mic",
    uploadMode: "Lecture File",
    noiseFilterActive: "Noise filter active",
    noiseFilterOff: "Noise filter off",
    noiseLevel: "Digital Level (dBFS)",
    snrClarity: "Broadband SNR_bb",
    speechRate: "Speech Rate",
    biquadFilter: "Biquad Filter",
    biquadDesc: "Cuts classroom hum, echo and HVAC background noise",
    dragDropAudio: "Drag & drop audio file here or click to browse",
    supportedFormats: "WAV, MP3, M4A, WebM or PDF slides",
    startRecord: "Start Recording",
    pauseRecord: "Pause",
    resumeRecord: "Resume",
    stopRecord: "Stop Recording",
    recordingInProgress: "Recording in progress…",
    liveTranscriptPlaceholder: "Speak into the microphone… Speech will be transcribed in real time.",

    // Lecture Information Screen
    lectureInfoTitle: "Lecture Information",
    lectureInfoSubtitle: "Verify lecture details before processing",
    fieldTitle: "Lecture Title",
    fieldSubject: "Subject / Course",
    fieldProfessor: "Professor",
    fieldDate: "Date",
    fieldSourceLang: "Spoken Language",
    fieldOutputLang: "Summary & Quiz Language",
    generateAiNotes: "Generate AI Notes & Quizzes",

    // Processing Screen
    processingTitle: "Processing Lecture",
    processingDesc: "AI filters noise, transcribes audio and creates study notes",
    stepTranscribe: "Speech recognition via Gemini Flash",
    stepSummarize: "Structuring notes and academic glossary",
    stepQuiz: "Creating quizzes and flashcards",
    stepSave: "Cloud sync to Supabase PostgreSQL",
    readyToOpen: "Lecture is ready to study!",
    openSummary: "Open Lecture Summary",

    // Summary Screen
    summaryTitle: "Lecture Summary",
    tabStructured: "Structured Notes",
    tabSimplified: "Simplified",
    tabKeyPoints: "Key Points",
    tabGlossary: "Glossary & Terms",
    tabExample: "Practical Example",
    listenAudio: "Listen to Lecture Audio",
    exportPdf: "Export PDF",
    takeQuiz: "Take Quiz",
    openFlashcards: "Flashcards",
    askTeacher: "Ask AI Teacher",

    // Notes Screen
    notesTitle: "Study Notes",
    printNotes: "Print / PDF",
    tableOfContents: "Table of Contents",

    // Tests Screen
    testsTitle: "Tests & Flashcards",
    quizMode: "Practice Quiz",
    flashcardsMode: "Flashcards",
    questionOf: "Question",
    from: "of",
    yourAnswer: "Your Answer",
    correctAnswer: "Correct!",
    incorrectAnswer: "Incorrect",
    explanation: "Explanation",
    nextQuestion: "Next Question",
    finishQuiz: "Finish Quiz",
    quizScore: "Your Score",
    retakeQuiz: "Retake Quiz",
    flipCard: "Click card to flip",
    prevCard: "Previous",
    nextCard: "Next",
    cardHard: "Hard",
    cardGood: "Good",
    cardEasy: "Easy",
    cardSoon: "Soon",
    card3Days: "3 days",
    card7Days: "7 days",
    allCards: "All cards",
    reviewHardOnly: "Review hard terms only",
    noCardsInCategory: "No terms in this category yet",

    // AI Teacher Screen
    teacherTitle: "AI Teacher 24/7",
    teacherSubtitle: "Your personal tutor based on this lecture",
    teacherGreeting: "Hello! I have reviewed your lecture notes. Feel free to ask any question or ask me to explain difficult terms.",
    textChat: "Text Chat",
    voiceCall: "Voice Call",
    askAnything: "Ask about this lecture…",
    endCall: "End Call",
    speaking: "Teacher speaking…",
    listening: "Listening…",
    typeQuestionPlaceholder: "Ask a question about this lecture…",
    send: "Send",

    // Library Screen
    libraryTitle: "My Lecture Library",
    librarySubtitle: "All saved audio recordings, summaries & quizzes",
    searchLibrary: "Search library...",
    filterAll: "All",
    noLecturesFound: "No lectures found",
    openLecture: "Open",
    deleteLecture: "Delete",
    confirmDelete: "Are you sure you want to delete this lecture?",

    // Auth Screen
    authTitle: "L-easy · Audio Notes",
    authSubtitle: "Smart lecture recording, AI notes & quizzes in Kazakh, Russian & English",
    authSignInTab: "Sign In",
    authSignUpTab: "Create Account",
    authName: "Full Name",
    authUniversity: "University / College",
    authEmail: "Email",
    authPassword: "Password",
    authShowPass: "Show",
    authHidePass: "Hide",
    authSubmitSignIn: "Sign In to L-easy",
    authSubmitSignUp: "Create Account",
    authGuestDemo: "🚀 Open Guest Preview Mode (No login needed)",
    authSecuredBy: "🔒 Secured by Supabase Row-Level Security (RLS)",
  },
};

export function getInitialUILanguage(): UILanguage {
  if (typeof window === "undefined") return "Russian";
  try {
    const saved = localStorage.getItem("leasy_ui_lang");
    if (saved === "Russian" || saved === "Kazakh" || saved === "English") return saved;
  } catch {}
  return "Russian"; // default Russian
}

interface I18nContextType {
  lang: UILanguage;
  setLang: (lang: UILanguage) => void;
  t: typeof translations.Russian;
}

export const I18nContext = createContext<I18nContextType>({
  lang: "Russian",
  setLang: () => {},
  t: translations.Russian,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UILanguage>(() => getInitialUILanguage());

  const setLang = (next: UILanguage) => {
    setLangState(next);
    try {
      localStorage.setItem("leasy_ui_lang", next);
    } catch {}
  };

  const t = translations[lang] || translations.Russian;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function formatDisplayDate(lang: UILanguage): string {
  const d = new Date();
  if (lang === "Kazakh") {
    const months = [
      "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
      "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
    ];
    const days = ["Жексенбі", "Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
  }
  if (lang === "English") {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }
  return d.toLocaleDateString("ru-RU", { weekday: "long", month: "long", day: "numeric" });
}

export function useI18n() {
  return useContext(I18nContext);
}
