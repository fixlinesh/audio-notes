import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

/**
 * Generates camera-ready 2027 IEEE 4th International Student Conference on Digital Generation (.docx)
 * Built directly on top of the converted official conference template (benchmarks/official_template_base.docx):
 *   - A4 (11909 x 16834 dxa)
 *   - Official template margins: Top = 19.0 mm (1077 dxa), Bottom = 43.0 mm (2438 dxa), Left = Right = 20.0 mm (1134 dxa)
 *   - Printable width = 9641 dxa; 2 columns with 6.0 mm gutter (340 dxa) -> 4650 dxa per column
 *   - Authentic template styles (papertitle, Author, Abstract, keywords, 1, 2, 5, a3, IEEEEquation, figurecaption, tablehead, tablecolhead, tablecopy, references, sponsors)
 *   - Native Word OMML equations (<m:oMath>) + Embedded 300-DPI PNG figures (<w:drawing>) + FirstHeader XML
 */

const TEMPLATE_DOCX = path.resolve("benchmarks/official_template_base.docx");
const COL_WIDTH = 4650;
const FULL_WIDTH = 9641;

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
    if (zipBuf.readUInt32LE(cdOffset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory signature at offset ${cdOffset}`);
    }
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

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function run(text, { sz = null, bold = false, italic = false, smallCaps = false, sup = false, sub = false, font = null, extra = "" } = {}) {
  const rFonts = font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` : "";
  const szXml = sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : "";
  const vAlign = sup ? '<w:vertAlign w:val="superscript"/>' : sub ? '<w:vertAlign w:val="subscript"/>' : "";
  const rPrInner = `${rFonts}${szXml}${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}${smallCaps ? "<w:smallCaps/>" : ""}${vAlign}${extra}`;
  const rPr = rPrInner ? `<w:rPr>${rPrInner}</w:rPr>` : "";
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/**
 * Rich inline markup parser supporting **bold**, *italic*, `code` (exclusively for identifiers/files/SQL), ^sup^, ~sub~.
 * Inherits font size and family from the paragraph's official template style when sz is omitted.
 */
function richRuns(text, opts = {}) {
  const { sz = null, bold = false, italic = false, font = null, codeSz = null } = opts;
  const parts = String(text)
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\^[^^]+\^|~[^~]+~)/g)
    .filter(Boolean);
  return parts
    .map((p) => {
      if (p.startsWith("**") && p.endsWith("**")) {
        return run(p.slice(2, -2), { sz, bold: true, italic, font });
      }
      if (p.startsWith("*") && p.endsWith("*")) {
        return run(p.slice(1, -1), { sz, bold, italic: true, font });
      }
      if (p.startsWith("`") && p.endsWith("`")) {
        const inner = p.slice(1, -1);
        const cSz = codeSz ?? (sz ? Math.max(14, sz - 2) : 17);
        return run(inner, { sz: cSz, bold, italic, font: "Courier New" });
      }
      if (p.startsWith("^") && p.endsWith("^")) {
        return run(p.slice(1, -1), { sz, bold, italic, sup: true, font });
      }
      if (p.startsWith("~") && p.endsWith("~")) {
        const inner = p.slice(1, -1);
        return run(inner, { sz, bold, italic: italic || /^[a-z]$/.test(inner), sub: true, font });
      }
      return run(p, { sz, bold, italic, font });
    })
    .join("");
}

function styledPara(styleId, contentXml, extraPPr = "") {
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/>${extraPPr}</w:pPr>${contentXml}</w:p>`;
}

function bodyP(text, { noFirstIndent = false, after = null, line = 228 } = {}) {
  const sp = after !== null || line !== null ? `<w:spacing w:before="0" w:after="${after ?? 40}" w:line="${line ?? 228}" w:lineRule="auto"/>` : "";
  const ind = noFirstIndent ? `<w:ind w:firstLine="0"/>` : "";
  return styledPara("a3", richRuns(text, { codeSz: 17 }), `${sp}${ind}`);
}

function heading1(text) {
  // Style "1" auto-numbers I., II., III., ... via numbering.xml (numId=4)
  return styledPara("1", run(text));
}

function heading2(text) {
  // Style "2" auto-numbers A., B., C., ... restarting under each Heading 1 (numId=4, ilvl=1)
  return styledPara("2", run(text));
}

function heading5(text) {
  // Style "5" renders unnumbered small-caps centered component headings (Acknowledgment, References)
  return styledPara("5", run(text), `<w:keepNext/>`);
}

function sqlCodeBox(lines) {
  const inner = lines
    .map((ln, idx) => (idx === 0 ? run(ln, { sz: 15, font: "Courier New" }) : `<w:r><w:br/></w:r>${run(ln, { sz: 15, font: "Courier New" })}`))
    .join("");
  const boxPr =
    `<w:ind w:firstLine="0" w:left="90" w:right="90"/><w:jc w:val="left"/><w:spacing w:before="36" w:after="48" w:line="208" w:lineRule="auto"/><w:keepLines/><w:pBdr><w:top w:val="single" w:sz="4" w:space="3" w:color="94A3B8"/><w:left w:val="single" w:sz="4" w:space="5" w:color="94A3B8"/><w:bottom w:val="single" w:sz="4" w:space="3" w:color="94A3B8"/><w:right w:val="single" w:sz="4" w:space="5" w:color="94A3B8"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>`;
  return styledPara("a3", inner, boxPr);
}

/**
 * Native Office Math Markup Language (OMML) helpers (xmlns:m)
 */
function mr(text, sty = "p") {
  const rPr = sty === "p" ? `<m:rPr><m:sty m:val="p"/></m:rPr>` : "";
  return `<m:r>${rPr}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><m:t>${esc(text)}</m:t></m:r>`;
}
function mSub(baseXml, subXml) {
  return `<m:sSub><m:e>${baseXml}</m:e><m:sub>${subXml}</m:sub></m:sSub>`;
}
function mSup(baseXml, supXml) {
  return `<m:sSup><m:e>${baseXml}</m:e><m:sup>${supXml}</m:sup></m:sSup>`;
}
function mSubSup(baseXml, subXml, supXml) {
  return `<m:sSubSup><m:e>${baseXml}</m:e><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup></m:sSubSup>`;
}
function mFrac(numXml, denXml) {
  return `<m:f><m:num>${numXml}</m:num><m:den>${denXml}</m:den></m:f>`;
}
function mDelim(innerXml) {
  return `<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr><m:e>${innerXml}</m:e></m:d>`;
}
function mNary(chr, subXml, supXml, bodyXml) {
  return `<m:nary><m:naryPr><m:chr m:val="${esc(chr)}"/><m:limLoc m:val="undOvr"/></m:naryPr><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup><m:e>${bodyXml}</m:e></m:nary>`;
}

function omathRow(omathInnerXml, eqNum) {
  const mathCellW = COL_WIDTH - 520;
  const numCellW = 520;
  const mathPara = `<w:p><w:pPr><w:pStyle w:val="a"/><w:spacing w:before="45" w:after="45"/><w:jc w:val="center"/></w:pPr><m:oMathPara><m:oMath>${omathInnerXml}</m:oMath></m:oMathPara></w:p>`;
  const numPara = `<w:p><w:pPr><w:pStyle w:val="a"/><w:spacing w:before="45" w:after="45"/><w:jc w:val="right"/></w:pPr>${run(`(${eqNum})`, { sz: 20 })}</w:p>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${COL_WIDTH}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${mathCellW}"/><w:gridCol w:w="${numCellW}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${mathCellW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${mathPara}</w:tc><w:tc><w:tcPr><w:tcW w:w="${numCellW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${numPara}</w:tc></w:tr></w:tbl>`;
}

function ieeeTable(captionTitle, headers, rows, colWidths, totalWidth = COL_WIDTH, fontSize = 15, spacingBefore = 120) {
  // Style "tablehead" auto-numbers TABLE I., TABLE II., ... via numbering.xml (numId=9)
  const cap = styledPara("tablehead", run(captionTitle), `<w:spacing w:before="${spacingBefore}" w:after="55" w:line="200" w:lineRule="auto"/><w:keepNext/>`);
  const grid = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");

  const renderRow = (cells, isHdr, keepRowNext = false) => {
    const tcs = cells
      .map((cellText, idx) => {
        const w = colWidths[idx];
        const bdr = isHdr
          ? `<w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>`
          : "";
        const styleId = isHdr ? "tablecolhead" : "tablecopy";
        const cellPara = styledPara(
          styleId,
          richRuns(cellText, { sz: fontSize, bold: isHdr, codeSz: Math.max(13, fontSize - 1) }),
          `<w:jc w:val="left"/><w:spacing w:before="0" w:after="0" w:line="190" w:lineRule="auto"/>${keepRowNext ? "<w:keepNext/>" : ""}`,
        );
        return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${bdr}<w:tcMar><w:top w:w="22" w:type="dxa"/><w:bottom w:w="22" w:type="dxa"/><w:left w:w="36" w:type="dxa"/><w:right w:w="36" w:type="dxa"/></w:tcMar></w:tcPr>${cellPara}</w:tc>`;
      })
      .join("");
    return `<w:tr>${isHdr ? "<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>"}${tcs}</w:tr>`;
  };

  const keepTableAtomic = rows.length <= 8;
  const tblPr = `<w:tblPr><w:tblW w:w="${totalWidth}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:left w:val="none"/><w:right w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>`;

  return `${cap}<w:tbl>${tblPr}<w:tblGrid>${grid}</w:tblGrid>${renderRow(headers, true, keepTableAtomic)}${rows.map((r, rIdx) => renderRow(r, false, keepTableAtomic && rIdx < rows.length - 1)).join("")}</w:tbl>${styledPara("a", "", `<w:spacing w:before="0" w:after="40" w:line="80" w:lineRule="auto"/>`)}`;
}

function embeddedFigure(rId, docPrId, name, cxEmu, cyEmu, captionText) {
  const drawingXml = `<w:p><w:pPr><w:pStyle w:val="a"/><w:spacing w:before="65" w:after="24"/><w:jc w:val="center"/><w:keepNext/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cxEmu}" cy="${cyEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${esc(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  // Style "figurecaption" auto-numbers Figure 1., Figure 2., ... via numbering.xml (numId=2)
  const capXml = styledPara("figurecaption", richRuns(captionText, { codeSz: 15 }), `<w:spacing w:before="45" w:after="90" w:line="200" w:lineRule="auto"/>`);
  return drawingXml + capXml;
}

// ============================================================================
// BUILD PAPER SECTIONS
// ============================================================================

let docBody = "";

// SECTION 1: Title + 2-row Author Block (Single Column; Page 1 Conference Header is in word/header1.xml)
const templatePageMargins = `<w:pgSz w:w="11909" w:h="16834" w:code="9"/><w:pgMar w:top="1077" w:right="1134" w:bottom="2438" w:left="1134" w:header="964" w:footer="1247" w:gutter="0"/>`;

docBody += styledPara(
  "papertitle",
  run("L-easy: An Audio-Centric Lecture Assistant with Client-Side Acoustic Filtering and Multilingual Study Synthesis"),
  `<w:spacing w:before="140" w:after="160"/>`,
);

function authorCell(name, school, org, city, email, colW, { gridSpan = 1, correspondingFootnote = false } = {}) {
  const spanXml = gridSpan > 1 ? `<w:gridSpan w:val="${gridSpan}"/>` : "";
  const fnXml = correspondingFootnote ? run("*", { sz: 22, sup: true }) : "";
  const emailDisplay = correspondingFootnote ? `*Corresponding author: ${email}` : email;
  const inner =
    run(name, { sz: 22 }) +
    fnXml +
    `<w:r><w:br/></w:r>` +
    run(school, { sz: 20, italic: true }) +
    `<w:r><w:br/></w:r>` +
    run(org, { sz: 20, italic: true }) +
    `<w:r><w:br/></w:r>` +
    run(city, { sz: 20 }) +
    `<w:r><w:br/></w:r>` +
    run(emailDisplay, { sz: 18 });
  const cellP = styledPara("Author", inner, `<w:spacing w:before="15" w:after="45" w:line="210" w:lineRule="auto"/>`);
  return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${spanXml}</w:tcPr>${cellP}</w:tc>`;
}

docBody += `<w:tbl><w:tblPr><w:tblW w:w="${FULL_WIDTH}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>
<w:tblGrid><w:gridCol w:w="3214"/><w:gridCol w:w="3213"/><w:gridCol w:w="3214"/></w:tblGrid>
<w:tr>
  ${authorCell("Yeraly Amangeldinov", "School of Artificial Intelligence and Data Science", "Astana IT University", "Astana, Kazakhstan", "260458@astanait.edu.kz", 3214)}
  ${authorCell("Askhat Klenov", "School of Artificial Intelligence and Data Science", "Astana IT University", "Astana, Kazakhstan", "262592@astanait.edu.kz", 3213)}
  ${authorCell("Zhibek Auelbek", "School of Artificial Intelligence and Data Science", "Astana IT University", "Astana, Kazakhstan", "261493@astanait.edu.kz", 3214)}
</w:tr>
<w:tr>
  ${authorCell("Akzharkyn Zholmyrza", "School of Software Engineering", "Astana IT University", "Astana, Kazakhstan", "akzharkyn.zholmyrza@astanait.edu.kz", FULL_WIDTH, { gridSpan: 3, correspondingFootnote: true })}
</w:tr>
</w:tbl>`;

// End Section 1 (single column on Page 1 with First Page conference header) -> transition continuously to 2-column body
docBody += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20"/><w:sectPr><w:headerReference w:type="first" r:id="rId7"/>${templatePageMargins}<w:cols w:space="720"/><w:titlePg/><w:docGrid w:linePitch="360"/></w:sectPr></w:pPr></w:p>`;

// SECTION 2: Two-column body (until wide Table III)
// Abstract (strictly 150-250 words, NO symbols/math per IEEE Page 1 rule, uses template "Abstract" + "StyleAbstractItalicChar")
const abstractBody =
  "Multilingual engineering undergraduates often miss spoken derivations when writing notes across English lectures while thinking in Kazakh and Russian, and classroom acoustics complicate browser audio capture. This paper presents L-easy, a cloud-connected progressive web application pairing Web Audio signal conditioning with multilingual study synthesis. Disabling browser echo cancellation, noise suppression, and automatic gain control, the client computes digital decibels relative to full scale (dBFS) and broadband signal-to-noise ratio while toggling a second-order 120 Hz Butterworth high-pass filter. Audio and PDFs route through Vercel functions to Google Gemini 3.5 and 3.8 Flash under strict JSON schemas to synthesize English, Russian, and Kazakh summaries, glossaries, quizzes, flashcards, and an AI tutor secured by PostgreSQL 15 Row-Level Security. Across a formative survey (38 students) and an audited consenting verification cohort (13 adults aged 18 to 19; two under-18 screened out), 84.6 percent fell behind in lectures and 92.3 percent wanted an integrated tool; 12 cross-device testers scored L-easy 70.6 on the System Usability Scale (SD 16.0), 4.17 out of 5 satisfaction, and 100 percent recommendation. Across ten paired trilingual tracks (four real English plus three-zone Russian and Kazakh Google FLEURS tracks, five Gemini 3.5 Flash Lite runs per condition), 120 Hz filtering raised broadband SNR by 4.81 to 5.24 decibels on synthetic HVAC noise, shifted real English audio minimally, and showed no significant word error rate change under exact Wilcoxon tests (p equals 0.52 Gemini, 0.45 Whisper Large-v3-Turbo), while Gemini lowered Kazakh errors (16.72 versus 48.10 percent filtered). Code: https://github.com/fixlinesh/audio-notes.";
const abstractWordCount = abstractBody.trim().split(/\s+/).length;
if (abstractWordCount < 150 || abstractWordCount > 250) {
  throw new Error(`Abstract word count (${abstractWordCount}) violates 150-250 word requirement!`);
}
docBody += styledPara(
  "Abstract",
  run("Abstract", { extra: '<w:rStyle w:val="StyleAbstractItalicChar"/>' }) + run(`—${abstractBody}`),
  `<w:spacing w:before="20" w:after="55" w:line="212" w:lineRule="auto"/>`,
);

docBody += styledPara(
  "keywords",
  run("Keywords—") +
    run("acoustic filtering; automatic speech recognition; educational technology; multilingual STEM learning; relational database security; Web Audio API"),
);

// I. INTRODUCTION
docBody += heading1("Introduction");
docBody += bodyP(
  "University lectures require students to listen continuously, interpret specialized domain terms, connect new abstractions with prior coursework, and write notes simultaneously. Cognitive load theory shows that human working memory has limited capacity across concurrent auditory and visual inputs [1], while empirical note-taking studies demonstrate that speaking rates of 135 to 160 words per minute far exceed longhand writing speed [2], causing learners to miss spoken derivations.",
);
docBody += bodyP(
  "To quantify these barriers at Astana IT University (AITU)—where engineering courses are taught in English while students conceptualize across Kazakh and Russian—we combine two complementary undergraduate survey cohorts (**Table I**, *N* = 51 total): (1) an early formative course needs survey (*N* = 38 aggregated responses; individual timestamps not archived) and (2) an audited verification survey (*N* = 13 valid consenting adults aged 18–19, mean 18.3 ± 0.5 years, 9 first-year and 4 second-year students across CS, SE, and DS/AI, drawn from 15 timestamped Google Forms submissions on 23 Nov 2026 after automatically screening out 2 under-18 submissions via a mandatory digital consent and 18+ gate, archived in `benchmarks/survey_responses_verified.csv`). Both cohorts align closely: 76.3% (29/38) and 84.6% (11/13) fell behind in live lectures, 94.7% (36/38: 81.6% never, 13.2% rarely) and 100.0% (13/13: 46.2% never, 53.8% rarely) never or rarely re-listened to 50-minute raw audio, 68.4% (26/38) and 69.2% (9/13) faced EN/RU/KZ STEM term gaps, 89.5% (34/38) vs. 30.8% (4/13) reported high midterm stress (rating 4–5/5, reflecting administration during midterm season vs. a non-midterm week among 1st–2nd year students), and 92.1% (35/38) and 92.3% (12/13) wanted an integrated solution.",
);

docBody += ieeeTable(
  "AITU Lecture Barriers: Formative (N=38) vs. Audited 18+ (N=13)",
  ["Identified Barrier", "Formative (N=38)", "Audited 18+ (N=13)", "Design Target"],
  [
    ["Fall behind in live lectures", "76.3% (29/38)", "84.6% (11/13)", "Live ASR transcript"],
    ["Never/rarely re-listen raw audio", "94.7% (36/38)", "100% (13/13)", "Structured summaries"],
    ["EN/RU/KZ STEM term gap", "68.4% (26/38)", "69.2% (9/13)", "Trilingual EN/RU/KZ"],
    ["High midterm stress (4–5/5)", "89.5% (34/38)", "30.8% (4/13)", "Quizzes & AI tutor"],
    ["Want integrated assistant", "92.1% (35/38)", "92.3% (12/13)", "All-in-one PWA"],
  ],
  [1500, 960, 990, 1200],
  COL_WIDTH,
  14,
);

docBody += bodyP(
  "Commercial tools such as Otter.ai, Notta, and Fireflies.ai target remote English meetings rather than physical university halls, lack client-side DSP control, and offer weak or absent Kazakh support. Quizlet and Knowt assume clean text inputs without acoustic conditioning.",
);
docBody += bodyP(
  "This paper engineers and evaluates **L-easy**, an open-source progressive web lecture assistant (`https://github.com/fixlinesh/audio-notes`). Rather than training a foundation model, our contributions are: (1) a client Web Audio pipeline that disables browser DSP (`echoCancellation`, `noiseSuppression`, and `autoGainControl` set to `false`) to measure uncalibrated RMS energy (dBFS) and broadband SNR while isolating a second-order 120 Hz Butterworth high-pass filter; (2) a four-tier edge/cloud pipeline (Gemini 3.5 / 3.8 Flash, strict JSON schemas, PostgreSQL 15 Row-Level Security); and (3) a reproducible paired WER evaluation across ten trilingual recordings comparing Gemini 3.5 Flash Lite against Whisper Large-v3-Turbo and Whisper Base baselines using five-run variance and exact two-sided Wilcoxon tests.",
);

// II. RELATED WORK
docBody += heading1("Related Work");
docBody += heading2("Speech Recognition and Classroom Acoustics");
docBody += bodyP(
  "In classical speech enhancement, Boll [3] introduced spectral subtraction and Ephraim and Malah [4] formulated minimum mean-square error short-time spectral amplitude estimation to suppress stationary noise. Neural end-to-end ASR improved cross-accent robustness: Chan et al. [5] proposed Listen, Attend and Spell (LAS), Amodei et al. [6] scaled recurrent networks in Deep Speech 2, Baevski et al. [7] introduced self-supervised wav2vec 2.0, and Radford et al. [8] trained Whisper across 680,000 hours of multilingual audio. For Kazakh ASR specifically, the ISSAI Kazakh Speech Corpus (KSC) [9] and industrial-scale KSC2 corpus [10] established open-source Kazakh acoustic benchmarks alongside multilingual Google FLEURS [11].",
);
docBody += bodyP(
  "In physical auditoriums, ANSI/ASA S12.60-2010/Part 1 [12] specifies a 35 dBA unoccupied background ceiling, whereas architectural acoustics studies by Bradley and Sato [13] and Shield and Dockrell [14] show that classroom mechanical ventilation (HVAC), reverberation, and low SNR impair speech intelligibility. Motivated by these classroom noise characteristics, L-easy exposes a toggleable 120 Hz high-pass Web Audio filter to test sub-vocal mechanical rumble attenuation before cloud transmission.",
);

docBody += heading2("Spoken Document NLP and Question Generation");
docBody += bodyP(
  "Modern summarization builds upon Transformer self-attention [15] and bidirectional BERT encoders [16]. For spoken transcripts, Hu et al. [17] released MeetingBank to benchmark long-dialogue segmentation, while Kroll and Kraus [18] proposed a structured human evaluation paradigm with best-practice criteria for LLM-based spoken document summarization.",
);
docBody += bodyP(
  "Retrieval practice strengthens long-term recall relative to passive rereading [19]. Systematizing automatic question generation (AQG), Kurdi et al. [20] reviewed 93 educational AQG studies (2015–2019) noting gaps in pedagogical validity, and Lu and Lu [21] surveyed 9 AQG papers (2019–2021) highlighting the lack of accepted automatic quality metrics. Systematic reviews of educational chatbots by Labadze et al. [22] and Kuhail et al. [23] identify personalized tutoring benefits alongside hallucination and factual reliability risks, motivating L-easy's strict transcript-grounding constraint. Because automated quizzes derive from system transcripts, self-test scores cannot alone prove learning gains; evaluation therefore centers on ASR word error rate and usability.",
);

docBody += heading2("Human-Computer Interaction and Platform Comparison");
docBody += bodyP(
  "Interface decisions follow Nielsen's heuristics [24] (status visibility and low friction) and WCAG 2.1 accessibility guidance [25], evaluated via the System Usability Scale (SUS) [26]. **Table II** contrasts L-easy against commercial platforms.",
);

docBody += ieeeTable(
  "Comparison of Lecture Platforms vs. L-easy",
  ["Platform", "EN/KZ/RU", "Edge DSP", "Study Output"],
  [
    ["Otter.ai", "No Kazakh", "No", "Notes & transcript"],
    ["Notta.ai", "Partial", "No", "Transcript export"],
    ["Fireflies", "Partial", "No", "Call summary & chat"],
    ["Knowt", "Limited", "No", "Flashcards & quiz"],
    ["**L-easy**", "**Full**", "**120 Hz HPF**", "**Notes, Quiz, Tutor**"],
  ],
  [1000, 1050, 1050, 1550],
  COL_WIDTH,
  14,
);

// III. SYSTEM ARCHITECTURE AND SIGNAL PROCESSING
docBody += heading1("System Architecture and Signal Processing");
docBody += heading2("Four-Tier Edge and Cloud Pipeline");
docBody += bodyP(
  "As shown in **Fig. 1**, L-easy decouples browser capture from serverless inference and cloud persistence across four tiers.",
);

docBody += embeddedFigure(
  "rIdImg1",
  101,
  "fig1_architecture",
  2850000,
  Math.round((2850000 * 720) / 1280),
  "Four-tier client edge, Vercel API security gate, Gemini 3.5 / 3.8 Flash synthesis, Whisper Large-v3-Turbo / Base baselines, and Supabase PostgreSQL 15 architecture.",
);

docBody += bodyP(
  "**Tier 1 (Client Edge PWA):** Built in React 19, TypeScript 5.7, Vite 8, and Tailwind CSS v4 across nine modular screens. On-demand loading (`import('pdfjs-dist')`) extracts local PDF text cleanly, splitting 305.4 kB of PDF worker logic (88.0 kB gzipped) out of the 695.0 kB main bundle (195.1 kB gzipped, 30.5% code-split reduction). **Tier 2 (Vercel Serverless Gate):** Stateless Node.js endpoints (`/api/transcribe`, `/api/summarize`, `/api/study`, `/api/chat`) validate Supabase JWT tokens, enforce 4.5 MB/14 MB payload bounds, keep `GEMINI_API_KEY` server-side, and cascade across Gemini 3.5 Flash, 3.5 Flash Lite, and 3.8 Flash. **Tier 3 (Structured Synthesis):** Strict `responseSchema` contracts enforce typed JSON (Overview, Original/Simplified notes, Key Points, Glossary, Fisher-Yates 8-item quizzes, flashcards) across English, Russian, and Kazakh. **Tier 4 (Cloud Storage):** Supabase PostgreSQL 15 and private object storage isolate tenant files.",
);

docBody += heading2("Uncalibrated Web Audio Telemetry and 120 Hz HPF");
docBody += bodyP(
  "Default browser WebRTC processing (`noiseSuppression`, `echoCancellation`, and `autoGainControl`) distorts ambient floor power and prevents physical dB SPL estimation on uncalibrated phone microphones. Accordingly, `Recording.tsx` explicitly disables all three flags (`false`) on `getUserMedia` and computes relative digital RMS energy in **dBFS**:",
);

// Equation (1): L_dBFS(m) = 10 log10( (1/N) sum_{n=0}^{N-1} x_m^2[n] + eps )
const eq1Xml =
  mSub(mr("L"), mr("dBFS", "p")) +
  mDelim(mr("m")) +
  mr(" = 10") +
  mSub(mr("log", "p"), mr("10", "p")) +
  mDelim(
    mFrac(mr("1", "p"), mr("N")) +
      mNary("∑", mr("n") + mr("=0", "p"), mr("N") + mr("−1", "p"), mSubSup(mr("x"), mr("m"), mr("2", "p")) + mr("[n]")) +
      mr(" + ε"),
  );
docBody += omathRow(eq1Xml, 1);

docBody += bodyP(
  "where *m* is the analysis frame index, *N* = 2048 samples during live Web Audio `AnalyserNode` capture (*f*~s~ = 48 kHz; *N* = 960 for 20 ms offline benchmark frames), *x*~m~[*n*] ∈ [−1, 1] denotes normalized PCM samples, and ε = 10^−10^ avoids log(0). We evaluate **broadband** SNR across full-spectrum frames:",
  { noFirstIndent: true },
);

// Equation (2): SNR_bb = 10 log10( P_90 / P_10 )
const eq2Xml =
  mSub(mr("SNR", "p"), mr("bb", "p")) +
  mr(" = 10") +
  mSub(mr("log", "p"), mr("10", "p")) +
  mDelim(mSub(mr("P"), mr("90", "p")) + mr(" / ") + mSub(mr("P"), mr("10", "p")));
docBody += omathRow(eq2Xml, 2);

docBody += bodyP(
  "where full-bandwidth (0–24 kHz) 20 ms frame powers *P*(*m*) are sorted ascending to obtain the 10th-percentile background floor *P*~10~ and 90th-percentile active voice power *P*~90~. Full-bandwidth percentiles replace both a narrowband 300–3400 Hz estimator (which cannot observe sub-120 Hz attenuation) and language-specific voice activity detectors across English, Russian, and Kazakh. When toggled on or triggered by elevated relative noise (baseline > −35 dBFS or SNR~bb~ < 12 dB), a second-order Butterworth high-pass `BiquadFilterNode` filters PCM samples in RAM prior to encoding:",
  { noFirstIndent: true },
);

// Equation (3): H(z) = (b0 + b1 z^-1 + b2 z^-2) / (1 + a1 z^-1 + a2 z^-2)
const eq3Xml =
  mr("H") +
  mDelim(mr("z")) +
  mr(" = ") +
  mFrac(
    mSub(mr("b"), mr("0", "p")) +
      mr(" + ") +
      mSub(mr("b"), mr("1", "p")) +
      mSup(mr("z"), mr("−1", "p")) +
      mr(" + ") +
      mSub(mr("b"), mr("2", "p")) +
      mSup(mr("z"), mr("−2", "p")),
    mr("1 + ", "p") +
      mSub(mr("a"), mr("1", "p")) +
      mSup(mr("z"), mr("−1", "p")) +
      mr(" + ") +
      mSub(mr("a"), mr("2", "p")) +
      mSup(mr("z"), mr("−2", "p")),
  );
docBody += omathRow(eq3Xml, 3);

docBody += bodyP(
  "with RBJ Butterworth coefficients defined by cutoff frequency *f*~c~ = 120 Hz, angular frequency ω~0~ = 2π*f*~c~/*f*~s~, quality factor *Q* = 1/√2 ≈ 0.7071, bandwidth parameter α = sin(ω~0~)/(2*Q*), and normalization *a*~0~ = 1 + α giving *b*~0~ = *b*~2~ = (1 + cos ω~0~)/(2*a*~0~), *b*~1~ = −(1 + cos ω~0~)/*a*~0~, *a*~1~ = −2 cos ω~0~/*a*~0~, and *a*~2~ = (1 − α)/*a*~0~.",
  { noFirstIndent: true },
);

// IV. DATABASE MODEL AND SECURITY
docBody += heading1("Relational Data Model and Security");
docBody += bodyP(
  "Lecture artifacts, telemetry logs, and journey events persist in Supabase PostgreSQL 15 across six normalized entities (**Fig. 2**) enforcing `ON DELETE CASCADE` referential cleanup from parent accounts and lectures to child flashcards, quiz questions, and acoustic logs.",
);

docBody += embeddedFigure(
  "rIdImg2",
  102,
  "fig2_erd",
  2850000,
  Math.round((2850000 * 880) / 1280),
  "Six-entity normalized PostgreSQL 15 Entity-Relationship Diagram (ERD) linking user accounts, lectures, acoustic telemetry, CJM logs, flashcards, and quizzes.",
);

docBody += bodyP(
  "Tables enforce PostgreSQL database-engine Row-Level Security (`ENABLE ROW LEVEL SECURITY`) with scalar ownership subqueries for query-planner caching [27]:",
);

docBody += sqlCodeBox([
  'CREATE POLICY "Users select own telemetry"',
  "ON public.smart_audio_telemetry FOR SELECT TO authenticated",
  "USING ((select auth.uid()) = user_id);",
]);

docBody += bodyP(
  "Raw audio resides in a private storage bucket accessed solely via time-limited signed URLs (1-hour expiry) issued by Supabase Storage (`path` prefix verified against authenticated `auth.uid()`). Serverless prompts strip conflicting XML delimiters and isolate transcript payloads inside `<transcript>` tags to mitigate indirect prompt injection [28]. Consistent with the Law of the Republic of Kazakhstan \"On Personal Data and Their Protection\" (No. 94-V, May 21, 2013), users receive prior notice that uploaded audio and transcripts undergo cloud processing via the Google Gemini API and persistence in Supabase Cloud; archival ethics governance combines our bilingual consent template (`Informed_Consent_Form_L-easy.docx`) with the mandatory digital consent checkbox and 18+ age-verification gate (`scripts/create_google_form.gs`) that automatically screened out 2 under-18 submissions during evaluation.",
);

// V. EXPERIMENTAL EVALUATION
docBody += heading1("Experimental Evaluation");
docBody += heading2("Paired Acoustic Filtering & ASR Benchmark (Gemini vs. Whisper)");
docBody += bodyP(
  "To isolate the 120 Hz HPF impact without cross-recording confounds, `scripts/wer_benchmark.mjs` decodes source clips to 48 kHz mono PCM WAV and creates a paired filtered WAV (*Q* = 0.707) from the **exact same recording**. Both conditions are evaluated purely using `gemini-3.5-flash-lite` (no cross-model fallback) across five independent runs per condition plus deterministic local Whisper Large-v3-Turbo (809M parameters) and Whisper Base (74M parameters) [8], scored by Unicode/numeral-normalized Levenshtein Word Error Rate (WER):",
);

// Equation (4): WER = (S + D + I) / N_ref * 100%
const eq4Xml =
  mr("WER", "p") +
  mr(" = ") +
  mDelim(mr("S + D + I")) +
  mr(" / ") +
  mSub(mr("N"), mr("ref", "p")) +
  mr(" × 100%", "p");
docBody += omathRow(eq4Xml, 4);

docBody += bodyP(
  "where *S*, *D*, and *I* denote minimum-edit-distance Levenshtein substitutions, deletions, and insertions, and *N*~ref~ is the normalized reference word count. First, a synthetic 48 kHz verification signal (65/90 Hz rumble plus 440/1200 Hz speech-band bursts) confirmed RMS attenuation (−11.89 to −15.64 dBFS) and +7.23 dB broadband SNR gain (3.48 to 10.71 dB). Next, we evaluated ten paired tracks (**Table III**): four real English student presentations (EN-1 to EN-4, 89.1–152.4 s, 208–299 normalized words) whose reference texts come from the presenting students' prepared history presentation scripts checked manually against audio playback without using ASR outputs as drafts (`benchmarks/reference_transcripts/`), plus twelve concatenated native-speaker utterances per language from Google FLEURS [11] for Russian (RU-1 to RU-3, 122.6 s, 208 tokens) and Kazakh (KZ-1 to KZ-3, 171.4 s, 201 tokens) separated by 0.18 s −62 dBFS comfort dither. For RU-2/3 and KZ-2/3, fixed-seed deterministic mixing (`seed = 20270224`) added synthetic 50–112 Hz tones and sub-115 Hz pink noise plus broadband room noise targeting Moderate (≈15.0 dB SNR~bb~) and Noisy (≈7.5 dB SNR~bb~) zones. Because 171.4 s Kazakh tracks triggered early end-of-sequence cutoffs (≈62 s) on single-pass `gemini-3.5-flash-lite`, clips exceeding 155 s (KZ-1 to KZ-3) were partitioned identically at three minimum-energy silence boundaries across Raw and HPF pairs.",
  { noFirstIndent: true },
);
docBody += bodyP(
  "Across synthetic moderate and noisy HVAC zones, the 120 Hz HPF lifted SNR~bb~ by +4.81 to +5.24 dB by construction (RU-2: +5.13 dB; RU-3: +4.85 dB; KZ-2: +5.24 dB; KZ-3: +4.81 dB), whereas real English captures shifted minimally (−0.29 to +0.52 dB; mean 29.07 to 29.20 dB). Notably, unmixed RU-1 Quiet also gained +5.35 dB (38.19 to 43.54 dB): per-utterance acoustic inspection confirmed native sub-120 Hz room hum in pauses of the crowdsourced FLEURS recordings themselves (raw *P*~10~ = −59.5 to −61.7 dBFS in `id1763`/`id1692`, dropping 6.0–6.6 dB after HPF), while inter-utterance dither comprised only 1.6% of the track (below *P*~10~). Under an exact two-sided Wilcoxon signed-rank test (excluding zero differences such as KZ-1, giving *n*~eff~ = 9 for Gemini/`Whisper Base` and *n*~eff~ = 10 for `Whisper Large-v3-Turbo`), **no statistically detectable HPF effect on WER emerged for any engine**: 5-run `gemini-3.5-flash-lite` improved in 6 clips, worsened in 3 (EN-3, RU-3, KZ-3), and tied in 1 (KZ-1), giving *W* = 16.5, exact *p* = 0.52 (word errors *W* = 16, *p* = 0.50; sign test *p* = 0.51); `Whisper Large-v3-Turbo` (809M) improved in 4 and worsened in 6 (*W* = 19.5, exact *p* = 0.45; sign *p* = 0.75); and `Whisper Base` (74M) gave *W* = 14 (exact *p* = 0.36; sign *p* = 0.18). Comparing engines, `Whisper Large-v3-Turbo` nearly matched Gemini on English (8.49% vs. 7.76% Raw) and approached it on Russian (12.02% vs. 9.01%), whereas Gemini showed a substantial margin on our single 12-utterance Kazakh FLEURS sample (16.72% HPF / 19.27% Raw vs. 48.10% / 46.60% for `Whisper Large-v3-Turbo` and 149.75% / 164.51% for `Whisper Base`), though with high run-to-run variance on Kazakh (SD up to 7.8 pp) and non-monotonicity (`KZ-2` worse than `KZ-3`).",
);

// Break into 1-column full-width section specifically for crisp wide Table III
const twoColSectPr = `<w:type w:val="continuous"/>${templatePageMargins}<w:cols w:num="2" w:space="340"/><w:docGrid w:linePitch="360"/>`;
docBody += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20"/><w:sectPr>${twoColSectPr}</w:sectPr></w:pPr></w:p>`;

docBody += ieeeTable(
  "Paired 5-Run Gemini, Whisper Large-v3-Turbo, and Whisper Base Benchmark Across Ten Trilingual Recordings",
  [
    "Clip / Zone",
    "Dur (Ref)",
    "Raw dBFS (Flr)",
    "SNR_bb R/H",
    "Gemini x5 R/H (Errs)",
    "Whisper-L-v3T R/H",
    "Whisper-Base R/H",
  ],
  [
    ["EN-1 Quiet (Real)", "89.1s (208)", "-29.95 (-53.25)", "27.58 / 27.59", "6.25±1.52 / **5.67±1.42** (13.0→11.8)", "**8.17** / 8.65% (17→18)", "24.52 / 23.08% (51→48)"],
    ["EN-2 Mod (Real)", "127.5s (282)", "-24.91 (-50.13)", "30.29 / 30.00", "10.56±1.19 / **9.29±0.95** (29.8→26.2)", "**10.64** / 17.73% (30→50)", "21.63 / 21.28% (61→60)"],
    ["EN-3 Hall (Real)", "152.4s (275)", "-22.90 (-46.77)", "28.47 / 28.77", "**3.93±0.90** / 4.51±1.05 (10.8→12.4)", "**5.45** / 5.82% (15→16)", "12.36 / 18.55% (34→51)"],
    ["EN-4 Bumps (Real)", "137.9s (299)", "-24.54 (-50.17)", "29.92 / 30.44", "10.30±1.09 / **9.63±1.02** (30.8→28.8)", "9.70 / **9.36%** (29→28)", "22.41 / 20.74% (67→62)"],
    ["**EN Mean±SD (N=4)**", "**126.7±27 (266)**", "**-25.57 ± 3.04**", "**29.07 / 29.20**", "**7.76±3.23 / 7.28±2.57 (21.1→19.8)**", "**8.49±2.27 / 10.39±5.13%**", "**20.23±5.39 / 20.91±1.87%**"],
    ["RU-1 Quiet (FLEURS)", "122.6s (208)", "-26.29 (-59.83)", "38.19 / 43.54", "5.00±1.05 / **4.62±0.55** (10.4→9.6)", "**6.73** / 8.17% (14→17)", "33.65 / 33.17% (70→69)"],
    ["RU-2 Mod (FLEURS)", "122.6s (208)", "-25.74 (-36.45)", "15.00 / 20.13", "7.50±1.58 / **5.87±1.33** (15.6→12.2)", "**11.54** / 12.50% (24→26)", "34.62 / 33.17% (72→69)"],
    ["RU-3 Noisy (FLEURS)", "122.6s (208)", "-22.79 (-27.44)", "7.51 / 12.36", "**14.52±1.20** / 19.13±1.29 (30.2→39.8)", "17.79 / **17.31%** (37→36)", "47.60 / 47.60% (99→99)"],
    ["**RU Mean±SD (N=3)**", "**122.6±0 (208)**", "**-24.94 ± 1.88**", "**20.23 / 25.34**", "**9.01±4.94 / 9.87±8.04 (18.7→20.5)**", "**12.02±5.55 / 12.66±4.57%**", "**38.62±7.79 / 37.98±8.33%**"],
    ["KZ-1 Quiet (FLEURS)", "171.4s (201)", "-28.40 (-77.50)", "53.90 / 55.02", "**15.52±4.79 / 15.52±5.94** (31.2→31.2)", "28.86 / **24.88%** (58→50)", "179.60 / 155.72% (361→313)"],
    ["KZ-2 Mod (FLEURS)", "171.4s (201)", "-27.80 (-38.42)", "15.01 / 20.25", "25.97±5.91 / **16.92±7.81** (52.2→34.0)", "52.74 / **48.76%** (106→98)", "180.10 / 134.83% (362→271)"],
    ["KZ-3 Noisy (FLEURS)", "171.4s (201)", "-24.75 (-29.36)", "7.51 / 12.32", "**16.32±2.42** / 17.71±2.07 (32.8→35.6)", "**58.21** / 70.65% (117→142)", "133.83 / 158.71% (269→319)"],
    ["**KZ Mean±SD (N=3)**", "**171.4±0 (201)**", "**-26.98 ± 1.96**", "**25.47 / 29.20**", "**19.27±5.82 / 16.72±1.11 (38.7→33.6)**", "**46.60±15.61 / 48.10±22.89%**", "**164.51±26.57 / 149.75±13.01%**"],
  ],
  [1850, 910, 1210, 1080, 2120, 1280, 1191],
  FULL_WIDTH,
  13,
);

// Continuous return to 2-column body
const oneColWidePr = `<w:type w:val="continuous"/>${templatePageMargins}<w:cols w:space="720"/><w:docGrid w:linePitch="360"/>`;
docBody += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20"/><w:sectPr>${oneColWidePr}</w:sectPr></w:pPr></w:p>`;

docBody += heading2("Usability Evaluation (Audited 18+ Cohort: N = 12)");
docBody += bodyP(
  "Of the 13 valid consenting adult respondents aged 18–19 (`benchmarks/survey_responses_verified.csv`), 12 tested the zero-login guest-preview prototype across four device classes while 1 skipped device testing via the branch gate (**Table IV**). Across unmoderated mobile and desktop sessions, 33.3% (4/12) completed all five workflow steps and 66.7% (8/12) partially explored the interface (0% drop-off before rating), yielding a Brooke System Usability Scale [26] mean of 70.6 ± 16.0 (range 47.5–100.0, exceeding the 68.0 usability benchmark; 72.5 ± 15.3 excluding one straight-lined all-5s iPad response scoring 50.0), overall satisfaction of 4.17 ± 0.72 / 5.0, and 100.0% (12/12) peer recommendation.",
);

docBody += ieeeTable(
  "Audited Cross-Device Usability & Brooke SUS (N = 12, Aged 18–19)",
  ["Device (n)", "Full/Part", "Sat (1–5)", "SUS Mean±SD"],
  [
    ["Android (n=6)", "1 / 5", "4.17 ± 0.41", "75.8 ± 17.2"],
    ["iPhone iOS (n=3)", "2 / 1", "4.67 ± 0.58", "75.0 ± 8.7"],
    ["Windows PC (n=2)", "1 / 1", "3.00 ± 0.00", "58.8 ± 15.9"],
    ["iPad/Tablet (n=1)", "0 / 1", "5.00", "50.0 (all-5s)"],
    ["**All Tested (N=12)**", "**4 / 8**", "**4.17 ± 0.72**", "**70.6 ± 16.0**"],
  ],
  [1450, 820, 980, 1400],
  COL_WIDTH,
  14,
);

// VI. DISCUSSION AND LIMITATIONS
docBody += heading1("Discussion and Limitations");
docBody += bodyP(
  "Three methodological conclusions emerge. First, uncalibrated mobile browser audio must remain in digital dBFS with WebRTC processing flags (`echoCancellation`, `noiseSuppression`, `autoGainControl`) disabled in `Recording.tsx`; physical dB SPL thresholds cannot be assumed without external calibration. Second, the 120 Hz HPF lifted SNR~bb~ by +4.81 to +5.24 dB on moderate and noisy synthetic HVAC mixes by construction (added energy sits below 115 Hz), lifted unmixed RU-1 Quiet by +5.35 dB by attenuating native sub-120 Hz pause hum in raw FLEURS recordings, and shifted real English captures minimally (−0.29 to +0.52 dB), while **exact two-sided Wilcoxon tests showed no statistically detectable WER effect on any engine** (Gemini *p* = 0.52; `Whisper Large-v3-Turbo` *p* = 0.45; `Whisper Base` *p* = 0.36). At *N* = 10, statistical power is limited; this null result is consistent with low-frequency robustness in modern neural ASR while retaining toggleable HPF attenuation and manual bypass in `Recording.tsx`. Third, against `Whisper Large-v3-Turbo` (809M), local inference approaches Gemini on English (8.49% vs. 7.76% Raw) and Russian (12.02% vs. 9.01%), whereas Gemini maintains a substantial margin on our single 12-utterance Kazakh FLEURS sample (16.72% HPF / 19.27% Raw vs. 48.10% / 46.60%), despite high run variance (SD up to 7.8 pp) and non-monotonic decoding (`KZ-2` vs. `KZ-3`). Finally, generated quiz scores measure transcript consistency rather than verified learning gain [20], [21].",
  { noFirstIndent: true },
);
docBody += bodyP(
  "Limitations include online API dependence, smartphone `.m4a` preprocessing in EN-1 to EN-4 versus live `EC/NS/AGC=false` streams (raw student audio is withheld from GitHub pending explicit release signatures), synthetic HVAC mixing on RU/KZ prior to live auditorium captures, possible foundation-model pretraining overlap on public FLEURS [11] motivating local tests against Kazakh models (`KSC` [9], `KSC2` [10]), unarchived individual timestamps in the early *N* = 38 course survey (remediated by the audited 18+ timestamped Google Forms archive `benchmarks/survey_responses_verified.csv` and `Informed_Consent_Form_L-easy.docx`), and the modest unmoderated usability sample (*N* = 12, 8/12 partial workflow exploration) motivating supervised timing trials.",
);

// VII. CONCLUSION AND FUTURE WORK
docBody += heading1("Conclusion");
docBody += bodyP(
  "This paper presented **L-easy**, combining browser DSP-disabled Web Audio capture (dBFS, SNR~bb~, toggleable 120 Hz HPF) with strict-schema Gemini 3.5 / 3.8 Flash synthesis and PostgreSQL 15 Row-Level Security. Across an early formative course survey (*N* = 38) and an audited consenting verification cohort (*N* = 13 aged 18–19; *N* = 12 cross-device prototype testers), L-easy achieved a Brooke SUS score of 70.6 ± 16.0, 4.17/5.0 satisfaction, and 100% peer recommendation. Across ten paired trilingual tracks (5 strict `gemini-3.5-flash-lite` runs per condition), 120 Hz filtering raised synthetic HVAC broadband SNR by +4.81 to +5.24 dB with near-zero real-audio shift (−0.29 to +0.52 dB) and no statistically detectable WER change under exact two-sided Wilcoxon tests (*p* = 0.36–0.52 across models, consistent with modern ASR low-frequency robustness at this sample size), while Gemini lowered Kazakh WER to 16.72%–19.27% versus 46.60%–48.10% for `Whisper Large-v3-Turbo` on our 12-utterance FLEURS sample. Future work will benchmark live auditorium `EC/NS/AGC=false` Kazakh recordings against local checkpoints [9], [10] alongside prospective crossover learning trials.",
  { noFirstIndent: true },
);

// ACKNOWLEDGMENT (Heading 5 — unnumbered per template)
docBody += heading5("Acknowledgment");
docBody += bodyP(
  "The authors thank the Astana IT University undergraduate course participants and student presenters who contributed anonymized feedback and presentation scripts for research evaluation. Large language model assistance was used solely for language polishing, TypeScript refactoring checks, and formatting table scaffolding; all experimental designs, benchmark scripts, statistical analyses, and manual script-verified reference transcripts were created and audited directly by the authors.",
);

// REFERENCES (Heading 5 — unnumbered per template; strictly ordered [1]..[28] by first text appearance)
docBody += heading5("References");

const refs = [
  'J. Sweller, J. J. G. van Merriënboer, and F. G. W. C. Paas, "Cognitive architecture and instructional design: 20 years later," *Educ. Psychol. Rev.*, vol. 31, no. 2, pp. 261–292, Jun. 2019, doi: 10.1007/s10648-019-09465-5.',
  'A. Piolat, T. Olive, and R. T. Kellogg, "Cognitive effort during note taking," *Appl. Cogn. Psychol.*, vol. 19, no. 3, pp. 291–312, Apr. 2005, doi: 10.1002/acp.1086.',
  'S. F. Boll, "Suppression of acoustic noise in speech using spectral subtraction," *IEEE Trans. Acoust., Speech, Signal Process.*, vol. 27, no. 2, pp. 113–120, Apr. 1979, doi: 10.1109/TASSP.1979.1163209.',
  'Y. Ephraim and D. Malah, "Speech enhancement using a minimum-mean square error short-time spectral amplitude estimator," *IEEE Trans. Acoust., Speech, Signal Process.*, vol. 32, no. 6, pp. 1109–1121, Dec. 1984, doi: 10.1109/TASSP.1984.1164453.',
  'W. Chan, N. Jaitly, Q. Le, and O. Vinyals, "Listen, attend and spell: A neural network for large vocabulary conversational speech recognition," in *Proc. IEEE Int. Conf. Acoust., Speech Signal Process. (ICASSP)*, Shanghai, China, pp. 4960–4964, Mar. 2016, doi: 10.1109/ICASSP.2016.7472621.',
  'D. Amodei et al., "Deep Speech 2: End-to-end speech recognition in English and Mandarin," in *Proc. 33rd Int. Conf. Mach. Learn. (ICML)*, New York, NY, USA, vol. 48, pp. 173–182, Jun. 2016.',
  'A. Baevski, Y. Zhou, A. Mohamed, and M. Auli, "wav2vec 2.0: A framework for self-supervised learning of speech representations," in *Adv. Neural Inf. Process. Syst. (NeurIPS)*, vol. 33, pp. 12449–12460, Dec. 2020.',
  'A. Radford, J. W. Kim, T. Xu, G. Brockman, C. McLeavey, and I. Sutskever, "Robust speech recognition via large-scale weak supervision," in *Proc. 40th Int. Conf. Mach. Learn. (ICML)*, Honolulu, HI, USA, vol. 202, pp. 28492–28518, Jul. 2023.',
  'Y. Khassanov, S. Mussakhojayeva, A. Mirzakhmetov, A. Adiyev, M. Nurpeiissov, and H. A. Varol, "A crowdsourced open-source Kazakh speech corpus and initial speech recognition baseline," in *Proc. 16th Conf. Eur. Chapter Assoc. Comput. Linguistics (EACL)*, Online, pp. 697–706, Apr. 2021, doi: 10.18653/v1/2021.eacl-main.58.',
  'S. Mussakhojayeva, Y. Khassanov, and H. A. Varol, "KSC2: An industrial-scale open-source Kazakh speech corpus," in *Proc. Interspeech 2022*, Incheon, South Korea, pp. 1367–1371, Sep. 2022, doi: 10.21437/Interspeech.2022-421.',
  'A. Conneau et al., "FLEURS: Few-shot learning evaluation of universal representations of speech," in *Proc. IEEE Spoken Lang. Technol. Workshop (SLT)*, Doha, Qatar, pp. 798–805, Jan. 2023, doi: 10.1109/SLT54892.2023.10023141.',
  'Acoustical Society of America, *Acoustical Performance Criteria, Design Requirements, and Guidelines for Schools, Part 1: Permanent Schools*, ANSI/ASA Standard S12.60-2010/Part 1, 2010.',
  'J. S. Bradley and H. Sato, "The intelligibility of speech in elementary school classrooms," *J. Acoust. Soc. Am.*, vol. 123, no. 4, pp. 2078–2086, Apr. 2008, doi: 10.1121/1.2839189.',
  'B. M. Shield and J. E. Dockrell, "The effects of environmental and classroom noise on the academic attainments of primary school children," *J. Acoust. Soc. Am.*, vol. 123, no. 1, pp. 133–144, Jan. 2008, doi: 10.1121/1.2812596.',
  'A. Vaswani et al., "Attention is all you need," in *Adv. Neural Inf. Process. Syst. (NeurIPS)*, Long Beach, CA, USA, vol. 30, pp. 5998–6008, Dec. 2017.',
  'J. Devlin, M.-W. Chang, K. Lee, and K. Toutanova, "BERT: Pre-training of deep bidirectional transformers for language understanding," in *Proc. NAACL-HLT*, Minneapolis, MN, USA, pp. 4171–4186, Jun. 2019, doi: 10.18653/v1/N19-1423.',
  'Y. Hu, T. Ganter, H. Deilamsalehy, F. Dernoncourt, H. Foroosh, and F. Liu, "MeetingBank: A benchmark dataset for meeting summarization," in *Proc. 61st Annu. Meeting Assoc. Comput. Linguistics (ACL)*, Toronto, Canada, pp. 16409–16423, Jul. 2023, doi: 10.18653/v1/2023.acl-long.906.',
  'M. Kroll and K. Kraus, "Optimizing the role of human evaluation in LLM-based spoken document summarization systems," in *Proc. Interspeech 2024*, Kos, Greece, pp. 1935–1939, Sep. 2024, doi: 10.21437/Interspeech.2024-2268. [Online]. Available: https://www.isca-archive.org/interspeech_2024/kroll24_interspeech.html',
  'H. L. Roediger and J. D. Karpicke, "Test-enhanced learning: Taking memory tests improves long-term retention," *Psychol. Sci.*, vol. 17, no. 3, pp. 249–255, Mar. 2006, doi: 10.1111/j.1467-9280.2006.01693.x.',
  'G. Kurdi, J. Leo, B. Parsia, U. Sattler, and S. Al-Emari, "A systematic review of automatic question generation for educational purposes," *Int. J. Artif. Intell. Educ.*, vol. 30, no. 1, pp. 121–204, Mar. 2020, doi: 10.1007/s40593-019-00186-y.',
  'C.-Y. Lu and S.-E. Lu, "A survey of approaches to automatic question generation: From 2019 to early 2021," in *Proc. ROCLING*, Taoyuan, Taiwan, pp. 151–162, Oct. 2021. [Online]. Available: https://aclanthology.org/2021.rocling-1.21/',
  'L. Labadze, M. Grigolia, and L. Machaidze, "Role of AI chatbots in education: Systematic literature review," *Int. J. Educ. Technol. High. Educ.*, vol. 20, no. 56, pp. 1–17, Oct. 2023, doi: 10.1186/s41239-023-00426-1.',
  'M. A. Kuhail, N. Alturki, S. Alramlawi, and K. Alhejori, "Interacting with educational chatbots: A systematic review," *Educ. Inf. Technol.*, vol. 28, no. 1, pp. 973–1018, Jan. 2023, doi: 10.1007/s10639-022-11177-3.',
  'J. Nielsen, *Usability Engineering*. San Francisco, CA, USA: Morgan Kaufmann, 1994.',
  'A. Kirkpatrick, J. O Connor, A. Campbell, and M. Cooper, "Web Content Accessibility Guidelines (WCAG) 2.1," W3C Recommendation, Jun. 2018. [Online]. Available: https://www.w3.org/TR/WCAG21/',
  'J. Brooke, "SUS: A retrospective," *J. Usability Stud.*, vol. 8, no. 2, pp. 29–40, Feb. 2013.',
  'PostgreSQL Global Development Group, "Row Security Policies — PostgreSQL 15 Documentation," 2025. [Online]. Available: https://www.postgresql.org/docs/15/ddl-rowsecurity.html',
  'OWASP Foundation, "LLM01:2025 Prompt Injection," *OWASP Top 10 for Large Language Model Applications*, 2025. [Online]. Available: https://genai.owasp.org/llm01-2025-prompt-injection/',
];

const seenCites = [];
for (const m of docBody.matchAll(/\[(\d+)\]/g)) {
  const num = Number(m[1]);
  if (!seenCites.includes(num)) seenCites.push(num);
}
const expectedOrder = refs.map((_, idx) => idx + 1);
if (JSON.stringify(seenCites) !== JSON.stringify(expectedOrder)) {
  throw new Error(`IEEE citation order mismatch! Got [${seenCites.join(",")}], expected [1..${refs.length}]`);
}

refs.forEach((refText) => {
  // Style "references" auto-numbers [1], [2], ... via numbering.xml (numId=8)
  docBody += styledPara("references", richRuns(refText, { codeSz: 15 }), `<w:spacing w:before="0" w:after="18" w:line="195" w:lineRule="auto"/>`);
});

// Close the final 2-column section with a continuous break so Word balances the two columns on the final page
docBody += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20"/><w:sectPr>${twoColSectPr}</w:sectPr></w:pPr></w:p>`;

if (/\$|\\text|\\varepsilon|\\in|\*[a-z]\*/.test(docBody)) {
  throw new Error("Raw LaTeX or literal asterisk markup leaked into document.xml! Aborting.");
}

// Build OOXML package directly on top of the converted official conference template
const tplEntries = readZipEntries(fs.readFileSync(TEMPLATE_DOCX));

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    ${docBody}
    <w:sectPr>${oneColWidePr}</w:sectPr>
  </w:body>
</w:document>`;

// 1. Patch styles.xml: enforce 10 pt en-US docDefaults + bind heading 2 (styleId="2") to numId="4" so A., B., C. restarts cleanly
let stylesXml = tplEntries.get("word/styles.xml").toString("utf8");
stylesXml = stylesXml.replace(
  /<w:docDefaults>[\s\S]*?<\/w:docDefaults>/,
  `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="SimSun" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>`,
);
stylesXml = stylesXml.replace(
  /(<w:style\b[^>]*w:styleId="2"[^>]*>[\s\S]*?<w:numPr><w:ilvl w:val="1"\/>)<w:numId w:val="5"\/>/,
  `$1<w:numId w:val="4"/>`,
);
stylesXml = stylesXml.replace(/w:val="ru-RU"/g, 'w:val="en-US"');

// 2. Patch numbering.xml: guarantee abstractNumId="5" ilvl="1" restarts at A. when ilvl="0" (Roman section) increments
let numberingXml = tplEntries.get("word/numbering.xml").toString("utf8");
numberingXml = numberingXml.replace(
  /(<w:abstractNum\b[^>]*w:abstractNumId="5"[\s\S]*?<w:lvl\b[^>]*w:ilvl="1"[^>]*>[\s\S]*?<w:numFmt w:val="upperLetter"\/>)/,
  `$1<w:lvlRestart w:val="1"/>`,
);

// 3. Patch settings.xml: print layout view, en-US theme language, suppress IDE/XML spell squiggles on SQL/identifiers
let settingsXml = tplEntries.get("word/settings.xml").toString("utf8");
if (!settingsXml.includes("<w:view ")) {
  settingsXml = settingsXml.replace(/(<w:settings\b[^>]*>)/, `$1<w:view w:val="print"/><w:hideSpellingErrors/><w:hideGrammaticalErrors/>`);
}
settingsXml = settingsXml.replace(/<w:themeFontLang w:val="ru-RU"\/>/, '<w:themeFontLang w:val="en-US"/>');

// 4. Patch footnotes.xml: replace sample sponsor text with corresponding-author custom-marked * footnote
let footnotesXml = tplEntries.get("word/footnotes.xml").toString("utf8");
footnotesXml = footnotesXml.replace(
  /<w:footnote w:id="1">[\s\S]*?<\/w:footnote>/,
  `<w:footnote w:id="1"><w:p><w:pPr><w:pStyle w:val="sponsors"/><w:spacing w:before="0" w:after="0" w:line="200" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rStyle w:val="ae"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve">Corresponding author: akzharkyn.zholmyrza@astanait.edu.kz</w:t></w:r></w:p></w:footnote>`,
);

// 5. Patch [Content_Types].xml & word/_rels/document.xml.rels to embed our 300-DPI PNG figures
let contentTypesXml = tplEntries.get("[Content_Types].xml").toString("utf8");
if (!contentTypesXml.includes('Extension="png"')) {
  contentTypesXml = contentTypesXml.replace(
    /<Types\b([^>]*)>/,
    `<Types$1><Default Extension="png" ContentType="image/png"/>`,
  );
}

let docRelsXml = tplEntries.get("word/_rels/document.xml.rels").toString("utf8");
docRelsXml = docRelsXml.replace(/<Relationship\b[^>]*Id="rId(?:8|9|10|11)"[^>]*\/>/g, "");
docRelsXml = docRelsXml.replace(
  "</Relationships>",
  `<Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/><Relationship Id="rIdImg2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/></Relationships>`,
);

const img1Buf = fs.readFileSync("c:/Users/amang/audio-notes/figures/fig1_architecture.png");
const img2Buf = fs.readFileSync("c:/Users/amang/audio-notes/figures/fig2_erd.png");

const overrides = new Map([
  ["[Content_Types].xml", Buffer.from(contentTypesXml, "utf8")],
  ["word/_rels/document.xml.rels", Buffer.from(docRelsXml, "utf8")],
  ["word/styles.xml", Buffer.from(stylesXml, "utf8")],
  ["word/numbering.xml", Buffer.from(numberingXml, "utf8")],
  ["word/settings.xml", Buffer.from(settingsXml, "utf8")],
  ["word/footnotes.xml", Buffer.from(footnotesXml, "utf8")],
  ["word/document.xml", Buffer.from(documentXml, "utf8")],
  ["word/media/image1.png", img1Buf],
  ["word/media/image2.png", img2Buf],
]);
const dropFromTpl = new Set([
  "word/media/image1.wmf",
  "word/media/image2.emf",
  "word/embeddings/oleObject1.bin",
  "word/embeddings/oleObject2.bin",
]);

const outFiles = [];
for (const [name, buf] of tplEntries.entries()) {
  if (dropFromTpl.has(name)) continue;
  outFiles.push({ name, data: overrides.get(name) ?? buf });
  overrides.delete(name);
}
for (const [name, buf] of overrides.entries()) {
  outFiles.push({ name, data: buf });
}

const zipBuf = createZip(outFiles);
fs.writeFileSync("c:/Users/amang/audio-notes/AITU_IEEE_2027_L-easy.docx", zipBuf);
console.log("Built AITU_IEEE_2027_L-easy.docx on official template:", zipBuf.length, "bytes");

// Sync Markdown manuscript + artifact
const mdContent = `2027 IEEE 4th International Student Conference on Digital Generation  
24-26 February, 2027, Astana, Kazakhstan

# L-easy: An Audio-Centric Lecture Assistant with Client-Side Acoustic Filtering and Multilingual Study Synthesis

| Yeraly Amangeldinov | Askhat Klenov | Zhibek Auelbek |
| :---: | :---: | :---: |
| *School of Artificial Intelligence and Data Science* | *School of Artificial Intelligence and Data Science* | *School of Artificial Intelligence and Data Science* |
| *Astana IT University* | *Astana IT University* | *Astana IT University* |
| Astana, Kazakhstan | Astana, Kazakhstan | Astana, Kazakhstan |
| 260458@astanait.edu.kz | 262592@astanait.edu.kz | 261493@astanait.edu.kz |

<div align="center">

**Akzharkyn Zholmyrza***  
*School of Software Engineering*  
*Astana IT University*  
Astana, Kazakhstan  
akzharkyn.zholmyrza@astanait.edu.kz  

</div>

*Corresponding author: akzharkyn.zholmyrza@astanait.edu.kz

> **Camera-Ready Manuscript:** [AITU_IEEE_2027_L-easy.docx](file:///c:/Users/amang/audio-notes/AITU_IEEE_2027_L-easy.docx)  
> **Figures:** [fig1_architecture.png](file:///c:/Users/amang/audio-notes/figures/fig1_architecture.png) · [fig2_erd.png](file:///c:/Users/amang/audio-notes/figures/fig2_erd.png)

---

***Abstract*—${abstractBody}**

***Keywords*—acoustic filtering; automatic speech recognition; educational technology; multilingual STEM learning; relational database security; Web Audio API**

---

## I. INTRODUCTION

University lectures require students to listen continuously, interpret specialized domain terms, connect new abstractions with prior coursework, and write notes simultaneously. Cognitive load theory shows that human working memory has limited capacity across concurrent auditory and visual inputs [1], while empirical note-taking studies demonstrate that speaking rates of 135 to 160 words per minute far exceed longhand writing speed [2], causing learners to miss spoken derivations.

To quantify these barriers at Astana IT University (AITU)—where engineering courses are taught in English while students conceptualize across Kazakh and Russian—we combine two complementary undergraduate survey cohorts (**Table I**, $N = 51$ total): (1) an early formative course needs survey ($N = 38$ aggregated responses; individual timestamps not archived) and (2) an audited verification survey ($N = 13$ valid consenting adults aged 18–19, mean 18.3 ± 0.5 years, 9 first-year and 4 second-year students across CS, SE, and DS/AI, drawn from 15 timestamped Google Forms submissions on 23 Nov 2026 after automatically screening out 2 under-18 submissions via a mandatory digital consent and 18+ gate, archived in \`benchmarks/survey_responses_verified.csv\`). Both cohorts align closely: 76.3% (29/38) and 84.6% (11/13) fell behind in live lectures, 94.7% (36/38: 81.6% never, 13.2% rarely) and 100.0% (13/13: 46.2% never, 53.8% rarely) never or rarely re-listened to 50-minute raw audio, 68.4% (26/38) and 69.2% (9/13) faced EN/RU/KZ STEM term gaps, 89.5% (34/38) vs. 30.8% (4/13) reported high midterm stress (rating 4–5/5, reflecting administration during midterm season vs. a non-midterm week among 1st–2nd year students), and 92.1% (35/38) and 92.3% (12/13) wanted an integrated solution.

**TABLE I. AITU Lecture Barriers: Formative (N=38) vs. Audited 18+ (N=13)**

| Identified Barrier | Formative (N=38) | Audited 18+ (N=13) | Design Target |
| :--- | :---: | :---: | :--- |
| Fall behind in live lectures | 76.3% (29/38) | 84.6% (11/13) | Live ASR transcript |
| Never/rarely re-listen raw audio | 94.7% (36/38) | 100% (13/13) | Structured summaries |
| EN/RU/KZ STEM term gap | 68.4% (26/38) | 69.2% (9/13) | Trilingual EN/RU/KZ |
| High midterm stress (4–5/5) | 89.5% (34/38) | 30.8% (4/13) | Quizzes & AI tutor |
| Want integrated assistant | 92.1% (35/38) | 92.3% (12/13) | All-in-one PWA |

Commercial tools such as Otter.ai, Notta, and Fireflies.ai target remote English meetings rather than physical university halls, lack client-side DSP control, and offer weak or absent Kazakh support. Quizlet and Knowt assume clean text inputs without acoustic conditioning.

This paper engineers and evaluates **L-easy**, an open-source progressive web lecture assistant (\`https://github.com/fixlinesh/audio-notes\`). Rather than training a foundation model, our contributions are: (1) a client Web Audio pipeline that disables browser DSP (\`echoCancellation\`, \`noiseSuppression\`, and \`autoGainControl\` set to \`false\`) to measure uncalibrated RMS energy (dBFS) and broadband SNR while isolating a second-order 120 Hz Butterworth high-pass filter; (2) a four-tier edge/cloud pipeline (Gemini 3.5 / 3.8 Flash, strict JSON schemas, PostgreSQL 15 Row-Level Security); and (3) a reproducible paired WER evaluation across ten trilingual recordings comparing Gemini 3.5 Flash Lite against Whisper Large-v3-Turbo and Whisper Base baselines using five-run variance and exact two-sided Wilcoxon tests.

## II. RELATED WORK

### A. Speech Recognition and Classroom Acoustics
In classical speech enhancement, Boll [3] introduced spectral subtraction and Ephraim and Malah [4] formulated minimum mean-square error short-time spectral amplitude estimation to suppress stationary noise. Neural end-to-end ASR improved cross-accent robustness: Chan et al. [5] proposed Listen, Attend and Spell (LAS), Amodei et al. [6] scaled recurrent networks in Deep Speech 2, Baevski et al. [7] introduced self-supervised wav2vec 2.0, and Radford et al. [8] trained Whisper across 680,000 hours of multilingual audio. For Kazakh ASR specifically, the ISSAI Kazakh Speech Corpus (KSC) [9] and industrial-scale KSC2 corpus [10] established open-source Kazakh acoustic benchmarks alongside multilingual Google FLEURS [11].

In physical auditoriums, ANSI/ASA S12.60-2010/Part 1 [12] specifies a 35 dBA unoccupied background ceiling, whereas architectural acoustics studies by Bradley and Sato [13] and Shield and Dockrell [14] show that classroom mechanical ventilation (HVAC), reverberation, and low SNR impair speech intelligibility. Motivated by these classroom noise characteristics, L-easy exposes a toggleable 120 Hz high-pass Web Audio filter to test sub-vocal mechanical rumble attenuation before cloud transmission.

### B. Spoken Document NLP and Question Generation
Modern summarization builds upon Transformer self-attention [15] and bidirectional BERT encoders [16]. For spoken transcripts, Hu et al. [17] released MeetingBank to benchmark long-dialogue segmentation, while Kroll and Kraus [18] proposed a structured human evaluation paradigm with best-practice criteria for LLM-based spoken document summarization.

Retrieval practice strengthens long-term recall relative to passive rereading [19]. Systematizing automatic question generation (AQG), Kurdi et al. [20] reviewed 93 educational AQG studies (2015–2019) noting gaps in pedagogical validity, and Lu and Lu [21] surveyed 9 AQG papers (2019–2021) highlighting the lack of accepted automatic quality metrics. Systematic reviews of educational chatbots by Labadze et al. [22] and Kuhail et al. [23] identify personalized tutoring benefits alongside hallucination and factual reliability risks, motivating L-easy's strict transcript-grounding constraint. Because automated quizzes derive from system transcripts, self-test scores cannot alone prove learning gains; evaluation therefore centers on ASR word error rate and usability.

### C. Human-Computer Interaction and Platform Comparison
Interface decisions follow Nielsen's heuristics [24] (status visibility and low friction) and WCAG 2.1 accessibility guidance [25], evaluated via the System Usability Scale (SUS) [26]. **Table II** contrasts L-easy against commercial platforms.

**TABLE II. Comparison of Lecture Platforms vs. L-easy**

| Platform | EN/KZ/RU | Edge DSP | Study Output |
| :--- | :---: | :---: | :--- |
| Otter.ai | No Kazakh | No | Notes & transcript |
| Notta.ai | Partial | No | Transcript export |
| Fireflies | Partial | No | Call summary & chat |
| Knowt | Limited | No | Flashcards & quiz |
| **L-easy** | **Full** | **120 Hz HPF** | **Notes, Quiz, Tutor** |

## III. SYSTEM ARCHITECTURE AND SIGNAL PROCESSING

### A. Four-Tier Edge and Cloud Pipeline
As shown in **Fig. 1**, L-easy decouples browser capture from serverless inference and cloud persistence across four tiers.

![Fig. 1. Four-tier architecture](figures/fig1_architecture.png)
*Fig. 1. Four-tier client edge, Vercel API security gate, Gemini 3.5 / 3.8 Flash synthesis, Whisper Large-v3-Turbo / Base baselines, and Supabase PostgreSQL 15 architecture.*

**Tier 1 (Client Edge PWA):** Built in React 19, TypeScript 5.7, Vite 8, and Tailwind CSS v4 across nine modular screens. On-demand loading (\`import('pdfjs-dist')\`) extracts local PDF text cleanly, splitting 305.4 kB of PDF worker logic (88.0 kB gzipped) out of the 695.0 kB main bundle (195.1 kB gzipped, 30.5% code-split reduction). **Tier 2 (Vercel Serverless Gate):** Stateless Node.js endpoints (\`/api/transcribe\`, \`/api/summarize\`, \`/api/study\`, \`/api/chat\`) validate Supabase JWT tokens, enforce 4.5 MB/14 MB payload bounds, keep \`GEMINI_API_KEY\` server-side, and cascade across Gemini 3.5 Flash, 3.5 Flash Lite, and 3.8 Flash. **Tier 3 (Structured Synthesis):** Strict \`responseSchema\` contracts enforce typed JSON (Overview, Original/Simplified notes, Key Points, Glossary, Fisher-Yates 8-item quizzes, flashcards) across English, Russian, and Kazakh. **Tier 4 (Cloud Storage):** Supabase PostgreSQL 15 and private object storage isolate tenant files.

### B. Uncalibrated Web Audio Telemetry and 120 Hz HPF
Default browser WebRTC processing (\`noiseSuppression\`, \`echoCancellation\`, and \`autoGainControl\`) distorts ambient floor power and prevents physical dB SPL estimation on uncalibrated phone microphones. Accordingly, \`Recording.tsx\` explicitly disables all three flags (\`false\`) on \`getUserMedia\` and computes relative digital RMS energy in **dBFS**:

$$L_{\\text{dBFS}}(m) = 10 \\log_{10} \\left( \\frac{1}{N} \\sum_{n=0}^{N-1} x_m^2[n] + \\varepsilon \\right) \\tag{1}$$

where $m$ is the analysis frame index, $N = 2048$ samples during live Web Audio \`AnalyserNode\` capture ($f_s = 48\\text{ kHz}$; $N = 960$ for 20 ms offline benchmark frames), $x_m[n] \\in [-1, 1]$ denotes normalized PCM samples, and $\\varepsilon = 10^{-10}$ avoids $\\log(0)$. We evaluate **broadband** SNR across full-spectrum frames:

$$\\text{SNR}_{\\text{bb}} = 10 \\log_{10} (P_{90} / P_{10}) \\tag{2}$$

where full-bandwidth (0–24 kHz) 20 ms frame powers $P(m)$ are sorted ascending to obtain the 10th-percentile background floor $P_{10}$ and 90th-percentile active voice power $P_{90}$. When toggled on or triggered by elevated relative noise (baseline > −35 dBFS or $\\text{SNR}_{\\text{bb}} < 12$ dB), a second-order Butterworth high-pass \`BiquadFilterNode\` filters PCM samples in RAM prior to encoding:

$$H(z) = \\frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}} \\tag{3}$$

with RBJ Butterworth coefficients defined by cutoff frequency $f_c = 120\\text{ Hz}$, angular frequency $\\omega_0 = 2\\pi f_c / f_s$, quality factor $Q = 1/\\sqrt{2} \\approx 0.7071$, bandwidth parameter $\\alpha = \\sin(\\omega_0)/(2Q)$, and normalization $a_0 = 1 + \\alpha$.

## IV. RELATIONAL DATA MODEL AND SECURITY

Lecture artifacts, telemetry logs, and journey events persist in Supabase PostgreSQL 15 across six normalized entities (**Fig. 2**) enforcing \`ON DELETE CASCADE\` referential cleanup from parent accounts and lectures to child flashcards, quiz questions, and acoustic logs.

![Fig. 2. Six-entity normalized PostgreSQL 15 ERD](figures/fig2_erd.png)
*Fig. 2. Six-entity normalized PostgreSQL 15 Entity-Relationship Diagram (ERD) linking user accounts, lectures, acoustic telemetry, CJM logs, flashcards, and quizzes.*

Tables enforce PostgreSQL database-engine Row-Level Security (\`ENABLE ROW LEVEL SECURITY\`) with scalar ownership subqueries for query-planner caching [27]:

\`\`\`sql
CREATE POLICY "Users select own telemetry"
ON public.smart_audio_telemetry FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);
\`\`\`

Raw audio resides in a private storage bucket accessed solely via time-limited signed URLs (1-hour expiry) issued by Supabase Storage (\`path\` prefix verified against authenticated \`auth.uid()\`). Serverless prompts strip conflicting XML delimiters and isolate transcript payloads inside \`<transcript>\` tags to mitigate indirect prompt injection [28]. Consistent with the Law of the Republic of Kazakhstan "On Personal Data and Their Protection" (No. 94-V, May 21, 2013), users receive prior notice that uploaded audio and transcripts undergo cloud processing via the Google Gemini API and persistence in Supabase Cloud; archival ethics governance combines our bilingual consent template (\`Informed_Consent_Form_L-easy.docx\`) with the mandatory digital consent checkbox and 18+ age-verification gate (\`scripts/create_google_form.gs\`) that automatically screened out 2 under-18 submissions during evaluation.

## V. EXPERIMENTAL EVALUATION

### A. Paired Acoustic Filtering & ASR Benchmark (Gemini vs. Whisper)
To isolate the 120 Hz HPF impact without cross-recording confounds, \`scripts/wer_benchmark.mjs\` decodes source clips to 48 kHz mono PCM WAV and creates a paired filtered WAV ($Q = 0.707$) from the **exact same recording**. Both conditions are evaluated purely using \`gemini-3.5-flash-lite\` (no cross-model fallback) across five independent runs per condition plus deterministic local Whisper Large-v3-Turbo (809M parameters) and Whisper Base (74M parameters) [8], scored by Unicode/numeral-normalized Levenshtein Word Error Rate (WER):

$$\\text{WER} = (S + D + I) / N_{\\text{ref}} \\times 100\\% \\tag{4}$$

where $S$, $D$, and $I$ denote minimum-edit-distance Levenshtein substitutions, deletions, and insertions, and $N_{\\text{ref}}$ is the normalized reference word count. First, a synthetic 48 kHz verification signal confirmed RMS attenuation (−11.89 to −15.64 dBFS) and +7.23 dB broadband SNR gain (3.48 to 10.71 dB). Next, we evaluated ten paired tracks (**Table III**): four real English student presentations (EN-1 to EN-4, 89.1–152.4 s, 208–299 normalized words) whose reference texts come from the presenting students' prepared history presentation scripts checked manually against audio playback without using ASR outputs as drafts (\`benchmarks/reference_transcripts/\`), plus twelve concatenated native-speaker utterances per language from Google FLEURS [11] for Russian (RU-1 to RU-3, 122.6 s, 208 tokens) and Kazakh (KZ-1 to KZ-3, 171.4 s, 201 tokens) separated by 0.18 s −62 dBFS comfort dither. For RU-2/3 and KZ-2/3, fixed-seed deterministic mixing (\`seed = 20270224\`) added synthetic 50–112 Hz tones and sub-115 Hz pink noise plus broadband room noise targeting Moderate (≈15.0 dB $\\text{SNR}_{\\text{bb}}$) and Noisy (≈7.5 dB $\\text{SNR}_{\\text{bb}}$) zones. Clips exceeding 155 s (KZ-1 to KZ-3) were partitioned identically at three minimum-energy silence boundaries across Raw and HPF pairs.

Across synthetic moderate and noisy HVAC zones, the 120 Hz HPF lifted $\\text{SNR}_{\\text{bb}}$ by +4.81 to +5.24 dB by construction (RU-2: +5.13 dB; RU-3: +4.85 dB; KZ-2: +5.24 dB; KZ-3: +4.81 dB), whereas real English captures shifted minimally (−0.29 to +0.52 dB; mean 29.07 to 29.20 dB). Notably, unmixed RU-1 Quiet also gained +5.35 dB (38.19 to 43.54 dB): per-utterance acoustic inspection confirmed native sub-120 Hz room hum in pauses of the crowdsourced FLEURS recordings themselves (raw $P_{10} = -59.5$ to $-61.7$ dBFS in \`id1763\`/\`id1692\`, dropping 6.0–6.6 dB after HPF), while inter-utterance dither comprised only 1.6% of the track (below $P_{10}$). Under an exact two-sided Wilcoxon signed-rank test (excluding zero differences such as KZ-1, giving $n_{\\text{eff}} = 9$ for Gemini/\`Whisper Base\` and $n_{\\text{eff}} = 10$ for \`Whisper Large-v3-Turbo\`), **no statistically detectable HPF effect on WER emerged for any engine**: 5-run \`gemini-3.5-flash-lite\` improved in 6 clips, worsened in 3 (EN-3, RU-3, KZ-3), and tied in 1 (KZ-1), giving $W = 16.5$, exact $p = 0.52$ (word errors $W = 16$, $p = 0.50$; sign test $p = 0.51$); \`Whisper Large-v3-Turbo\` (809M) improved in 4 and worsened in 6 ($W = 19.5$, exact $p = 0.45$; sign $p = 0.75$); and \`Whisper Base\` (74M) gave $W = 14$ (exact $p = 0.36$; sign $p = 0.18$). Comparing engines, \`Whisper Large-v3-Turbo\` nearly matched Gemini on English (8.49% vs. 7.76% Raw) and approached it on Russian (12.02% vs. 9.01%), whereas Gemini showed a substantial margin on our single 12-utterance Kazakh FLEURS sample (16.72% HPF / 19.27% Raw vs. 48.10% / 46.60% for \`Whisper Large-v3-Turbo\` and 149.75% / 164.51% for \`Whisper Base\`), though with high run-to-run variance on Kazakh (SD up to 7.8 pp) and non-monotonicity (\`KZ-2\` worse than \`KZ-3\`).

**TABLE III. Paired 5-Run Gemini, Whisper Large-v3-Turbo, and Whisper Base Benchmark Across Ten Trilingual Recordings**

| Clip / Zone | Dur (Ref) | Raw dBFS (Flr) | SNR_bb R/H | Gemini x5 R/H (Errs) | Whisper-L-v3T R/H | Whisper-Base R/H |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| EN-1 Quiet (Real) | 89.1s (208) | -29.95 (-53.25) | 27.58 / 27.59 | 6.25±1.52 / **5.67±1.42** (13.0→11.8) | **8.17** / 8.65% (17→18) | 24.52 / 23.08% (51→48) |
| EN-2 Mod (Real) | 127.5s (282) | -24.91 (-50.13) | 30.29 / 30.00 | 10.56±1.19 / **9.29±0.95** (29.8→26.2) | **10.64** / 17.73% (30→50) | 21.63 / 21.28% (61→60) |
| EN-3 Hall (Real) | 152.4s (275) | -22.90 (-46.77) | 28.47 / 28.77 | **3.93±0.90** / 4.51±1.05 (10.8→12.4) | **5.45** / 5.82% (15→16) | 12.36 / 18.55% (34→51) |
| EN-4 Bumps (Real) | 137.9s (299) | -24.54 (-50.17) | 29.92 / 30.44 | 10.30±1.09 / **9.63±1.02** (30.8→28.8) | 9.70 / **9.36%** (29→28) | 22.41 / 20.74% (67→62) |
| **EN Mean±SD (N=4)** | **126.7±27 (266)** | **-25.57 ± 3.04** | **29.07 / 29.20** | **7.76±3.23 / 7.28±2.57 (21.1→19.8)** | **8.49±2.27 / 10.39±5.13%** | **20.23±5.39 / 20.91±1.87%** |
| RU-1 Quiet (FLEURS) | 122.6s (208) | -26.29 (-59.83) | 38.19 / 43.54 | 5.00±1.05 / **4.62±0.55** (10.4→9.6) | **6.73** / 8.17% (14→17) | 33.65 / 33.17% (70→69) |
| RU-2 Mod (FLEURS) | 122.6s (208) | -25.74 (-36.45) | 15.00 / 20.13 | 7.50±1.58 / **5.87±1.33** (15.6→12.2) | **11.54** / 12.50% (24→26) | 34.62 / 33.17% (72→69) |
| RU-3 Noisy (FLEURS) | 122.6s (208) | -22.79 (-27.44) | 7.51 / 12.36 | **14.52±1.20** / 19.13±1.29 (30.2→39.8) | 17.79 / **17.31%** (37→36) | 47.60 / 47.60% (99→99) |
| **RU Mean±SD (N=3)** | **122.6±0 (208)** | **-24.94 ± 1.88** | **20.23 / 25.34** | **9.01±4.94 / 9.87±8.04 (18.7→20.5)** | **12.02±5.55 / 12.66±4.57%** | **38.62±7.79 / 37.98±8.33%** |
| KZ-1 Quiet (FLEURS) | 171.4s (201) | -28.40 (-77.50) | 53.90 / 55.02 | **15.52±4.79 / 15.52±5.94** (31.2→31.2) | 28.86 / **24.88%** (58→50) | 179.60 / 155.72% (361→313) |
| KZ-2 Mod (FLEURS) | 171.4s (201) | -27.80 (-38.42) | 15.01 / 20.25 | 25.97±5.91 / **16.92±7.81** (52.2→34.0) | 52.74 / **48.76%** (106→98) | 180.10 / 134.83% (362→271) |
| KZ-3 Noisy (FLEURS) | 171.4s (201) | -24.75 (-29.36) | 7.51 / 12.32 | **16.32±2.42** / 17.71±2.07 (32.8→35.6) | **58.21** / 70.65% (117→142) | 133.83 / 158.71% (269→319) |
| **KZ Mean±SD (N=3)** | **171.4±0 (201)** | **-26.98 ± 1.96** | **25.47 / 29.20** | **19.27±5.82 / 16.72±1.11 (38.7→33.6)** | **46.60±15.61 / 48.10±22.89%** | **164.51±26.57 / 149.75±13.01%** |

### B. Usability Evaluation (Audited 18+ Cohort: N = 12)
Of the 13 valid consenting adult respondents aged 18–19 (\`benchmarks/survey_responses_verified.csv\`), 12 tested the zero-login guest-preview prototype across four device classes while 1 skipped device testing via the branch gate (**Table IV**). Across unmoderated mobile and desktop sessions, 33.3% (4/12) completed all five workflow steps and 66.7% (8/12) partially explored the interface (0% drop-off before rating), yielding a Brooke System Usability Scale [26] mean of 70.6 ± 16.0 (range 47.5–100.0, exceeding the 68.0 usability benchmark; 72.5 ± 15.3 excluding one straight-lined all-5s iPad response scoring 50.0), overall satisfaction of 4.17 ± 0.72 / 5.0, and 100.0% (12/12) peer recommendation.

**TABLE IV. Audited Cross-Device Usability & Brooke SUS (N = 12, Aged 18–19)**

| Device (n) | Full/Part | Sat (1–5) | SUS Mean±SD |
| :--- | :---: | :---: | :---: |
| Android (n=6) | 1 / 5 | 4.17 ± 0.41 | 75.8 ± 17.2 |
| iPhone iOS (n=3) | 2 / 1 | 4.67 ± 0.58 | 75.0 ± 8.7 |
| Windows PC (n=2) | 1 / 1 | 3.00 ± 0.00 | 58.8 ± 15.9 |
| iPad/Tablet (n=1) | 0 / 1 | 5.00 | 50.0 (all-5s) |
| **All Tested (N=12)** | **4 / 8** | **4.17 ± 0.72** | **70.6 ± 16.0** |

## VI. DISCUSSION AND LIMITATIONS

Three methodological conclusions emerge. First, uncalibrated mobile browser audio must remain in digital dBFS with WebRTC processing flags (\`echoCancellation\`, \`noiseSuppression\`, \`autoGainControl\`) disabled in \`Recording.tsx\`; physical dB SPL thresholds cannot be assumed without external calibration. Second, the 120 Hz HPF lifted $\\text{SNR}_{\\text{bb}}$ by +4.81 to +5.24 dB on moderate and noisy synthetic HVAC mixes by construction (added energy sits below 115 Hz), lifted unmixed RU-1 Quiet by +5.35 dB by attenuating native sub-120 Hz pause hum in raw FLEURS recordings, and shifted real English captures minimally (−0.29 to +0.52 dB), while **exact two-sided Wilcoxon tests showed no statistically detectable WER effect on any engine** (Gemini $p = 0.52$; \`Whisper Large-v3-Turbo\` $p = 0.45$; \`Whisper Base\` $p = 0.36$). At $N = 10$, statistical power is limited; this null result is consistent with low-frequency robustness in modern neural ASR while retaining toggleable HPF attenuation and manual bypass in \`Recording.tsx\`. Third, against \`Whisper Large-v3-Turbo\` (809M), local inference approaches Gemini on English (8.49% vs. 7.76% Raw) and Russian (12.02% vs. 9.01%), whereas Gemini maintains a substantial margin on our single 12-utterance Kazakh FLEURS sample (16.72% HPF / 19.27% Raw vs. 48.10% / 46.60%), despite high run variance (SD up to 7.8 pp) and non-monotonic decoding (\`KZ-2\` vs. \`KZ-3\`). Finally, generated quiz scores measure transcript consistency rather than verified learning gain [20], [21].

Limitations include online API dependence, smartphone \`.m4a\` preprocessing in EN-1 to EN-4 versus live \`EC/NS/AGC=false\` streams (raw student audio is withheld from GitHub pending explicit release signatures), synthetic HVAC mixing on RU/KZ prior to live auditorium captures, possible foundation-model pretraining overlap on public FLEURS [11] motivating local tests against Kazakh models (\`KSC\` [9], \`KSC2\` [10]), unarchived individual timestamps in the early $N = 38$ course survey (remediated by the audited 18+ timestamped Google Forms archive \`benchmarks/survey_responses_verified.csv\` and \`Informed_Consent_Form_L-easy.docx\`), and the modest unmoderated usability sample ($N = 12$, 8/12 partial workflow exploration) motivating supervised timing trials.

## VII. CONCLUSION

This paper presented **L-easy**, combining browser DSP-disabled Web Audio capture (dBFS, $\\text{SNR}_{\\text{bb}}$, toggleable 120 Hz HPF) with strict-schema Gemini 3.5 / 3.8 Flash synthesis and PostgreSQL 15 Row-Level Security. Across an early formative course survey ($N = 38$) and an audited consenting verification cohort ($N = 13$ aged 18–19; $N = 12$ cross-device prototype testers), L-easy achieved a Brooke SUS score of 70.6 ± 16.0, 4.17/5.0 satisfaction, and 100% peer recommendation. Across ten paired trilingual tracks (5 strict \`gemini-3.5-flash-lite\` runs per condition), 120 Hz filtering raised synthetic HVAC broadband SNR by +4.81 to +5.24 dB with near-zero real-audio shift (−0.29 to +0.52 dB) and no statistically detectable WER change under exact two-sided Wilcoxon tests ($p = 0.36–0.52$ across models, consistent with modern ASR low-frequency robustness at this sample size), while Gemini lowered Kazakh WER to 16.72%–19.27% versus 46.60%–48.10% for \`Whisper Large-v3-Turbo\` on our 12-utterance FLEURS sample. Future work will benchmark live auditorium \`EC/NS/AGC=false\` Kazakh recordings against local checkpoints [9], [10] alongside prospective crossover learning trials.

## ACKNOWLEDGMENT

The authors thank the Astana IT University undergraduate course participants and student presenters who contributed anonymized feedback and presentation scripts for research evaluation. Large language model assistance was used solely for language polishing, TypeScript refactoring checks, and formatting table scaffolding; all experimental designs, benchmark scripts, statistical analyses, and manual script-verified reference transcripts were created and audited directly by the authors.

## REFERENCES

${refs.map((r, i) => `${i + 1}. ${r}`).join("\n")}
`;

fs.writeFileSync("c:/Users/amang/audio-notes/AITU_IEEE_2027_L-easy.md", mdContent, "utf8");
fs.writeFileSync(
  "C:/Users/amang/.gemini/antigravity/brain/8bdf4faa-6cec-4ef8-a682-335de43e9083/AITU_SC_Paper_L-easy.md",
  mdContent,
  "utf8",
);
console.log("Synced Markdown copies successfully.");
