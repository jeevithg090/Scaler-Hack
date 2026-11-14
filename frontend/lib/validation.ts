/** Client-side input checks that mirror the backend limits, so users get instant feedback. */

export const MIN_TEXT_CHARS = 50;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

export function validateFile(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "That file type isn't supported. Upload a PDF, DOCX or TXT file.";
  }
  if (file.size === 0) return "That file is empty. Choose a different file.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${formatBytes(file.size)}. The limit is 10 MB.`;
  }
  return null;
}

export function validateText(text: string): string | null {
  const length = text.trim().length;
  if (length === 0) return "Paste the contract text to analyze.";
  if (length < MIN_TEXT_CHARS) {
    const missing = MIN_TEXT_CHARS - length;
    return `Add ${missing} more character${missing === 1 ? "" : "s"}. We need at least ${MIN_TEXT_CHARS} to find clauses.`;
  }
  return null;
}

export function validateUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter the address of a public page, such as a terms of service.";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "That doesn't look like a web address. It should start with https://";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http:// and https:// addresses are supported.";
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
