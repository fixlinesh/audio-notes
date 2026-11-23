import type { SummaryData } from "../summarize";

export type ExportLecture = {
  title?: string;
  subject?: string;
  professor?: string;
  date?: string;
  sourceLanguage?: string;
  outputLanguage?: string;
  transcript?: string;
  summary?: SummaryData | null;
};

function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadHtml2Pdf(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).html2pdf) return Promise.resolve((window as any).html2pdf);

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="html2pdf"]');
    if (existing) {
      setTimeout(() => resolve((window as any).html2pdf || null), 400);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve((window as any).html2pdf || null);
    script.onerror = () => {
      console.warn("Could not load html2pdf from CDN, will use fallback");
      resolve(null);
    };
    document.head.appendChild(script);
    setTimeout(() => resolve((window as any).html2pdf || null), 3500);
  });
}

function buildMultiPagePdfBlob(pages: { bytes: Uint8Array; width: number; height: number }[]): Blob {
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];

  offsets.push(out.length);
  out += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

  const pageCount = pages.length;
  const pageObjNums: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageObjNums.push(3 + i * 3);
  }

  offsets.push(out.length);
  out += `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageCount} >>\nendobj\n`;

  const parts: (string | Uint8Array)[] = [out];
  let currentOffset = out.length;

  for (let i = 0; i < pageCount; i++) {
    const pageNum = 3 + i * 3;
    const imgNum = pageNum + 1;
    const contentNum = pageNum + 2;
    const p = pages[i];

    // Page object
    offsets.push(currentOffset);
    const pageStr = `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i + 1} ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`;
    parts.push(pageStr);
    currentOffset += new TextEncoder().encode(pageStr).length;

    // Image object (embedded JPEG)
    offsets.push(currentOffset);
    const imgHeader = `${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`;
    const imgFooter = "\nendstream\nendobj\n";
    parts.push(imgHeader);
    parts.push(p.bytes);
    parts.push(imgFooter);
    currentOffset +=
      new TextEncoder().encode(imgHeader).length +
      p.bytes.length +
      new TextEncoder().encode(imgFooter).length;

    // Content object
    offsets.push(currentOffset);
    const streamContent = `q\n595.28 0 0 841.89 0 0 cm\n/Im${i + 1} Do\nQ\n`;
    const contentStr = `${contentNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`;
    parts.push(contentStr);
    currentOffset += new TextEncoder().encode(contentStr).length;
  }

  // Cross-reference table
  const xrefOffset = currentOffset;
  let xrefStr = `xref\n0 ${1 + offsets.length}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xrefStr += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${1 + offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(xrefStr);

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function generateLecturePrintHtml(options: {
  lecture: ExportLecture;
  summary?: SummaryData | null;
  language: "Kazakh" | "Russian" | "English";
  isNotes?: boolean;
}): string {
  const { lecture, language, isNotes } = options;
  const summary = options.summary || lecture.summary || null;

  const allLabels = {
    Kazakh: {
      brand: "Audio Notes · Академиялық конспект пен дәріс материалдары",
      subject: "Пән",
      professor: "Оқытушы",
      date: "Күні",
      language: "Тіл",
      summarySection: "Дәрістің мазмұны мен түсіндірмесі",
      simplifiedSection: "Қарапайым тілмен (ELI5)",
      keyPointsSection: "Негізгі тезистер мен қорытындылар",
      termsSection: "Академиялық терминдер мен анықтамалар",
      exampleSection: "Практикалық мысал",
      transcriptSection: "Лекцияның толық стенограммасы",
      footer: "Audio Notes платформасында студенттерге арналып жасалған · AITU Smart Learning",
      printBtn: "🖨️ Басып шығару / PDF сақтау",
      downloadBtn: "💾 Файлды сақтау",
      closeBtn: "✕ Жабу",
      bannerHint: "PDF ретінде сақтау үшін ашылған терезеде «Басып шығару» түймесін басып, принтер орнына «PDF ретінде сақтау» таңдаңыз.",
    },
    Russian: {
      brand: "Audio Notes · Академический конспект и материалы лекции",
      subject: "Предмет",
      professor: "Преподаватель",
      date: "Дата",
      language: "Язык",
      summarySection: "Академический конспект и разбор тем",
      simplifiedSection: "Простыми словами (Суть темы)",
      keyPointsSection: "Ключевые тезисы и выводы",
      termsSection: "Основные термины и определения",
      exampleSection: "Практический пример",
      transcriptSection: "Полная стенограмма лекции",
      footer: "Создано в системе Audio Notes · Умный помощник для студентов · AITU Smart Learning",
      printBtn: "🖨️ Печать / Сохранить в PDF",
      downloadBtn: "💾 Сохранить файл",
      closeBtn: "✕ Закрыть",
      bannerHint: "Чтобы сохранить файл в формате PDF, нажмите кнопку «Печать» и в списке принтеров выберите «Сохранить как PDF».",
    },
    English: {
      brand: "Audio Notes · Academic Lecture Summary & Study Notes",
      subject: "Subject",
      professor: "Professor",
      date: "Date",
      language: "Language",
      summarySection: "Academic Summary & Explanation",
      simplifiedSection: "In Simple Terms (Key Concept)",
      keyPointsSection: "Key Takeaways & Points",
      termsSection: "Core Academic Terminology",
      exampleSection: "Practical Example",
      transcriptSection: "Full Lecture Transcript",
      footer: "Generated by Audio Notes · Smart Assistant for University Students · AITU Smart Learning",
      printBtn: "🖨️ Print / Save as PDF",
      downloadBtn: "💾 Save File",
      closeBtn: "✕ Close",
      bannerHint: "To save as a PDF document, click Print and select 'Save as PDF' as the destination printer.",
    },
  };
  const labels = allLabels[language] || allLabels.English;

  const title = lecture.title || (language === "Kazakh" ? "Дәріс конспектісі" : language === "Russian" ? "Конспект лекции" : "Lecture Notes");
  const topicTitle = summary?.topicTitle || title;
  const subject = lecture.subject || (language === "Kazakh" ? "Жалпы курс" : language === "Russian" ? "Учебный курс" : "General Course");
  const professor = lecture.professor || "";
  const dateStr = lecture.date || new Date().toLocaleDateString(language === "English" ? "en-US" : "ru-RU");

  const keyPoints = summary?.keyPoints || [];
  const terms = summary?.terms || [];
  const explanation = summary?.explanation || "";
  const simplified = summary?.simplified || "";
  const example = summary?.example || "";
  const transcript = lecture.transcript || "";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; line-height: 1.6; font-size: 13px; background: #ffffff; padding: 24px;">
      <header style="border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb; margin-bottom: 4px;">
          ⚡ ${labels.brand}
        </div>
        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 10px; line-height: 1.25;">
          ${escapeHtml(topicTitle || title)}
        </h1>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; padding: 3px 9px; font-size: 11.5px; font-weight: 600;">
            ${escapeHtml(subject)}
          </span>
          ${professor ? `<span style="display: inline-block; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; border-radius: 6px; padding: 3px 9px; font-size: 11.5px; font-weight: 600;">${labels.professor}: ${escapeHtml(professor)}</span>` : ""}
          <span style="display: inline-block; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; border-radius: 6px; padding: 3px 9px; font-size: 11.5px; font-weight: 600;">
            ${labels.date}: ${escapeHtml(dateStr)}
          </span>
          <span style="display: inline-block; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; border-radius: 6px; padding: 3px 9px; font-size: 11.5px; font-weight: 600;">
            ${labels.language}: ${escapeHtml(language)}
          </span>
        </div>
      </header>

      ${explanation ? `
      <section style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
        <h2 style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
          📖 ${labels.summarySection}
        </h2>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
          <p style="font-size: 13px; color: #1e293b; line-height: 1.65; margin: 0;">${escapeHtml(explanation)}</p>
        </div>
      </section>
      ` : ""}

      ${simplified ? `
      <section style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
        <h2 style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
          💡 ${labels.simplifiedSection}
        </h2>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; color: #14532d;">
          <p style="font-size: 13px; line-height: 1.6; margin: 0;">${escapeHtml(simplified)}</p>
        </div>
      </section>
      ` : ""}

      ${keyPoints.length > 0 ? `
      <section style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
        <h2 style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
          🎯 ${labels.keyPointsSection}
        </h2>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
            ${keyPoints.map((kp) => `<li style="position: relative; padding-left: 22px; font-size: 13px; color: #1e293b; line-height: 1.55;"><span style="position: absolute; left: 0; top: 0; font-weight: 800; color: #2563eb;">✓</span>${escapeHtml(kp)}</li>`).join("")}
          </ul>
        </div>
      </section>
      ` : ""}

      ${terms.length > 0 ? `
      <section style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
        <h2 style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
          📚 ${labels.termsSection}
        </h2>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          ${terms.map((t) => {
            let termName = t;
            let termDef = "";
            const sep = t.indexOf(":");
            const sepDash = t.indexOf("—");
            if (sep > -1) {
              termName = t.slice(0, sep).trim();
              termDef = t.slice(sep + 1).trim();
            } else if (sepDash > -1) {
              termName = t.slice(0, sepDash).trim();
              termDef = t.slice(sepDash + 1).trim();
            }
            return `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 3px solid #2563eb; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 12.5px; font-weight: 700; color: #1d4ed8; margin-bottom: 3px;">${escapeHtml(termName)}</div>
              ${termDef ? `<div style="font-size: 12px; color: #475569; line-height: 1.45;">${escapeHtml(termDef)}</div>` : ""}
            </div>
            `;
          }).join("")}
        </div>
      </section>
      ` : ""}

      ${example ? `
      <section style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
        <h2 style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
          🧪 ${labels.exampleSection}
        </h2>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; color: #1e3a8a; font-size: 13px; line-height: 1.6;">
          <p style="margin: 0;">${escapeHtml(example)}</p>
        </div>
      </section>
      ` : ""}

      ${isNotes && transcript ? `
      <section style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
        <h2 style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
          📝 ${labels.transcriptSection}
        </h2>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 12.5px; line-height: 1.7; color: #334155; white-space: pre-wrap;">
          ${escapeHtml(transcript)}
        </div>
      </section>
      ` : ""}

      <footer style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
        <div>${labels.footer}</div>
        <div>${new Date().toLocaleDateString()}</div>
      </footer>
    </div>
  `;
}

export async function exportLecturePdf({
  lecture,
  summary,
  language,
  isNotes = false,
  onStatus,
  setBusy,
}: {
  lecture: ExportLecture;
  summary?: SummaryData | null;
  language: "Kazakh" | "Russian" | "English";
  isNotes?: boolean;
  onStatus?: (msg: string) => void;
  setBusy?: (busy: boolean) => void;
}) {
  setBusy?.(true);

  const setStatus = (ru: string, kz: string, en: string) => {
    const text = language === "Kazakh" ? kz : language === "English" ? en : ru;
    onStatus?.(text);
  };

  setStatus("Генерация PDF документа…", "PDF құжаты жасалуда…", "Generating PDF file…");

  const effectiveSummary = summary || lecture.summary || null;
  const innerHtml = generateLecturePrintHtml({
    lecture,
    summary: effectiveSummary,
    language,
    isNotes,
  });

  const cleanTitle = (lecture.title || (isNotes ? "Lecture_Notes" : "Lecture_Summary"))
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim()
    .slice(0, 60);

  const fileName = `${cleanTitle || "Lecture"}_${isNotes ? "Notes" : "Summary"}.pdf`;

  // 1. Primary: High-fidelity html2pdf conversion
  try {
    const html2pdf = await loadHtml2Pdf();
    if (html2pdf) {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "794px"; // A4 width at 96 DPI
      container.style.background = "#ffffff";
      container.style.color = "#0f172a";
      container.innerHTML = innerHtml;
      document.body.appendChild(container);

      const opt = {
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy", "avoid-all"] },
      };

      await html2pdf().set(opt).from(container).save();
      document.body.removeChild(container);

      setStatus(
        `PDF файл скачан: ${fileName}`,
        `PDF файлы жүктелді: ${fileName}`,
        `PDF downloaded: ${fileName}`
      );
      setBusy?.(false);
      return;
    }
  } catch (err) {
    console.warn("html2pdf conversion failed, falling back to canvas PDF compiler:", err);
  }

  // 2. Standalone fallback: Pure client-side Canvas-to-PDF compiler (100% offline, generates valid .pdf binary)
  try {
    const canvas = document.createElement("canvas");
    const width = 1200;
    const padding = 50;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const title = lecture.title || "Lecture Summary";
      const subject = lecture.subject || "Course";
      const explanation = effectiveSummary?.explanation || "";
      const simplified = effectiveSummary?.simplified || "";
      const keyPoints = effectiveSummary?.keyPoints || [];
      const terms = effectiveSummary?.terms || [];

      // Estimated total height
      let totalHeight = 350;
      totalHeight += Math.ceil(explanation.length / 70) * 28 + 80;
      if (simplified) totalHeight += Math.ceil(simplified.length / 70) * 28 + 80;
      if (keyPoints.length) totalHeight += keyPoints.length * 36 + 60;
      if (terms.length) totalHeight += terms.length * 40 + 60;
      if (isNotes && lecture.transcript) totalHeight += Math.ceil(lecture.transcript.length / 75) * 26 + 100;

      canvas.width = width;
      canvas.height = Math.max(1697, totalHeight);

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header branding
      ctx.fillStyle = "#2563eb";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("⚡ AUDIO NOTES · ACADEMIC SUMMARY", padding, 60);

      // Title
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(title.slice(0, 50), padding, 105);

      // Metadata
      ctx.fillStyle = "#475569";
      ctx.font = "16px sans-serif";
      ctx.fillText(`${subject} · ${lecture.date || new Date().toLocaleDateString()} · ${language}`, padding, 135);

      // Divider
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(padding, 155);
      ctx.lineTo(width - padding, 155);
      ctx.stroke();

      let currentY = 195;

      const drawWrapText = (text: string, x: number, startY: number, maxW: number, lineH: number, color = "#1e293b", font = "18px sans-serif") => {
        ctx.fillStyle = color;
        ctx.font = font;
        const words = text.split(" ");
        let line = "";
        let y = startY;
        for (const w of words) {
          const testLine = line ? `${line} ${w}` : w;
          if (ctx.measureText(testLine).width > maxW) {
            ctx.fillText(line, x, y);
            line = w;
            y += lineH;
          } else {
            line = testLine;
          }
        }
        if (line) {
          ctx.fillText(line, x, y);
          y += lineH;
        }
        return y;
      };

      if (explanation) {
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("📖 Академический конспект (Summary)", padding, currentY);
        currentY += 30;
        currentY = drawWrapText(explanation, padding + 10, currentY, width - padding * 2 - 20, 28);
        currentY += 25;
      }

      if (simplified) {
        ctx.fillStyle = "#166534";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("💡 Простыми словами (ELI5)", padding, currentY);
        currentY += 30;
        currentY = drawWrapText(simplified, padding + 10, currentY, width - padding * 2 - 20, 28, "#14532d");
        currentY += 25;
      }

      if (keyPoints.length) {
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("🎯 Ключевые тезисы", padding, currentY);
        currentY += 30;
        for (const kp of keyPoints) {
          ctx.fillStyle = "#2563eb";
          ctx.font = "bold 18px sans-serif";
          ctx.fillText("✓", padding + 10, currentY);
          currentY = drawWrapText(kp, padding + 35, currentY, width - padding * 2 - 50, 26);
          currentY += 6;
        }
        currentY += 20;
      }

      if (terms.length) {
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("📚 Термины и понятия", padding, currentY);
        currentY += 30;
        for (const term of terms) {
          currentY = drawWrapText(`• ${term}`, padding + 10, currentY, width - padding * 2 - 20, 26, "#1d4ed8");
          currentY += 4;
        }
        currentY += 20;
      }

      if (isNotes && lecture.transcript) {
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("📝 Стенограмма лекции", padding, currentY);
        currentY += 30;
        currentY = drawWrapText(lecture.transcript, padding + 10, currentY, width - padding * 2 - 20, 24, "#475569", "16px sans-serif");
      }

      // Slice into standard A4 pages
      const pageHeight = Math.round(width * 1.414);
      const numPages = Math.max(1, Math.ceil(canvas.height / pageHeight));
      const pdfPages: { bytes: Uint8Array; width: number; height: number }[] = [];

      for (let p = 0; p < numPages; p++) {
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = width;
        pageCanvas.height = pageHeight;
        const pctx = pageCanvas.getContext("2d");
        if (pctx) {
          pctx.fillStyle = "#ffffff";
          pctx.fillRect(0, 0, width, pageHeight);
          pctx.drawImage(canvas, 0, p * pageHeight, width, pageHeight, 0, 0, width, pageHeight);

          // Footer on page
          pctx.fillStyle = "#94a3b8";
          pctx.font = "14px sans-serif";
          pctx.fillText(`Audio Notes · Страница ${p + 1} из ${numPages}`, padding, pageHeight - 30);

          const dataUrl = pageCanvas.toDataURL("image/jpeg", 0.92);
          const binStr = atob(dataUrl.split(",")[1]);
          const bytes = new Uint8Array(binStr.length);
          for (let b = 0; b < binStr.length; b++) bytes[b] = binStr.charCodeAt(b);
          pdfPages.push({ bytes, width, height: pageHeight });
        }
      }

      if (pdfPages.length > 0) {
        const pdfBlob = buildMultiPagePdfBlob(pdfPages);
        triggerDownload(pdfBlob, fileName);
        setStatus(
          `Файл PDF успешно сохранён: ${fileName}`,
          `PDF файлы сәтті жүктелді: ${fileName}`,
          `PDF file saved: ${fileName}`
        );
        setBusy?.(false);
        return;
      }
    }
  } catch (canvasErr) {
    console.warn("Canvas-to-PDF generation error:", canvasErr);
  }

  // 3. Fallback: Open print dialog
  try {
    const printWin = window.open("", "_blank");
    if (printWin && !printWin.closed) {
      printWin.document.open();
      printWin.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(fileName)}</title><style>@page { size: A4; margin: 15mm; } body { font-family: sans-serif; }</style></head><body>${innerHtml}</body></html>`);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        try {
          printWin.print();
        } catch {}
      }, 300);
      setStatus(
        "Открыто окно печати. Выберите «Сохранить как PDF».",
        "Басып шығару терезесі ашылды. «PDF ретінде сақтау» таңдаңыз.",
        "Print dialog opened. Select 'Save as PDF'."
      );
    }
  } catch (printErr) {
    console.warn("Print window failed:", printErr);
  }

  setTimeout(() => {
    setBusy?.(false);
  }, 1000);
}
