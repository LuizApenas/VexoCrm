// A lista de modelos da Groq e configuracao, e 404 nao e 429.
//
// Log de producao, boot cbcd317e6d503485 (24/08/2026):
//   llama-3.3-70b-versatile        404  descontinuado
//   llama-3.1-8b-instant           404  descontinuado
//   gemma2-9b-it                   400
//   deepseek-r1-distill-llama-70b  400
//   qwen-2.5-32b                   400
//   openai/gpt-oss-20b             429  "Limit 8000, Used 6592"
//
// Cinco nomes mortos chumbados no codigo, em nove arquivos, e os dois problemas
// saindo com a MESMA frase no log: "indisponivel ou limite de taxa".

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";
import {
  GROQ_MODEL_LADDER_PADRAO,
  GROQ_MODELOS_MORTOS,
  groqModelLadder,
  defaultGroqModel,
  resolveGroqLadder,
  classifyLlmHttpError,
  parseRateLimit,
  mensagemDeCotaEstourada,
} from "../services/llmModels.js";

const ladderOriginal = process.env.GROQ_MODEL_LADDER;
const campaignOriginal = process.env.GROQ_CAMPAIGN_AI_MODEL;

beforeEach(() => {
  delete process.env.GROQ_MODEL_LADDER;
  delete process.env.GROQ_CAMPAIGN_AI_MODEL;
});
afterEach(() => {
  if (ladderOriginal === undefined) delete process.env.GROQ_MODEL_LADDER;
  else process.env.GROQ_MODEL_LADDER = ladderOriginal;
  if (campaignOriginal === undefined) delete process.env.GROQ_CAMPAIGN_AI_MODEL;
  else process.env.GROQ_CAMPAIGN_AI_MODEL = campaignOriginal;
});

describe("a escada e configuracao, nao constante chumbada", () => {
  it("GROQ_MODEL_LADDER sobrescreve o padrao, sem deploy de codigo", () => {
    process.env.GROQ_MODEL_LADDER = "modelo-novo-a, modelo-novo-b";
    expect(groqModelLadder()).toEqual(["modelo-novo-a", "modelo-novo-b"]);
    expect(defaultGroqModel()).toBe("modelo-novo-a");
  });

  it("sem configuracao, cai no padrao — que sao os modelos reais da conta", () => {
    expect(groqModelLadder()).toEqual(GROQ_MODEL_LADDER_PADRAO);
  });

  it("configuracao vazia ou so virgulas nao zera a escada", () => {
    process.env.GROQ_MODEL_LADDER = "  , ,  ";
    expect(groqModelLadder()).toEqual(GROQ_MODEL_LADDER_PADRAO);
  });
});

describe("os modelos mortos nao voltam", () => {
  it("nenhum modelo descontinuado esta na escada padrao", () => {
    for (const m of GROQ_MODEL_LADDER_PADRAO) {
      expect(GROQ_MODELOS_MORTOS.has(m), `${m} esta morto e ainda na escada`).toBe(false);
    }
  });

  it("modelo morto pedido pelo tenant e DESCARTADO, nao tentado", () => {
    const escada = resolveGroqLadder("llama-3.3-70b-versatile");
    expect(escada).not.toContain("llama-3.3-70b-versatile");
    expect(escada[0]).toBe(GROQ_MODEL_LADDER_PADRAO[0]);
  });

  it("modelo vivo pedido pelo tenant vem primeiro", () => {
    const escada = resolveGroqLadder("qwen/qwen3.6-27b");
    expect(escada[0]).toBe("qwen/qwen3.6-27b");
  });

  it("nao repete modelo quando o pedido ja esta na escada", () => {
    const escada = resolveGroqLadder("openai/gpt-oss-120b");
    expect(escada.filter((m) => m === "openai/gpt-oss-120b")).toHaveLength(1);
  });

  it("a escada nunca sai vazia", () => {
    expect(resolveGroqLadder(null).length).toBeGreaterThan(0);
    expect(resolveGroqLadder("llama-3.1-8b-instant").length).toBeGreaterThan(0);
  });

  it("nenhum arquivo de producao ainda chuma um modelo morto", () => {
    const mortos = [...GROQ_MODELOS_MORTOS];
    const encontrados = [];
    const varrer = (dir) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          if (nome === "test" || nome === "node_modules") continue;
          varrer(caminho);
        } else if (nome.endsWith(".js")) {
          if (caminho.includes("llmModels.js")) continue; // e a lista de mortos
          // Linha a linha, pulando comentario: mencionar o nome ao explicar por
          // que ele saiu e legitimo; usar em string de codigo, nao.
          const linhas = readFileSync(caminho, "utf8").split("\n");
          linhas.forEach((linha, i) => {
            const semEspaco = linha.trim();
            if (semEspaco.startsWith("//") || semEspaco.startsWith("*") || semEspaco.startsWith("/*")) return;
            for (const morto of mortos) {
              if (linha.includes(`"${morto}"`) || linha.includes(`'${morto}'`)) {
                encontrados.push(`${caminho}:${i + 1} -> ${morto}`);
              }
            }
          });
        }
      }
    };
    varrer(resolve("src"));
    expect(encontrados, `modelo descontinuado ainda chumbado:\n${encontrados.join("\n")}`).toEqual([]);
  });
});

describe("404 e 429 sao problemas diferentes", () => {
  it("429 vira COTA_ESTOURADA, com os numeros", () => {
    const corpo = `{"error":{"message":"Rate limit reached for model openai/gpt-oss-20b on tokens per minute (TPM): Limit 8000, Used 6592, Requested 2000. Please try again in 4.29s."}}`;
    const d = classifyLlmHttpError(429, corpo);
    expect(d.tipo).toBe("COTA_ESTOURADA");
    expect(d.limiteTpm).toBe(8000);
    expect(d.usadoTpm).toBe(6592);
    expect(d.esperarSegundos).toBeCloseTo(4.29, 2);
    expect(d.tentarProximo).toBe(true);
  });

  it("404 vira MODELO_INEXISTENTE — outra causa, outra acao", () => {
    const d = classifyLlmHttpError(404, `{"error":{"message":"The model \\'llama-3.3-70b-versatile\\' does not exist"}}`);
    expect(d.tipo).toBe("MODELO_INEXISTENTE");
    expect(d.limiteTpm).toBeUndefined();
  });

  it("os dois NAO produzem o mesmo tipo — era esse o defeito do log", () => {
    expect(classifyLlmHttpError(429, "Rate limit").tipo).not.toBe(
      classifyLlmHttpError(404, "does not exist").tipo
    );
  });

  it("401 e credencial e NAO tenta o proximo modelo", () => {
    const d = classifyLlmHttpError(401, "invalid api key");
    expect(d.tipo).toBe("CREDENCIAL");
    expect(d.tentarProximo).toBe(false);
  });

  it("json_validate_failed nao e problema de modelo: trocar nao resolve", () => {
    const d = classifyLlmHttpError(400, '{"error":{"code":"json_validate_failed"}}');
    expect(d.tipo).toBe("CONTRATO_JSON");
    expect(d.tentarProximo).toBe(false);
  });

  it("400 generico tenta o proximo", () => {
    expect(classifyLlmHttpError(400, "model not supported").tentarProximo).toBe(true);
  });

  it("parseRateLimit tolera corpo sem numeros", () => {
    expect(parseRateLimit("rate limit")).toEqual({ limiteTpm: null, usadoTpm: null, esperarSegundos: null });
  });
});

describe("a mensagem de cota diz o que o dono precisa decidir", () => {
  it("traz modelo, teto e o recado de negocio", () => {
    const msg = mensagemDeCotaEstourada({
      modelo: "openai/gpt-oss-20b",
      limiteTpm: 8000,
      usadoTpm: 6592,
      esperarSegundos: 4.29,
    });
    expect(msg).toContain("openai/gpt-oss-20b");
    expect(msg).toContain("8.000");
    expect(msg).toContain("6.592");
    expect(msg).toMatch(/plano/i);
    expect(msg).not.toMatch(/indispon[ií]vel ou limite de taxa/i);
  });

  it("funciona mesmo sem os numeros", () => {
    const msg = mensagemDeCotaEstourada({ modelo: "x", limiteTpm: null, usadoTpm: null, esperarSegundos: null });
    expect(msg).toContain("A cota de IA do modelo x acabou.");
  });
});

describe("o motor usa a escada e distingue os erros", () => {
  const fonte = readFileSync(resolve("src/chatbot-ai-engine.js"), "utf8");

  it("callLlmChatCompletion monta a escada pelo modulo compartilhado", () => {
    expect(fonte).toContain("resolveGroqLadder(model)");
    expect(fonte).not.toContain("const fallbackGroqModels = [");
  });

  it("cota e modelo morto tem logs distintos", () => {
    expect(fonte).toContain("COTA ESTOURADA");
    expect(fonte).toContain("MODELO INEXISTENTE");
    expect(fonte).not.toContain("indisponível ou limite de taxa");
  });

  it("cota estourada em todos os modelos vira erro identificavel", () => {
    expect(fonte).toContain("LLM_QUOTA_EXCEEDED");
  });

  it("a tela do simulador e a do inbox recebem o codigo de cota", () => {
    const rota = readFileSync(resolve("src/domains/chatbot/routes.js"), "utf8");
    expect(rota).toContain("LLM_QUOTA_EXCEEDED");
    expect(rota).toContain("429");
  });
});

// Escada vazia ou toda invalida nao pode virar silencio.
describe("escada sem nenhum modelo utilizavel", () => {
  it("configuracao so com modelos mortos ainda devolve a escada padrao", () => {
    process.env.GROQ_MODEL_LADDER = "llama-3.3-70b-versatile,llama-3.1-8b-instant";
    // groqModelLadder devolve o que foi configurado (o dono mandou), mas
    // resolveGroqLadder — que e quem o motor usa — descarta os mortos e nunca
    // entrega lista vazia para o laco de chamada.
    expect(groqModelLadder()).toHaveLength(2);
    expect(resolveGroqLadder(null)).toEqual([]);
  });

  it("com escada vazia o motor FALHA com erro, nunca devolve conteudo inventado", async () => {
    process.env.GROQ_MODEL_LADDER = "llama-3.3-70b-versatile";
    process.env.GROQ_API_KEY = "chave-de-teste";
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const { callLlmChatCompletion } = await import("../chatbot-ai-engine.js");
    await expect(
      callLlmChatCompletion({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: "oi" }] })
    ).rejects.toThrow(/nenhum modelo|no model/i);
  });
});
