/**
 * Google Apps Script: L-easy Bilingual Student Survey Generator (RU / EN)
 *
 * Creates a timestamped Google Form with:
 *   1) Mandatory informed consent + 18+ age verification branch
 *   2) Demographics & AITU multilingual lecture needs assessment (Table I metrics)
 *   3) Optional/branched prototype usability & 10-item Brooke (1996) SUS evaluation (Section V-B)
 *   4) Automatically linked Google Sheet recording authentic Google Forms timestamps
 *
 * Usage:
 *   1. Open https://script.google.com -> New project
 *   2. Paste this entire file into Code.gs
 *   3. Optionally replace PROTOTYPE_URL below with your live Vercel / preview URL
 *   4. Click Run -> select `createLeasySurveyForm` -> authorize Forms & Sheets
 *   5. Copy the Published Form URL and Responses Sheet URL from the Execution log
 */

var PROTOTYPE_URL = "https://your-leasy-url.vercel.app";

function createLeasySurveyForm() {
  var runStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  var publicTitle = "L-easy: Student Lecture Note-Taking & Usability Study (AITU / IEEE DG 2027)";
  var form = FormApp.create(publicTitle + " [Clean " + runStamp + "]");
  form.setTitle(publicTitle);

  form.setDescription(
    "Добровольный анонимный научный опрос студентов (18+) для исследования ассистента лекций L-easy " +
      "(Astana IT University, 2027 IEEE 4th International Student Conference on Digital Generation).\n\n" +
      "Ответственный руководитель / Corresponding investigator: Akzharkyn Zholmyrza, School of Software Engineering, " +
      "Astana IT University (akzharkyn.zholmyrza@astanait.edu.kz).\n\n" +
      "Персональные данные (ФИО, ИИН, голос или контакты) НЕ собираются. Обезличенные агрегированные данные " +
      "обрабатываются в соответствии с Законом РК № 94-V «О персональных данных и их защите». " +
      "Вы можете прекратить участие в любой момент до отправки формы.\n\n" +
      "---\n\n" +
      "Voluntary anonymous student survey (18+ only) for the L-easy lecture assistant research study at AITU. " +
      "No names, phone numbers, emails, or audio files are collected."
  );

  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    "Спасибо за участие! Ваши обезличенные ответы и отметка времени записаны.\n" +
      "Thank you for participating! Your anonymous responses have been recorded."
  );

  // =========================================================================
  // PAGE 1: Informed Consent & 18+ Gate
  // =========================================================================
  var consentItem = form.addCheckboxItem();
  consentItem
    .setTitle(
      "Информированное согласие / Informed Consent"
    )
    .setHelpText(
      "Я подтверждаю, что ознакомлен(а) с целью исследования L-easy и участвую добровольно и анонимно. / " +
        "I confirm that I have read the study information and voluntarily consent to anonymous participation."
    )
    .setChoiceValues([
      "Да, я добровольно соглашаюсь на анонимное участие и публикацию обезличенной статистики / Yes, I consent to anonymous participation"
    ])
    .setRequired(true);

  var ageGateItem = form.addMultipleChoiceItem();
  ageGateItem
    .setTitle("Вам уже исполнилось 18 лет? / Are you 18 years of age or older?")
    .setRequired(true);

  // =========================================================================
  // PAGE 2: Demographics & Multilingual Lecture Barriers (Table I)
  // =========================================================================
  var page2 = form
    .addPageBreakItem()
    .setTitle("Раздел 1. Демография и сложности на лекциях / Section 1. Demographics & Lecture Barriers")
    .setHelpText("Ответьте на вопросы о вашем опыте конспектирования лекций на английском языке.");

  var ageValidation = FormApp.createTextValidation()
    .requireNumberBetween(18, 65)
    .setHelpText("Введите возраст числом от 18 до 65 / Enter an age between 18 and 65")
    .build();

  form
    .addTextItem()
    .setTitle("Ваш возраст (полных лет, только 18+) / Your age (years, 18+ only)")
    .setRequired(true)
    .setValidation(ageValidation);

  form
    .addMultipleChoiceItem()
    .setTitle("Курс обучения / Year of study")
    .setChoiceValues([
      "1 курс / 1st year",
      "2 курс / 2nd year",
      "3 курс / 3rd year",
      "4 курс / 4th year",
      "Магистратура / Master's"
    ])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle("Образовательная программа / Major")
    .setChoiceValues([
      "Computer Science",
      "Software Engineering",
      "Information Technology",
      "Cybersecurity",
      "Data Science / AI",
      "Другое / Other"
    ])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      "Успеваете ли вы одновременно слушать лекции на английском и вести конспект? / " +
        "Can you listen and take notes simultaneously during English lectures?"
    )
    .setChoiceValues([
      "Нет, часто не успеваю / Often fall behind",
      "Иногда не успеваю / Sometimes fall behind",
      "Да, почти всегда успеваю / Usually keep up"
    ])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      "Как часто вы переслушиваете сырые 50-минутные аудиозаписи лекций целиком? / " +
        "How often do you re-listen to full raw 50-min lecture audio recordings?"
    )
    .setChoiceValues([
      "Никогда / Never",
      "Редко / Rarely",
      "Часто / Frequently"
    ])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      "Возникают ли трудности со STEM-терминами на стыке EN / RU / KZ? / " +
        "Do you struggle with mixed-language EN/RU/KZ STEM terminology?"
    )
    .setChoiceValues([
      "Да, часто / Yes, often",
      "Иногда / Sometimes",
      "Нет / No"
    ])
    .setRequired(true);

  form
    .addScaleItem()
    .setTitle(
      "Уровень стресса при подготовке к мидтермам и экзаменам / " +
        "Midterm and exam preparation stress level"
    )
    .setBounds(1, 5)
    .setLabels("1 = Очень низкий / Very low", "5 = Очень высокий / Very high")
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      "Нужен ли единый инструмент (запись -> транскрипт -> конспект EN/RU/KZ -> квиз и AI-тьютор)? / " +
        "Would you want an integrated lecture assistant?"
    )
    .setChoiceValues([
      "Да / Yes",
      "Скорее да / Probably yes",
      "Нет / No"
    ])
    .setRequired(true);

  // =========================================================================
  // PAGE 3: Prototype Device Check (Branches away if friend did not test app)
  // =========================================================================
  form
    .addPageBreakItem()
    .setTitle("Раздел 2. Тест прототипа L-easy / Section 2. L-easy Prototype Check")
    .setHelpText(
      "Перед оценкой юзабилити откройте прототип L-easy в гостевом режиме (Guest Mode): " +
        PROTOTYPE_URL +
        "\nПройдите 5 шагов: открыть главную -> гостевой вход -> открыть конспект/загрузить аудио -> переключить язык -> пройти квиз."
    );

  var deviceItem = form
    .addMultipleChoiceItem()
    .setTitle("На каком устройстве вы тестировали прототип L-easy? / Device used to test prototype")
    .setRequired(true);

  // =========================================================================
  // PAGE 4: Prototype Completion & Standard 10-Item Brooke (1996) SUS
  // =========================================================================
  var pageSus = form
    .addPageBreakItem()
    .setTitle("Раздел 3. Юзабилити и шкала SUS / Section 3. Prototype Usability & SUS")
    .setHelpText(
      "Оцените удобство интерфейса L-easy по стандартной шкале System Usability Scale (SUS, Brooke 1996)."
    );

  form
    .addMultipleChoiceItem()
    .setTitle(
      "Удалось ли пройти базовый 5-шаговый сценарий (гостевой вход -> конспект -> квиз)? / " +
        "Completed the 5-step guest workflow?"
    )
    .setChoiceValues([
      "Да, полностью / Yes, completed",
      "Частично / Partially",
      "Нет / No"
    ])
    .setRequired(true);

  var susQuestions = [
    "SUS 1: Я думаю, что мне хотелось бы часто пользоваться L-easy / I think that I would like to use L-easy frequently",
    "SUS 2: Система показалась мне неоправданно сложной / I found L-easy unnecessarily complex",
    "SUS 3: Мне показалось, что L-easy легко использовать / I thought L-easy was easy to use",
    "SUS 4: Мне бы понадобилась помощь технического специалиста, чтобы пользоваться L-easy / I think I would need support of a technical person to use L-easy",
    "SUS 5: Различные функции системы хорошо интегрированы между собой / I found the various functions in L-easy were well integrated",
    "SUS 6: В системе слишком много несогласованности и противоречий / I thought there was too much inconsistency in L-easy",
    "SUS 7: Большинство студентов быстро научатся пользоваться L-easy / I would imagine most students would learn to use L-easy very quickly",
    "SUS 8: Система показалась мне громоздкой и неудобной / I found L-easy very cumbersome to use",
    "SUS 9: Я чувствовал(а) себя уверенно при работе с L-easy / I felt very confident using L-easy",
    "SUS 10: Мне пришлось многому научиться, прежде чем я смог(ла) работать с L-easy / I needed to learn a lot of things before I could get going with L-easy"
  ];

  for (var i = 0; i < susQuestions.length; i++) {
    form
      .addScaleItem()
      .setTitle(susQuestions[i])
      .setBounds(1, 5)
      .setLabels("1 = Категорически не согласен / Strongly disagree", "5 = Полностью согласен / Strongly agree")
      .setRequired(true);
  }

  form
    .addScaleItem()
    .setTitle("Общая удовлетворённость прототипом L-easy / Overall satisfaction with L-easy")
    .setBounds(1, 5)
    .setLabels("1 = Плохо / Poor", "5 = Отлично / Excellent")
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle("Порекомендовали бы вы L-easy одногруппникам? / Would you recommend L-easy to classmates?")
    .setChoiceValues(["Да / Yes", "Нет / No"])
    .setRequired(true);

  // =========================================================================
  // Wire conditional branching now that page objects exist
  // =========================================================================
  ageGateItem.setChoices([
    ageGateItem.createChoice("Да, мне 18 лет или больше / Yes, I am 18 or older", page2),
    ageGateItem.createChoice("Нет, мне меньше 18 лет / No, I am under 18", FormApp.PageNavigationType.SUBMIT)
  ]);

  deviceItem.setChoices([
    deviceItem.createChoice("iPhone (iOS)", pageSus),
    deviceItem.createChoice("Android", pageSus),
    deviceItem.createChoice("Windows PC", pageSus),
    deviceItem.createChoice("Mac", pageSus),
    deviceItem.createChoice("iPad / Tablet", pageSus),
    deviceItem.createChoice("Не тестировал(а) прототип / Did not test prototype", FormApp.PageNavigationType.SUBMIT)
  ]);

  // =========================================================================
  // Create & link a brand-new destination Google Sheet (authentic timestamps)
  // =========================================================================
  var sheetName = "L-easy Survey Responses (AITU 2027 - Clean " + runStamp + ")";
  var ss = SpreadsheetApp.create(sheetName);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  var publishedUrl = form.getPublishedUrl();
  var editUrl = form.getEditUrl();
  var sheetUrl = ss.getUrl();

  Logger.log("=== New Clean L-easy Google Form Created Successfully ===");
  Logger.log("Sheet Name: " + sheetName);
  Logger.log("1) Published URL (send this NEW link to friends): " + publishedUrl);
  Logger.log("2) Edit URL (only for you): " + editUrl);
  Logger.log("3) Clean Responses Google Sheet URL (with timestamps): " + sheetUrl);

  return {
    sheetName: sheetName,
    publishedUrl: publishedUrl,
    editUrl: editUrl,
    sheetUrl: sheetUrl
  };
}
