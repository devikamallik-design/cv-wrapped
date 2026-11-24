import type { ParsedCv } from "./types";

export const MAX_BYTES = 5 * 1024 * 1024;
const MIN_CHARS = 300;

export class ParseError extends Error {
  constructor(
    public code: "TOO_BIG" | "UNSUPPORTED" | "NO_TEXT",
    message: string,
  ) {
    super(message);
  }
}

function kindOf(name: string, type: string): "pdf" | "docx" | "txt" | null {
  const n = name.toLowerCase();
  if (type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx") || type.includes("officedocument.wordprocessingml")) return "docx";
  if (type.startsWith("text/") || n.endsWith(".txt") || n.endsWith(".md")) return "txt";
  return null;
}

/** Reads the uploaded file fresh every time. Nothing is cached or written to disk. */
export async function parseCv(file: File): Promise<ParsedCv> {
  if (file.size > MAX_BYTES) throw new ParseError("TOO_BIG", "That file is over 5 MB. Export a smaller PDF and try again.");
  const kind = kindOf(file.name, file.type);
  if (!kind) throw new ParseError("UNSUPPORTED", "Upload a PDF, Word (.docx) or text file.");

  const buf = new Uint8Array(await file.arrayBuffer());
  let text = "";
  let pages = 1;

  if (kind === "pdf") {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const out = await extractText(pdf, { mergePages: false });
    pages = out.totalPages;
    text = (out.text as string[]).join("\n\n");
  } else if (kind === "docx") {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    text = out.value;
    pages = Math.max(1, Math.round(text.length / 3500));
  } else {
    text = new TextDecoder("utf-8").decode(buf);
  }

  text = text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (text.replace(/\s/g, "").length < MIN_CHARS) {
    throw new ParseError(
      "NO_TEXT",
      kind === "pdf"
        ? "We couldn't find any text in this PDF. It might be a scan or an image. Export it from Word, Google Docs or Figma as a text PDF and try again."
        : "This file is almost empty. Upload your full CV.",
    );
  }
  return { fileName: file.name, pages, text };
}
