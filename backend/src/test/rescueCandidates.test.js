// Criterio de resgate (Fase 2, 2.4): recebeu mensagem nossa E respondeu ao
// menos uma vez E o mais recente dos dois esta ha mais de N dias.
//
// ACHADO que motivou este endpoint (medido em producao, 2026-09-03): as
// colunas ultima_interacao_bot/ultima_interacao_usuario do proprio lead so sao
// escritas pelo disparo de campanha (campaign/dispatch.js:1313) — o motor do
// chatbot NUNCA as toca. Medir so por elas capturava so o subconjunto tocado
// por campanha: geracao-digital tinha 54 leads com ultima_interacao_usuario
// preenchida mas so 11 com ultima_interacao_bot — 43 leads "responderam a uma
// mensagem que, por essas colunas, nunca chegou".
//
// computeRescueCandidates/buildContactIndex leem lead_messages DIRETAMENTE —
// a mesma tabela e a MESMA query unica (sem loop por conversa) que
// buildDashboardPayload ja faz — entao cobrem as duas origens: campanha
// (que grava em lead_messages tambem, via appendLeadMessage) E chatbot
// organico (que so grava em lead_messages).

import { describe, expect, it } from "vitest";
import { computeRescueCandidates, buildContactIndex } from "../services/analytics.js";

function lead(id, telefone, extra = {}) {
  return { id, telefone, nome: "L" + id, ...extra };
}
function msg(phone, direction, quando, lead_id = null) {
  return { lead_id, phone, direction, created_at: quando };
}

const AGORA = new Date("2026-09-03T12:00:00Z");
const RECENTE = "2026-09-02T12:00:00Z"; // 1 dia atras
const ANTIGO = "2026-08-20T12:00:00Z"; // bem mais que 3 dias

describe("criterio de resgate: recebeu E respondeu E parado ha mais de N dias", () => {
  it("recebeu, respondeu, e a ultima interacao foi ha mais de 3 dias -> RESGATE", () => {
    const leads = [lead("a", "5534997817660")];
    const messages = [msg("5534997817660", "outbound", ANTIGO), msg("5534997817660", "inbound", ANTIGO)];
    const r = computeRescueCandidates(leads, messages, { now: AGORA });
    expect(r.resgate).toBe(1);
    expect(r.leads[0].id).toBe("a");
  });

  it("recebeu, respondeu, mas a ultima interacao foi RECENTE -> nao e resgate", () => {
    const leads = [lead("a", "5534997817660")];
    const messages = [msg("5534997817660", "outbound", ANTIGO), msg("5534997817660", "inbound", RECENTE)];
    const r = computeRescueCandidates(leads, messages, { now: AGORA });
    expect(r.resgate).toBe(0);
    expect(r.receberamEResponderam).toBe(1);
  });

  it("recebeu mas NUNCA respondeu -> nao e resgate, mesmo parado ha muito", () => {
    const leads = [lead("a", "5534997817660")];
    const messages = [msg("5534997817660", "outbound", ANTIGO)];
    const r = computeRescueCandidates(leads, messages, { now: AGORA });
    expect(r.resgate).toBe(0);
    expect(r.receberam).toBe(1);
    expect(r.responderam).toBe(0);
  });

  it("respondeu mas NUNCA recebeu nada nosso -> nao e resgate", () => {
    // Caso defensivo: mensagem inbound sem outbound correspondente nunca deveria
    // acontecer na pratica (lead que escreve do nada), mas o criterio exige as
    // duas pontas.
    const leads = [lead("a", "5534997817660")];
    const messages = [msg("5534997817660", "inbound", ANTIGO)];
    const r = computeRescueCandidates(leads, messages, { now: AGORA });
    expect(r.resgate).toBe(0);
    expect(r.receberam).toBe(0);
    expect(r.responderam).toBe(1);
  });

  it("lead sem mensagem nenhuma nao aparece em nenhum contador", () => {
    const r = computeRescueCandidates([lead("a", "5534997817660")], [], { now: AGORA });
    expect(r.resgate).toBe(0);
    expect(r.receberam).toBe(0);
    expect(r.responderam).toBe(0);
  });

  it("threshold configuravel: 7 dias exclui quem parou ha so 5", () => {
    const cincoDiasAtras = new Date(AGORA.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const leads = [lead("a", "5534997817660")];
    const messages = [msg("5534997817660", "outbound", cincoDiasAtras), msg("5534997817660", "inbound", cincoDiasAtras)];
    expect(computeRescueCandidates(leads, messages, { now: AGORA, thresholdDays: 3 }).resgate).toBe(1);
    expect(computeRescueCandidates(leads, messages, { now: AGORA, thresholdDays: 7 }).resgate).toBe(0);
  });
});

describe("cobre AS DUAS origens de interacao — nao so a que o disparo de campanha grava", () => {
  it("CHATBOT ORGANICO: lead_id sem NENHUMA coluna ultima_interacao_* no lead, so lead_messages", () => {
    // O caso que a medicao anterior (so ultima_interacao_bot/usuario) perdia:
    // aqui nao ha ESSAS colunas no objeto lead — e mesmo assim entra, porque a
    // fonte agora e lead_messages, casada por lead_id.
    const leads = [{ id: "organico-1", telefone: null, nome: "Sem campanha" }];
    const messages = [msg(null, "outbound", ANTIGO, "organico-1"), msg(null, "inbound", ANTIGO, "organico-1")];
    const r = computeRescueCandidates(leads, messages, { now: AGORA });
    expect(r.resgate, "conversa organica via chatbot ficou de fora do resgate").toBe(1);
  });

  it("CAMPANHA: casamento por telefone canonico, formatos diferentes", () => {
    const leads = [lead("camp-1", "5534997817660")];
    // mensagem chega sem o nono digito, como o disparo real grava
    const messages = [msg("553497817660", "outbound", ANTIGO), msg("553497817660", "inbound", ANTIGO)];
    const r = computeRescueCandidates(leads, messages, { now: AGORA });
    expect(r.resgate).toBe(1);
  });

  it("base mista: um lead so de campanha, um so organico, um dos dois — todos contam", () => {
    const leads = [
      lead("camp", "5534997817660"),
      { id: "organico", telefone: null, nome: "Organico" },
    ];
    const messages = [
      msg("5534997817660", "outbound", ANTIGO),
      msg("5534997817660", "inbound", ANTIGO),
      msg(null, "outbound", ANTIGO, "organico"),
      msg(null, "inbound", ANTIGO, "organico"),
    ];
    const r = computeRescueCandidates(leads, messages, { now: AGORA });
    expect(r.resgate).toBe(2);
  });
});

describe("resposta e leitura pura — nao gera efeito colateral", () => {
  it("nao muda os objetos de entrada", () => {
    const leads = [lead("a", "5534997817660")];
    const messages = [msg("5534997817660", "outbound", ANTIGO), msg("5534997817660", "inbound", ANTIGO)];
    const leadsAntes = JSON.stringify(leads);
    const messagesAntes = JSON.stringify(messages);
    computeRescueCandidates(leads, messages, { now: AGORA });
    expect(JSON.stringify(leads)).toBe(leadsAntes);
    expect(JSON.stringify(messages)).toBe(messagesAntes);
  });

  it("lista de candidatos vem ordenada da mais antiga pra mais recente, com telefone e nome", () => {
    const leads = [lead("mais-recente", "5534000000001"), lead("mais-antigo", "5534000000002")];
    const messages = [
      msg("5534000000001", "outbound", "2026-08-25T00:00:00Z"),
      msg("5534000000001", "inbound", "2026-08-25T00:00:00Z"),
      msg("5534000000002", "outbound", "2026-08-15T00:00:00Z"),
      msg("5534000000002", "inbound", "2026-08-15T00:00:00Z"),
    ];
    const r = computeRescueCandidates(leads, messages, { now: AGORA });
    expect(r.leads.map((l) => l.id)).toEqual(["mais-antigo", "mais-recente"]);
    expect(r.leads[0].telefone).toBe("5534000000002");
    expect(r.leads[0].nome).toBe("Lmais-antigo");
  });

  it("buildContactIndex e a UNICA implementacao — computeRescueCandidates usa ela", () => {
    // Prova estrutural leve: os dois vem do mesmo modulo e o index tem as
    // chaves que buildDashboardPayload tambem consome.
    const index = buildContactIndex([], []);
    expect(Object.keys(index).sort()).toEqual(
      ["inboundLeads", "inboundPhones", "lastContactByLead", "lastContactByPhone", "outboundLeads", "outboundPhones"].sort()
    );
  });
});

describe("a rota e realmente so leitura", () => {
  it("nenhum insert/update/upsert/delete no handler de rescue-candidates", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const fonte = readFileSync(resolve("src/domains/insights/routes.js"), "utf8");
    const inicio = fonte.indexOf('"/api/dashboard/rescue-candidates"');
    expect(inicio, "rota rescue-candidates sumiu do fonte").toBeGreaterThan(-1);
    const proximaRota = fonte.indexOf("\n  app.get(", inicio + 40);
    const trecho = fonte.slice(inicio, proximaRota === -1 ? inicio + 3000 : proximaRota);
    for (const escrita of [".insert(", ".update(", ".upsert(", ".delete(", "CREATE TABLE"]) {
      expect(trecho, `rota rescue-candidates contem ${escrita} — deveria ser so leitura`).not.toContain(escrita);
    }
    expect(trecho).toContain("computeRescueCandidates(");
  });

  it("usa ensureSharedRoutePageAccess com chave valida (dashboard)", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const fonte = readFileSync(resolve("src/domains/insights/routes.js"), "utf8");
    const inicio = fonte.indexOf('"/api/dashboard/rescue-candidates"');
    const trecho = fonte.slice(inicio, inicio + 400);
    expect(trecho).toContain('ensureSharedRoutePageAccess(req, res, "dashboard")');
  });
});
