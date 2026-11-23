import type { Language, StudyData, QuizQuestion } from "../types";
import type { SummaryData } from "../summarize";

export function generateFallbackSummary(
  title: string,
  subject: string,
  transcript: string,
  language: Language
): SummaryData {
  const cleanTitle = title || "Academic Lecture";
  const cleanSubj = subject && subject !== "General Subject" && subject !== "Общий предмет" ? subject : cleanTitle;

  if (language === "Russian") {
    return {
      explanation: `Лекция посвящена теме «${cleanTitle}» (${cleanSubj}). В материале рассматриваются фундаментальные принципы, теоретический базис и методологические подходы к анализу предметной области. Преподаватель детально объясняет ключевые понятия, внутреннюю структуру изучаемых явлений и практические критерии успешного решения прикладных задач.`,
      simplified: `Простыми словами: в этой теме («${cleanTitle}») разбирается, как логически устроены базовые концепции и как применять их на практике шаг за шагом без лишней сложности.`,
      keyPoints: [
        `Основные определения и академический контекст темы «${cleanTitle}»`,
        `Ключевые теоретические свойства и закономерности дисциплины «${cleanSubj}»`,
        `Практические примеры, методология анализа и типовые ошибки`,
        `Методы проверки усвоения материала и подготовка к экзаменационным вопросам`
      ],
      terms: [
        `${cleanTitle}: Центральная тема и концептуальный базис рассмотренного занятия.`,
        `Ключевая концепция: Фундаментальный принцип предметной области «${cleanSubj}».`,
        `Практическое применение: Методология решения типовых задач и анализа по теме «${cleanTitle}».`,
        `Контрольный самоконтроль: Проверка усвоения материала с помощью тестовых вопросов и карточек.`
      ],
      example: `При решении практических заданий и курсовых проектов по направлению «${cleanSubj}» студенты применяют разобранные правила темы «${cleanTitle}» для построения корректных академических решений.`
    };
  }

  if (language === "Kazakh") {
    return {
      explanation: `Дәріс «${cleanTitle}» тақырыбына және «${cleanSubj}» пәнінің негізгі ұғымдарына арналған. Оқу барысында жүйенің теориялық негіздері, басты заңдылықтары және қолданбалы тәсілдері толық талданды.`,
      simplified: `Қарапайым сөзбен айтқанда: бұл дәрісте «${cleanTitle}» тақырыбының негізгі қағидалары мен оларды практикада тиімді қолдану жолдары қарастырылды.`,
      keyPoints: [
        `«${cleanTitle}» тақырыбының негізгі анықтамалары мен мазмұны`,
        `«${cleanSubj}» пәні бойынша теориялық заңдылықтар мен қасиеттер`,
        `Тәжірибелік мысалдар және оларды дұрыс талдау жолдары`,
        `Емтиханға дайындық кезіндегі басты назар аударатын сұрақтар`
      ],
      terms: [
        `${cleanTitle}: Дәрістің негізгі тақырыбы мен тұжырымдамалық өзегі.`,
        `Негізгі қағида: «${cleanSubj}» саласындағы басты заңдылық пен түсінік.`,
        `Тәжірибеде қолдану: «${cleanTitle}» бойынша алған білімді практикалық тапсырмаларда пайдалану.`,
        `Өзін-өзі тексеру: Алған білімді бекітуге арналған тест тапсырмалары мен карточкалар.`
      ],
      example: `Студенттер «${cleanTitle}» бойынша алған теориялық білімдерін практикалық сабақтарда және Astana IT University оқу жобаларында сәтті қолданады.`
    };
  }

  return {
    explanation: `This lecture provides a comprehensive analysis of "${cleanTitle}" within the scope of ${cleanSubj}. Key theoretical foundations, core mechanisms, structural definitions, and empirical trade-offs were examined in detail.`,
    simplified: `In simple terms: this lecture breaks down how "${cleanTitle}" operates conceptually and how to implement its core methods methodically step-by-step.`,
    keyPoints: [
      `Core definitions and academic context of "${cleanTitle}"`,
      `Theoretical principles and properties established in ${cleanSubj}`,
      `Practical analytical workflows and common interpretation pitfalls`,
      `Exam revision priorities and quantitative evaluation metrics`
    ],
    terms: [
      `${cleanTitle}: Primary subject and theoretical domain of the lecture.`,
      `Core Principle: Fundamental concept governing ${cleanSubj}.`,
      `Practical Application: Systematic methodology for analyzing ${cleanTitle}.`,
      `Active Recall: Structured self-testing methodology to reinforce long-term mastery.`
    ],
    example: `In academic and laboratory coursework, students apply the principles of ${cleanTitle} to build rigorous, high-standard solutions.`
  };
}

export function generateFallbackStudy(
  title: string,
  subject: string,
  language: Language,
  summary?: SummaryData
): StudyData {
  const cleanTitle = title || "Academic Subject";
  const cleanSubj = subject && subject !== "General Subject" && subject !== "Общий предмет" ? subject : cleanTitle;

  // Extract real cards from summary if present
  const extractedCards: { term: string; definition: string }[] = [];
  if (summary?.terms && Array.isArray(summary.terms)) {
    for (const raw of summary.terms) {
      if (typeof raw === "string") {
        const sep = raw.includes(":") ? ":" : raw.includes("—") ? "—" : raw.includes("-") ? "-" : null;
        if (sep) {
          const [t, ...rest] = raw.split(sep);
          const term = t.trim();
          const def = rest.join(sep).trim();
          if (term && def) extractedCards.push({ term, definition: def });
        } else if (raw.trim()) {
          extractedCards.push({
            term: raw.trim(),
            definition:
              language === "Kazakh"
                ? `«${cleanTitle}» лекциясының маңызды ұғымы.`
                : language === "English"
                  ? `Key academic concept from the lecture "${cleanTitle}".`
                  : `Ключевое академическое понятие лекции «${cleanTitle}».`,
          });
        }
      }
    }
  }

  const rawKeyPoints = Array.isArray(summary?.keyPoints) ? summary.keyPoints.filter(Boolean) : [];

  const flashcards = extractedCards.length >= 2
    ? extractedCards
    : [
        {
          term: cleanTitle,
          definition: summary?.explanation || (
            language === "Kazakh"
              ? `«${cleanSubj}» пәні бойынша дәрістің басты тақырыбы.`
              : language === "English"
                ? `Core topic of the lecture in ${cleanSubj}.`
                : `Центральная тема лекции по дисциплине «${cleanSubj}».`
          )
        },
        {
          term: language === "Kazakh" ? `«${cleanTitle}» негізгі қағидасы` : language === "English" ? `Key Principle of "${cleanTitle}"` : `Основной принцип «${cleanTitle}»`,
          definition: summary?.simplified || (
            language === "Kazakh"
              ? `Тақырыптың басты теориялық заңдылығы мен түсіндірмесі.`
              : language === "English"
                ? `Fundamental theoretical mechanism and logical structure of the topic.`
                : `Базовый теоретический механизм и логическое обоснование темы.`
          )
        },
        {
          term: language === "Kazakh" ? "Тәжірибелік мысал" : language === "English" ? "Practical Example" : "Практический пример",
          definition: summary?.example || (
            language === "Kazakh"
              ? `«${cleanTitle}» тақырыбын практикада қолдану мысалы.`
              : language === "English"
                ? `Applied use case illustrating "${cleanTitle}".`
                : `Способ решения прикладных задач по направлению «${cleanSubj}».`
          )
        },
        {
          term: "Active Recall",
          definition: language === "Kazakh"
            ? "Алған білімді флешкарталар мен тесттер арқылы белсенді қайталап бекіту әдісі."
            : language === "English"
              ? "Self-testing learning methodology that boosts long-term retention by up to 40%."
              : "Техника самопроверки через активное извлечение знаний, повышающая запоминание до 40%."
        }
      ];

  const quiz: QuizQuestion[] = [];

  function makeQuestion(
    qText: string,
    correctOpt: string,
    distractors: string[],
    exp: string,
    targetIdx: number
  ): QuizQuestion {
    const d = [...distractors].filter((s) => s && s.trim() !== correctOpt.trim());
    while (d.length < 3) {
      d.push(
        language === "Kazakh"
          ? `Тақырыпқа қатысы бар қосымша болжам (${d.length + 1})`
          : language === "English"
            ? `Alternative secondary scenario (${d.length + 1})`
            : `Альтернативный фактор, не подтверждённый материалами лекции (${d.length + 1})`
      );
    }
    const idx = targetIdx % 4;
    const answers = [d[0], d[1], d[2]];
    answers.splice(idx, 0, correctOpt);
    return {
      question: qText,
      answers,
      correct: idx,
      explanation: exp,
    };
  }

  // 1. Term-based questions (strict ground truth from lecture glossary)
  for (let i = 0; i < Math.min(extractedCards.length, 3); i++) {
    const card = extractedCards[i];
    const otherDefs = extractedCards.filter((_, idx) => idx !== i).map((c) => c.definition);
    const qText =
      language === "Kazakh"
        ? `«${cleanTitle}» дәрісі бойынша «${card.term}» ұғымы нені білдіреді?`
        : language === "English"
          ? `According to the lecture "${cleanTitle}", what does "${card.term}" define?`
          : `Что означает понятие «${card.term}» в контексте лекции «${cleanTitle}»?`;
    quiz.push(
      makeQuestion(
        qText,
        card.definition,
        otherDefs,
        language === "Kazakh"
          ? `«${card.term}» анықтамасы: ${card.definition}`
          : language === "English"
            ? `"${card.term}" is defined as: ${card.definition}`
            : `Понятие «${card.term}» определяется как: ${card.definition}`,
        i % 4
      )
    );
  }

  // 2. KeyPoints-based questions (direct takeaways from lecture summary)
  for (let j = 0; j < Math.min(rawKeyPoints.length, 3); j++) {
    const point = rawKeyPoints[j];
    const otherPoints = rawKeyPoints.filter((_, idx) => idx !== j);
    const qText =
      language === "Kazakh"
        ? `«${cleanTitle}» дәрісінің келесі негізгі тұжырымдарының қайсысы дұрыс?`
        : language === "English"
          ? `Which of the following is a key takeaway verified by "${cleanTitle}"?`
          : `Какое из следующих положений является подтверждённым фактом темы «${cleanTitle}»?`;
    quiz.push(
      makeQuestion(
        qText,
        point,
        otherPoints,
        language === "Kazakh"
          ? `Дәрістің негізгі түйіні: ${point}`
          : language === "English"
            ? `Key takeaway from lecture: ${point}`
            : `Согласно ключевым пунктам лекции: ${point}`,
        (j + 2) % 4
      )
    );
  }

  // 3. Simplified / Example questions
  if (summary?.simplified && quiz.length < 5) {
    const qText =
      language === "Kazakh"
        ? `«${cleanTitle}» тақырыбының басты түсіндірмесі қандай?`
        : language === "English"
          ? `What is the core simplified explanation of "${cleanTitle}"?`
          : `В чём заключается суть концепции «${cleanTitle}» простыми словами?`;
    quiz.push(
      makeQuestion(
        qText,
        summary.simplified,
        [
          language === "Kazakh" ? "Тек анықтамаларды жаттап алу" : language === "English" ? "Superficial memorization without context" : "Поверхностное заучивание терминов без понимания сути",
          language === "Kazakh" ? "Дәріс тақырыбына қатысы жоқ мәліметтер" : language === "English" ? "Unrelated theoretical postulates" : "Теоретические положения из нерелевантных дисциплин",
          language === "Kazakh" ? "Тек қана абстрактілі мысалдар" : language === "English" ? "Abstract conjectures without verification" : "Исключительно абстрактные гипотезы без доказательств"
        ],
        summary.simplified,
        3
      )
    );
  }

  if (summary?.example && quiz.length < 5) {
    const qText =
      language === "Kazakh"
        ? `«${cleanTitle}» бойынша қандай практикалық мысал қарастырылды?`
        : language === "English"
          ? `Which practical example or case was discussed regarding "${cleanTitle}"?`
          : `Какой прикладной пример или кейс иллюстрирует тему «${cleanTitle}»?`;
    quiz.push(
      makeQuestion(
        qText,
        summary.example,
        [
          language === "Kazakh" ? "Практикалық қолданысы жоқ" : language === "English" ? "No practical applications are possible" : "Практические примеры в данной теме отсутствуют",
          language === "Kazakh" ? "Тек қана ескірген тәсілдер" : language === "English" ? "Only abstract non-verifiable claims" : "Абстрактные формулы без привязки к реальным задачам",
          language === "Kazakh" ? "Өмірден алшақ теориялар" : language === "English" ? "Outdated legacy approaches" : "Использование устаревших неэффективных подходов"
        ],
        summary.example,
        1
      )
    );
  }

  // Fallback default question if summary was completely empty
  if (quiz.length === 0) {
    const q1 = language === "Kazakh"
      ? makeQuestion(`«${cleanTitle}» тақырыбы бойынша негізгі бағыт қандай?`, `«${cleanTitle}» бойынша жүйелі білім алып, теорияны тәжірибеде дұрыс қолдану`, ["Ешқандай мақсат жоқ", "Тек жаттанды қайталау", "Тақырыптан тыс мәселелер"], `«${cleanTitle}» пәнінің мақсаты.`, 0)
      : language === "English"
        ? makeQuestion(`What is the core focus of "${cleanTitle}"?`, `Systematic mastery of fundamental principles and practical application of "${cleanTitle}"`, ["Random memorization", "Ignoring practical frameworks", "Unrelated concepts"], `Core focus of ${cleanTitle}.`, 0)
        : makeQuestion(`Каков ключевой фокус темы «${cleanTitle}»?`, `Системное освоение фундаментальных принципов и практическое применение методов темы «${cleanTitle}»`, ["Поверхностное заучивание терминов без понимания сути", "Игнорирование базовых моделей предмета", "Изучение посторонних вопросов"], `Основная направленность изучения темы.`, 0);
    quiz.push(q1);
  }

  return { quiz, flashcards };
}
