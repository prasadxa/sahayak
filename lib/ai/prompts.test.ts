import { describe, expect, it } from "vitest";
import { kioskPrompt, systemPrompt } from "./prompts";

describe("systemPrompt", () => {
  it("names the language and its native script", () => {
    const p = systemPrompt({
      selectedChatModel: "chat-model-small",
      language: "hi",
    });
    expect(p).toContain("Always reply in Hindi (हिन्दी)");
    expect(p).toMatch(/native script/i);
  });

  it("has no language line for English", () => {
    const p = systemPrompt({
      selectedChatModel: "chat-model-small",
      language: "en",
    });
    expect(p).not.toContain("Always reply in");
  });

  it("drops the Python/code-block guidance", () => {
    const p = systemPrompt({
      selectedChatModel: "chat-model-small",
      language: "en",
    });
    expect(p).not.toMatch(/python|pyodide|spreadsheet/i);
  });

  it("tells both models to use the PMFBY calculator", () => {
    for (const model of ["chat-model-small", "chat-model-reasoning"]) {
      expect(systemPrompt({ selectedChatModel: model })).toContain(
        "calculatePmfbyPremium"
      );
    }
  });

  it("appends the kiosk prompt only for the kiosk role", () => {
    const kiosk = systemPrompt({
      selectedChatModel: "chat-model-small",
      role: "kiosk",
    });
    const member = systemPrompt({
      selectedChatModel: "chat-model-small",
      role: "member",
    });
    expect(kiosk).toContain(kioskPrompt);
    expect(member).not.toContain(kioskPrompt);
    expect(kioskPrompt).toMatch(/2.4 short sentences/);
    expect(kioskPrompt).toMatch(/phone number/);
  });
});

describe("kiosk isolation in the system prompt", () => {
  it("never offers personal-memory tools to a kiosk caller", async () => {
    const { systemPrompt } = await import("./prompts");
    const kiosk = systemPrompt({ selectedChatModel: "chat-model-small", language: "hi", role: "kiosk" });
    expect(kiosk).not.toMatch(/addResource|getInformation/);
    const member = systemPrompt({ selectedChatModel: "chat-model-small", language: "hi", role: "member" });
    expect(member).toMatch(/addResource/);
  });
});
