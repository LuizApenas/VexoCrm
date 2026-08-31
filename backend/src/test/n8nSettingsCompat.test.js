import { describe, expect, it } from "vitest";
import { buildN8nSettingsPayload, maskN8nSettings } from "../services/n8nSettings.js";

describe("n8nSettings payload structure and data types", () => {
  it("buildN8nSettingsPayload generates correct JSONB and field types for all columns", () => {
    const input = {
      chatbotEnabled: true,
      chatbotModel: "generico",
      chatbotLlmModel: "openai/gpt-oss-120b",
      sendWindowStart: "08:00",
      sendWindowEnd: "20:00",
      sendWindowDays: ["mon", "tue", "wed", "thu", "fri"],
      sendWindowTimezone: "America/Sao_Paulo",
      sendWindowEnabled: true,
      agentRepliesOutsideWindow: true,
    };

    const payload = buildN8nSettingsPayload(input, { uid: "test", email: "test@vexo.com" }, null);

    expect(payload.chatbot_enabled).toBe(true);
    expect(payload.chatbot_model).toBe("generico");
    expect(payload.chatbot_llm_model).toBe("openai/gpt-oss-120b");
    expect(payload.send_window_start).toBe("08:00");
    expect(payload.send_window_end).toBe("20:00");
    expect(payload.send_window_days).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(payload.send_window_timezone).toBe("America/Sao_Paulo");
    expect(payload.send_window_enabled).toBe(true);
    expect(payload.agent_replies_outside_window).toBe(true);
  });
});
