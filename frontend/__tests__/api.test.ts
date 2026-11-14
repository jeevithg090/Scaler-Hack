import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChatMessage, startAnalysis } from "@/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue({ ok: true, ...response });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("startAnalysis", () => {
  it("posts form data with the pasted text", async () => {
    const fetchMock = mockFetch({ json: async () => ({ analysis_id: "abc" }) });
    await expect(startAnalysis(undefined, "contract text")).resolves.toEqual({
      analysis_id: "abc",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/analyze");
    expect((init.body as FormData).get("text")).toBe("contract text");
    expect((init.body as FormData).get("file")).toBeNull();
  });

  it("surfaces the backend error detail", async () => {
    mockFetch({ ok: false, json: async () => ({ detail: "Document too short" }) });
    await expect(startAnalysis(undefined, "x")).rejects.toThrow("Document too short");
  });
});

describe("sendChatMessage", () => {
  it("returns the reply text", async () => {
    const fetchMock = mockFetch({ json: async () => ({ reply: "hello" }) });
    await expect(sendChatMessage("id1", "hi")).resolves.toBe("hello");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/analyze/id1/chat");
  });

  it("falls back to a generic error", async () => {
    mockFetch({ ok: false, json: async () => ({}) });
    await expect(sendChatMessage("id1", "hi")).rejects.toThrow("Chat failed");
  });
});
