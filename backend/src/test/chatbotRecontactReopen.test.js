// Lead preso em "finalizado" para sempre.
//
// Um lead finalizado num teste recebia a MESMA frase de recontato a cada
// mensagem: "Nosso consultor vai entrar em contato. Posso ajudar com mais
// alguma coisa?". O usuario respondia "quando irao entrar em contato" e levava
// a mesma cortesia de volta, indefinidamente — o numero ficava inutilizado.
//
// Comportamento correto: o aviso sai UMA vez e marca `dados.recontato_avisado_em`.
// Da segunda mensagem em diante a conversa REABRE (finalizado = false) e o lead
// volta ao fluxo normal.
//
// Exercita processBatch REAL com supabase mockado. Sem banco e sem LLM: o
// caminho de recontato retorna antes de qualquer chamada de modelo, e o caminho
// reaberto e interrompido pela ausencia de prompt.

import { describe, expect, it } from "vitest";
import { processBatch } from "../chatbot-ai-engine.js";

const CLIENT_ID = "geracao-digital";
const PHONE = "5534999997660";

function makeSupabase({ leadRow }) {
  const updates = [];
  const api = {
    updates,
    from: () => api,
    select: () => api,
    order: () => api,
    limit: () => Promise.resolve({ data: leadRow ? [leadRow] : [] }),
    update: (payload) => {
      updates.push(payload);
      const chain = {
        eq: () => chain,
        then: (resolve) => resolve({ error: null }),
      };
      return chain;
    },
    eq: () => api,
    // maybeSingle/single aparecem no caminho de prompt; devolver vazio faz o
    // fluxo normal parar sem chamar LLM.
    maybeSingle: () => Promise.resolve({ data: null }),
    single: () => Promise.resolve({ data: null }),
  };
  return api;
}

function leadFinalizado(dados) {
  return {
    id: "lead-7660",
    dados,
    historico: null,
    status_conversa: "finalizado",
    finalizado: true,
    updated_at: new Date().toISOString(),
    lead_temperature: null,
  };
}

async function mandarMensagem(leadRow, texto) {
  const supabase = makeSupabase({ leadRow });
  const result = await processBatch({
    clientId: CLIENT_ID,
    phone: PHONE,
    messages: [{ text: texto }],
    supabase,
    model: "padrao",
    llmModel: "llama-3.3-70b-versatile",
  }).catch(() => null);
  return { result, updates: supabase.updates };
}

describe("recontato de lead finalizado deixa de ser beco sem saida", () => {
  it("primeira mensagem avisa e MARCA que avisou", async () => {
    const { result, updates } = await mandarMensagem(leadFinalizado({ interesse: "consórcio" }), "oi");

    expect(result?._recontato).toBe(true);
    expect(result?.mensagem).toContain("consultor");

    const patch = updates.find((u) => u.dados);
    expect(patch).toBeTruthy();
    expect(patch.dados.recontato_avisado_em).toBeTruthy();
  });

  it("segunda mensagem NAO repete o aviso: reabre a conversa", async () => {
    const jaAvisado = leadFinalizado({
      interesse: "consórcio",
      recontato_avisado_em: new Date().toISOString(),
    });

    const { result, updates } = await mandarMensagem(jaAvisado, "pode sim. Quando irao entrar em contato");

    // Nao devolveu o aviso de recontato de novo.
    expect(result?._recontato).not.toBe(true);

    // Reabriu no banco.
    const reabertura = updates.find((u) => u.finalizado === false);
    expect(reabertura).toBeTruthy();
    expect(reabertura.status_conversa).toBe("em_atendimento");
    expect(reabertura.dados.recontato_avisado_em).toBeNull();
    expect(reabertura.dados.recontato_reaberto_em).toBeTruthy();
  });

  it("as duas respostas sao DIFERENTES", async () => {
    const dados = { interesse: "consórcio" };
    const primeira = await mandarMensagem(leadFinalizado(dados), "oi");
    const segunda = await mandarMensagem(
      leadFinalizado({ ...dados, recontato_avisado_em: new Date().toISOString() }),
      "quando irao entrar em contato"
    );

    expect(primeira.result?.mensagem).toBeTruthy();
    expect(segunda.result?.mensagem ?? null).not.toBe(primeira.result?.mensagem);
  });

  it("lead sem interesse tambem marca o aviso", async () => {
    const { result, updates } = await mandarMensagem(leadFinalizado({}), "oi");

    expect(result?._recontato).toBe(true);
    expect(result?.mensagem).toContain("já passamos por uma conversa");
    expect(updates.find((u) => u.dados)?.dados?.recontato_avisado_em).toBeTruthy();
  });
});
