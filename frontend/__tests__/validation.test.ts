import { describe, expect, it } from "vitest";
import { formatBytes, validateFile, validateText, validateUrl } from "@/lib/validation";

describe("validateFile", () => {
  it("accepts supported extensions regardless of case", () => {
    expect(validateFile({ name: "Offer.PDF", size: 1000 })).toBeNull();
    expect(validateFile({ name: "nda.docx", size: 1000 })).toBeNull();
    expect(validateFile({ name: "tos.txt", size: 1000 })).toBeNull();
  });
  it("rejects unsupported types, empty and oversized files", () => {
    expect(validateFile({ name: "photo.png", size: 10 })).toMatch(/isn't supported/);
    expect(validateFile({ name: "a.pdf", size: 0 })).toMatch(/empty/);
    expect(validateFile({ name: "a.pdf", size: 11 * 1024 * 1024 })).toMatch(/limit is 10 MB/);
  });
});

describe("validateText", () => {
  it("requires at least 50 non-whitespace-padded characters", () => {
    expect(validateText("   ")).toMatch(/Paste/);
    expect(validateText("x".repeat(49))).toMatch(/Add 1 more character\./);
    expect(validateText("x".repeat(40))).toMatch(/Add 10 more characters/);
    expect(validateText("x".repeat(50))).toBeNull();
  });
});

describe("validateUrl", () => {
  it("accepts http and https URLs", () => {
    expect(validateUrl("https://example.com/terms")).toBeNull();
    expect(validateUrl("  http://example.com ")).toBeNull();
  });
  it("explains what is wrong", () => {
    expect(validateUrl("")).toMatch(/Enter the address/);
    expect(validateUrl("example.com")).toMatch(/doesn't look like/);
    expect(validateUrl("ftp://example.com")).toMatch(/Only http/);
  });
});

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
