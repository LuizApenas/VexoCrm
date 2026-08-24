// O contrato de saida vale no CAMINHO QUE RODA, nao só numa composicao de teste.
//
// jsonContractResilience.test.js monta o system prompt a mao
// (`${stripLegacyJsonSection(x)}\n${buildJsonInstruction()}`) e verifica o
// resultado. Isso prova que as pecas funcionam, nao que runChatbotAI as usa —
// e este repositorio ja teve tres casos de "funcao certa, teste verde, roda
// outra coisa". Aqui a LLM e mockada e a assercao e sobre o que runChatbotAI
// REALMENTE mandou para o modelo.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runChatbotAI, parseAIResponse } from "../chatbot-ai-engine.js";

// A LLM e mockada no FETCH, nao no modulo: runChatbotAI chama
// callLlmChatCompletion por referencia local, entao espionar o export nao
// intercepta nada — o teste passaria sem exercitar o codigo que roda.
// Mockando o fetch, a cadeia real (contrato, retry, parse) e percorrida.
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "chave-de-teste";

// Prompt novo do tenant Sonhare: comportamento e tom, zero JSON.
const PROMPT_SONHARE_SEM_JSON = `Você é a Lara, assistente virtual da Sonhare Viagens.
Atenda no WhatsApp de forma calorosa e acolhedora.
Nunca faça mais de uma pergunta por mensagem.`;

// Prompt legado: traz o schema escrito a mao no fim.
const PROMPT_LEGADO_COM_JSON = `Você é o consultor comercial da Geração Digital.
Qualifique leads de marketing digital.

═══════════════════════════════════════════════
FORMATO DE RESPOSTA (JSON obrigatório):
{
  "mensagem": "texto para o lead",
  "status_conversa": "aguardando_usuario",
  "dados": {},
  "classificacao": "QUENTE",
  "finalizado": false
}`;

const RESPOSTA_VALIDA = JSON.stringify({
  mensagem: "Oi! Para onde você quer viajar?",
  status_conversa: "aguardando_usuario",
  dados: { destino: "Maceió" },
  classificacao: "QUENTE",
  finalizado: false,
  spin_fase: "situacao",
});

let chamadas = [];
let fetchSpy;
let proximaResposta = null;

function systemPromptEnviado() {
  return chamadas.at(-1)?.messages?.find((m) => m.role === "system")?.content ?? "";
}

function respostaGroq(conteudo) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: conteudo } }] }),
    text: async () => conteudo,
  };
}

beforeEach(() => {
  chamadas = [];
  proximaResposta = null;
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    chamadas.push(JSON.parse(init.body));
    const conteudo = proximaResposta ?? RESPOSTA_VALIDA;
    proximaResposta = null;
    return respostaGroq(conteudo);
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe("prompt SEM secao de JSON — o caso que quebrou o agente do Sonhare", () => {
  it("runChatbotAI anexa o contrato ao prompt que vai para o modelo", async () => {
    await runChatbotAI({
      systemPrompt: PROMPT_SONHARE_SEM_JSON,
      history: [],
      newMessages: ["oi"],
      existingData: {},
    });

    const enviado = systemPromptEnviado();
    // O comportamento escrito pelo dono continua inteiro...
    expect(enviado).toContain("Você é a Lara, assistente virtual da Sonhare Viagens.");
    expect(enviado).toContain("Nunca faça mais de uma pergunta por mensagem.");
    // ...e o formato foi acrescentado pelo CODIGO, depois dele.
    expect(enviado).toContain("FORMATO DE RESPOSTA OBRIGATÓRIO");
    for (const chave of ['"mensagem"', '"status_conversa"', '"dados"', '"classificacao"', '"finalizado"', '"spin_fase"']) {
      expect(enviado, `contrato sem a chave ${chave}`).toContain(chave);
    }
    // O contrato entra DEPOIS do texto do usuario.
    expect(enviado.indexOf("FORMATO DE RESPOSTA OBRIGATÓRIO")).toBeGreaterThan(
      enviado.indexOf("Você é a Lara")
    );
  });

  it("o agente responde normalmente, sem json_validate_failed", async () => {
    const r = await runChatbotAI({
      systemPrompt: PROMPT_SONHARE_SEM_JSON,
      history: [],
      newMessages: ["oi"],
      existingData: {},
    });

    expect(r.mensagem).toBe("Oi! Para onde você quer viajar?");
    expect(r.classificacao).toBe("QUENTE");
    expect(r.dados).toEqual({ destino: "Maceió" });
    expect(r.contratoQuebrado).toBeUndefined();
  });
});

describe("prompt COM secao de JSON — comportamento identico ao de hoje", () => {
  it("o comportamento escrito pelo dono e preservado por inteiro", async () => {
    await runChatbotAI({
      systemPrompt: PROMPT_LEGADO_COM_JSON,
      history: [],
      newMessages: ["oi"],
      existingData: {},
    });

    const enviado = systemPromptEnviado();
    expect(enviado).toContain("Você é o consultor comercial da Geração Digital.");
    expect(enviado).toContain("Qualifique leads de marketing digital.");
  });

  it("a instrucao de formato aparece UMA vez, nao duas", async () => {
    await runChatbotAI({
      systemPrompt: PROMPT_LEGADO_COM_JSON,
      history: [],
      newMessages: ["oi"],
      existingData: {},
    });

    const enviado = systemPromptEnviado();
    expect((enviado.match(/FORMATO DE RESPOSTA/g) || []).length).toBe(1);
    // O schema legado saiu: este texto so existia no bloco escrito a mao.
    expect(enviado).not.toContain("texto para o lead");
    expect(enviado).not.toContain("FORMATO DE RESPOSTA (JSON obrigatório)");
  });

  it("as duas familias de prompt terminam com O MESMO contrato", async () => {
    await runChatbotAI({ systemPrompt: PROMPT_SONHARE_SEM_JSON, history: [], newMessages: ["oi"], existingData: {} });
    const semJson = systemPromptEnviado();
    await runChatbotAI({ systemPrompt: PROMPT_LEGADO_COM_JSON, history: [], newMessages: ["oi"], existingData: {} });
    const comJson = systemPromptEnviado();

    const contrato = (texto) => texto.slice(texto.indexOf("FORMATO DE RESPOSTA"));
    expect(contrato(semJson)).toBe(contrato(comJson));
  });

  it("texto que so MENCIONA formato de resposta, sem schema, nao e cortado", async () => {
    const prompt = `Você é a Lara.

FORMATO DE RESPOSTA: seja breve e cordial.
Sempre encerre perguntando se pode ajudar em algo mais.`;

    await runChatbotAI({ systemPrompt: prompt, history: [], newMessages: ["oi"], existingData: {} });

    const enviado = systemPromptEnviado();
    // Sem a guarda de "parece schema", tudo depois da mencao sumiria.
    expect(enviado).toContain("Sempre encerre perguntando se pode ajudar em algo mais.");
  });
});

describe("modelo devolve JSON invalido mesmo assim", () => {
  it("nao derruba: aproveita o texto do modelo e MARCA o contrato como quebrado", async () => {
    proximaResposta = "Claro! Posso te ajudar com pacotes para o Nordeste.";

    const r = await runChatbotAI({
      systemPrompt: PROMPT_SONHARE_SEM_JSON,
      history: [],
      newMessages: ["oi"],
      existingData: {},
    });

    expect(r.mensagem).toBe("Claro! Posso te ajudar com pacotes para o Nordeste.");
    expect(r.contratoQuebrado).toBe(true);
  });

  it("NAO inventa classificacao — este e o defeito do || \"QUENTE\"", () => {
    const r = parseAIResponse("resposta em prosa, sem JSON nenhum");
    expect(r.classificacao).toBe(null);
    expect(r.dados).toEqual({});
    expect(r.spin_fase).toBe(null);
  });

  it("loga a resposta CRUA do modelo, nao um 500 mudo", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    parseAIResponse("prosa que nao e json");
    const linha = warn.mock.calls.find((c) => String(c[0]).includes("CONTRATO QUEBRADO"));
    expect(linha, "faltou log de contrato quebrado").toBeTruthy();
    expect(linha[1].rawCompleta).toContain("prosa que nao e json");
    warn.mockRestore();
  });
});
