export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = (reader.result as string) || "";
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

export function hasJsonContent(val: unknown): boolean {
  if (!val) return false;
  if (typeof val === "string") {
    const t = val.trim();
    return t.length > 2 && t !== "{}" && t !== "null";
  }
  if (typeof val === "object") {
    return Object.keys(val as Record<string, unknown>).length > 0;
  }
  return false;
}

export function parseVocabulary(terms?: string[]) {
  if (!terms || terms.length === 0) {
    return {
      termsList: ["Главная идея"],
      definitions: { "Главная идея": "Ключевые понятия и термины появятся здесь после ИИ-анализа лекции." },
    };
  }
  const termsList: string[] = [];
  const definitions: Record<string, string> = {};
  for (const item of terms) {
    const colonIdx = item.indexOf(":");
    if (colonIdx > 0) {
      const name = item.slice(0, colonIdx).trim();
      const def = item.slice(colonIdx + 1).trim();
      termsList.push(name);
      definitions[name] = def;
    } else {
      termsList.push(item);
      definitions[item] = item;
    }
  }
  return { termsList, definitions };
}
