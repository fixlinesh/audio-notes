import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

/**
 * Generates a blank bilingual (English / Russian) Participant Informed Consent Form (.docx)
 * for future empirical evaluations and audio corpus collection in the L-easy research project.
 * Contains strictly blank participant signature/date/checkbox fields (no prefilled signatures).
 */

const TEMPLATE_DOCX = path.resolve("benchmarks/official_template_base.docx");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function readZipEntries(zipBuf) {
  let eocdOffset = -1;
  for (let i = zipBuf.length - 22; i >= Math.max(0, zipBuf.length - 65558); i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Invalid DOCX/ZIP: EOCD signature not found.");
  const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
  let cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  for (let i = 0; i < totalEntries; i++) {
    const compMethod = zipBuf.readUInt16LE(cdOffset + 10);
    const compSize = zipBuf.readUInt32LE(cdOffset + 20);
    const nameLen = zipBuf.readUInt16LE(cdOffset + 28);
    const extraLen = zipBuf.readUInt16LE(cdOffset + 30);
    const commentLen = zipBuf.readUInt16LE(cdOffset + 32);
    const localOffset = zipBuf.readUInt32LE(cdOffset + 42);
    const name = zipBuf.toString("utf8", cdOffset + 46, cdOffset + 46 + nameLen);
    const localNameLen = zipBuf.readUInt16LE(localOffset + 26);
    const localExtraLen = zipBuf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const payload = zipBuf.subarray(dataStart, dataStart + compSize);
    const raw = compMethod === 0 ? Buffer.from(payload) : zlib.inflateRawSync(payload);
    entries.set(name, raw);
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function createZip(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;
  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const dataBuf = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const compressed = zlib.deflateRawSync(dataBuf);
    const crc = crc32(dataBuf);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    localHeaders.push(local, compressed);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centralHeaders.push(central);
    offset += local.length + compressed.length;
  }
  const centralSize = centralHeaders.reduce((a, b) => a + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function r(text, { sz = 20, bold = false, italic = false, color = null } = {}) {
  const c = color ? `<w:color w:val="${color}"/>` : "";
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}${c}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function p(runsXml, { jc = "left", before = 40, after = 70, line = 240, pBdrBottom = false, shd = null } = {}) {
  const bdr = pBdrBottom ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="1E293B"/></w:pBdr>` : "";
  const bg = shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${shd}"/>` : "";
  return `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>${bdr}${bg}</w:pPr>${runsXml}</w:p>`;
}

function h(title) {
  return p(r(title, { sz: 22, bold: true, color: "0F172A" }), { before: 120, after: 45, pBdrBottom: true });
}

function bullet(label, text) {
  return p(r("☐  ", { sz: 20, bold: true }) + r(label ? `${label}: ` : "", { sz: 20, bold: true }) + r(text, { sz: 19 }), {
    before: 25,
    after: 40,
    line: 230,
  });
}

let body = "";
body += p(r("ASTANA IT UNIVERSITY", { sz: 22, bold: true, color: "1E3A8A" }), { jc: "center", before: 0, after: 20 });
body += p(r("PARTICIPANT INFORMED CONSENT FORM / ФОРМА ИНФОРМИРОВАННОГО СОГЛАСИЯ УЧАСТНИКА", { sz: 24, bold: true }), {
  jc: "center",
  before: 20,
  after: 40,
  pBdrBottom: true,
});
body += p(
  r("Project / Исследование: ", { sz: 19, bold: true }) +
    r("L-easy: Audio-Centric Lecture Assistant with Client-Side Acoustic Filtering & Multilingual Study Synthesis (IEEE DG 2027)", { sz: 19, italic: true }),
  { jc: "left", before: 60, after: 50 },
);
body += p(
  r("Corresponding Investigator / Ответственный руководитель: ", { sz: 19, bold: true }) +
    r("Akzharkyn Zholmyrza, School of Software Engineering, Astana IT University (akzharkyn.zholmyrza@astanait.edu.kz)", { sz: 19 }),
  { before: 20, after: 80 },
);

body += h("1. Purpose & Procedures / Цель и порядок участия");
body += p(
  r(
    "You are invited to participate voluntarily in an academic evaluation of the L-easy educational web application. Depending on your selected cohort, participation involves completing an anonymized survey on multilingual lecture note-taking, performing a short usability scenario (System Usability Scale, SUS) without mandatory account registration, and/or optionally contributing a spoken presentation audio clip and reference script for Speech-to-Text Word Error Rate (WER) evaluation.",
    { sz: 19 },
  ),
  { jc: "both" },
);
body += p(
  r(
    "Вы приглашаетесь на добровольной основе принять участие в академическом исследовании веб-приложения L-easy. Участие может включать прохождение анонимного опроса о ведении конспектов, тестирование удобства интерфейса (SUS) в гостевом режиме без регистрации и/или (только по отдельному согласию ниже) предоставление аудиозаписи учебного выступления и текста скрипта для оценки точности распознавания речи (WER).",
    { sz: 19 },
  ),
  { jc: "both" },
);

body += h("2. Personal Data & Cloud Processing Notice / Уведомление об обработке данных (Закон РК № 94-V)");
body += p(
  r(
    "In accordance with the Law of the Republic of Kazakhstan \"On Personal Data and Their Protection\" (No. 94-V, May 21, 2013), survey metrics and SUS scores are recorded in anonymized aggregate form without publishing names or student IDs. If you participate in audio transcription tests, voice recordings and transcripts are processed via Vercel serverless functions, the Google Gemini API, and private Supabase Cloud storage (PostgreSQL 15 Row-Level Security) solely for research benchmarking.",
    { sz: 19 },
  ),
  { jc: "both" },
);
body += p(
  r(
    "В соответствии с Законом Республики Казахстан «О персональных данных и их защите» № 94-V от 21.05.2013 г., ответы анкет и оценки SUS фиксируются и публикуются только в обезличенном виде без указания ФИО. При участии в тестировании аудиозаписи и тексты обрабатываются через серверные функции Vercel, Google Gemini API и защищённое облачное хранилище Supabase (PostgreSQL 15 RLS) исключительно в научных целях.",
    { sz: 19 },
  ),
  { jc: "both" },
);

body += h("3. Voluntary Participation & Withdrawal / Добровольность и право на отказ");
body += p(
  r(
    "Participation is strictly voluntary and carries zero academic grade penalty if declined. You may withdraw or request deletion of your uploaded recording at any time prior to anonymized dataset aggregation by emailing akzharkyn.zholmyrza@astanait.edu.kz.",
    { sz: 19 },
  ),
  { jc: "both" },
);

body += h("4. Participant Declarations (Check Applicable Boxes) / Подтверждение участника");
body += bullet("Age Confirmation / Возраст", "I confirm that I am at least 18 years old and a university undergraduate student (Мне исполнилось 18 лет, я являюсь студентом университета).");
body += bullet("Survey & Usability / Опрос и UX-тест", "I voluntarily consent to participate in the anonymized questionnaire and/or 5-step SUS usability evaluation (Даю согласие на участие в анонимном опросе и UX-тестировании).");
body += bullet("Script & Private Benchmark / Скрипт и закрытый тест", "I consent to use of my voice recording and presentation script inside the private team WER evaluation only, WITHOUT publishing raw audio online (Согласен на внутренний расчёт WER без публикации аудиозаписи в открытом доступе).");
body += bullet("Optional Public Audio Release / Публикация аудио (по желанию)", "OPTIONAL: I explicitly consent to publishing my de-identified audio clip under CC-BY-4.0 in the public GitHub research repository (Необязательно: разрешаю публикацию обезличенной аудиозаписи на GitHub).");

body += h("5. Signatures / Подписи сторон (Blank Form for Collection)");
body += `<w:tbl><w:tblPr><w:tblW w:w="9641" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/><w:left w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/><w:right w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tblBorders></w:tblPr>
<w:tblGrid><w:gridCol w:w="3600"/><w:gridCol w:w="2200"/><w:gridCol w:w="2341"/><w:gridCol w:w="1500"/></w:tblGrid>
<w:tr><w:tc><w:tcPr><w:tcW w:w="3600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>${p(r("Role / Роль", { sz: 18, bold: true }), { before: 40, after: 40 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>${p(r("Full Name / ФИО", { sz: 18, bold: true }), { before: 40, after: 40 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="2341" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>${p(r("Signature / Подпись", { sz: 18, bold: true }), { before: 40, after: 40 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>${p(r("Date / Дата", { sz: 18, bold: true }), { before: 40, after: 40 })}</w:tc></w:tr>
<w:tr><w:tc><w:tcPr><w:tcW w:w="3600" w:type="dxa"/></w:tcPr>${p(r("Participant (Student, Age ___)\nУчастник (Студент)", { sz: 18 }), { before: 80, after: 80 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr>${p(r("____________________", { sz: 18 }), { before: 80, after: 80 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="2341" w:type="dxa"/></w:tcPr>${p(r("____________________", { sz: 18 }), { before: 80, after: 80 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr>${p(r("___.___.202__", { sz: 18 }), { before: 80, after: 80 })}</w:tc></w:tr>
<w:tr><w:tc><w:tcPr><w:tcW w:w="3600" w:type="dxa"/></w:tcPr>${p(r("Researcher Obtaining Consent\nИсследователь", { sz: 18 }), { before: 80, after: 80 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr>${p(r("____________________", { sz: 18 }), { before: 80, after: 80 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="2341" w:type="dxa"/></w:tcPr>${p(r("____________________", { sz: 18 }), { before: 80, after: 80 })}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr>${p(r("___.___.202__", { sz: 18 }), { before: 80, after: 80 })}</w:tc></w:tr>
</w:tbl>`;

const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr><w:pgSz w:w="11909" w:h="16834" w:code="9"/><w:pgMar w:top="1077" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;

const tplEntries = readZipEntries(fs.readFileSync(TEMPLATE_DOCX));
const outFiles = [];
for (const [name, data] of tplEntries.entries()) {
  if (name === "word/document.xml") outFiles.push({ name, data: Buffer.from(docXml, "utf8") });
  else outFiles.push({ name, data });
}
const outPath = "c:/Users/amang/audio-notes/Informed_Consent_Form_L-easy.docx";
fs.writeFileSync(outPath, createZip(outFiles));
console.log("Built", outPath);
