// A resposta de um turno e daquele turno. Nunca a anterior.
//
// Sintoma no simulador do Sonhare: a mesma pergunta tres vezes seguidas,
// palavra por palavra. A suspeita era que o conserto da regressao do "FRIO"
// (commit 2727074) tivesse passado a preservar tambem a MENSAGEM anterior — o
// que seria fallback silencioso criado pelo conserto de um fallback silencioso.
//
// Nao era: so status e lead_source usam valor anterior, e os dois sao estado do
// lead. Estes testes travam essa fronteira, porque a suspeita era razoavel e a
// proxima pessoa vai ter a mesma ideia.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runChatbotAI, appendToHistory, buildHistory } from "../chatbot-ai-engine.js";
import { readFileSync } from "fs";
import { resolve } from "path";

process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "chave-de-teste";

const PROMPT = "Você é a Lara, da Sonhare Viagens.";
const PERGUNTA_ANTERIOR = "Você já tem alguma praia ou região em mente ou prefere que eu sugira?";

let proximaResposta = null;
let fetchSpy;

beforeEach(() => {
  proximaResposta = null;
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: proximaResposta } }] }),
    text: async () => String(proximaResposta),
  }));
});

afterEach(() => fetchSpy.mockRestore());

const historicoComPergunta = [
  { role: "user", content: "oi" },
  { role: "assistant", content: PERGUNTA_ANTERIOR },
];

describe("contrato quebrado no turno", () => {
  it("NAO reenvia a mensagem anterior — usa o texto que o modelo produziu agora", async () => {
    proximaResposta = "Claro, posso sugerir Maceió ou Porto de Galinhas.";

    const r = await runChatbotAI({
      systemPrompt: PROMPT,
      history: historicoComPergunta,
      newMessages: ["sugira"],
      existingData: {},
    });

    expect(r.contratoQuebrado).toBe(true);
    expect(r.mensagem).toBe("Claro, posso sugerir Maceió ou Porto de Galinhas.");
    expect(r.mensagem).not.toBe(PERGUNTA_ANTERIOR);
  });

  it("modelo sem texto nenhum vira FALHA declarada, nao a fala anterior", async () => {
    proximaResposta = JSON.stringify({
      status_conversa: "aguardando_usuario",
      dados: {},
      classificacao: "MORNO",
      finalizado: false,
    });

    const r = await runChatbotAI({
      systemPrompt: PROMPT,
      history: historicoComPergunta,
      newMessages: ["sugira"],
      existingData: {},
    });

    expect(r.mensagemAusente).toBe(true);
    expect(r.mensagem).toBe("");
    expect(r.mensagem).not.toBe(PERGUNTA_ANTERIOR);
  });

  it("mensagem so de espaco tambem e falha, nao mensagem", async () => {
    proximaResposta = JSON.stringify({ mensagem: "   ", status_conversa: "aguardando_usuario" });
    const r = await runChatbotAI({ systemPrompt: PROMPT, history: historicoComPergunta, newMessages: ["x"], existingData: {} });
    expect(r.mensagemAusente).toBe(true);
  });
});

describe("o que PODE ser preservado do turno anterior", () => {
  const fonte = readFileSync(resolve("src/chatbot-ai-engine.js"), "utf8");
  const payloadStartIndex = fonte.indexOf("const payload = {");
  const payload = fonte.slice(payloadStartIndex, fonte.indexOf("let persistErro = null;", payloadStartIndex));

  it("classificacao anterior e preservada — e estado do lead, esta certo", () => {
    expect(payload).toContain("aiResponse.classificacao ?? existing?.status");
  });

  it("a MENSAGEM gravada e sempre a do turno, nunca a anterior", () => {
    expect(payload).toContain("mensagem: aiResponse.mensagem");
    expect(payload).not.toMatch(/mensagem:\s*aiResponse\.mensagem\s*\|\|\s*existing/);
    expect(payload).not.toMatch(/mensagem:.*existing\?\./);
  });

  it("o que o payload preserva TEM que estar no SELECT", () => {
    const inicio = fonte.indexOf('.select("id, dados');
    const select = fonte.slice(inicio, fonte.indexOf(")", inicio));
    for (const coluna of ["status", "lead_source"]) {
      expect(select, `payload preserva existing.${coluna} mas o SELECT nao traz`).toContain(coluna);
    }
  });
});

describe("a memoria da conversa", () => {
  it("appendToHistory acumula os dois lados do turno", () => {
    const h = appendToHistory(historicoComPergunta, "sugira", "Sugiro Maceió.");
    expect(h).toHaveLength(4);
    expect(h.at(-2)).toEqual({ role: "user", content: "sugira" });
    expect(h.at(-1)).toEqual({ role: "assistant", content: "Sugiro Maceió." });
  });

  it("o historico chega ao modelo entre o system e a mensagem nova", async () => {
    proximaResposta = JSON.stringify({ mensagem: "Sugiro Maceió.", status_conversa: "aguardando_usuario" });
    const corpos = [];
    fetchSpy.mockImplementation(async (_u, init) => {
      corpos.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: proximaResposta } }] }), text: async () => "" };
    });

    await runChatbotAI({ systemPrompt: PROMPT, history: historicoComPergunta, newMessages: ["sugira"], existingData: {} });

    const papeis = corpos[0].messages.map((m) => m.role);
    expect(papeis).toEqual(["system", "user", "assistant", "user"]);
    expect(corpos[0].messages[2].content).toBe(PERGUNTA_ANTERIOR);
  });

  it("historico vazio deixa o modelo sem contexto — e a causa da repeticao literal", async () => {
    proximaResposta = JSON.stringify({ mensagem: PERGUNTA_ANTERIOR, status_conversa: "aguardando_usuario" });
    const corpos = [];
    fetchSpy.mockImplementation(async (_u, init) => {
      corpos.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: proximaResposta } }] }), text: async () => "" };
    });

    await runChatbotAI({ systemPrompt: PROMPT, history: buildHistory(null), newMessages: ["sugira"], existingData: {} });
    expect(corpos[0].messages.map((m) => m.role)).toEqual(["system", "user"]);
  });
});

describe("falha de gravacao nao pode ser silenciosa", () => {
  const fonte = readFileSync(resolve("src/chatbot-ai-engine.js"), "utf8");

  it("o resultado do update/insert e conferido", () => {
    expect(fonte).toContain("persistErro = resultado?.error");
    expect(fonte).toContain("FALHA AO GRAVAR O LEAD");
  });

  it("o erro de gravacao viaja para quem chamou", () => {
    expect(fonte).toContain("_persistErro:");
  });

  it("resposta identica a anterior e registrada como sinal de memoria perdida", () => {
    expect(fonte).toContain("RESPOSTA IDENTICA A ANTERIOR");
    expect(fonte).toContain("_repetiuUltimaFala:");
  });

  it("o simulador AVISA o dono em vez de mostrar uma conversa saudavel", () => {
    const rota = readFileSync(resolve("src/domains/chatbot/routes.js"), "utf8");
    expect(rota).toContain("_persistErro");
    expect(rota).toContain("_repetiuUltimaFala");
    expect(rota).toContain("avisos");
  });

  it("mensagem ausente nao e mais reportada como 'prompt nao configurado'", () => {
    const rota = readFileSync(resolve("src/domains/chatbot/routes.js"), "utf8");
    expect(rota).toContain("MODEL_EMPTY_MESSAGE");
  });
});
