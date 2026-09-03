// A juncao lead <-> lead_messages do Dashboard estava morta.
//
// Medido em producao 2026-09-02T18:04:05.358Z:
//   geracao-digital  contactedLeads=101  de 2126   responseRate=59%
//   sonhare          contactedLeads=107  de 783    responseRate=41%
//
// Os numeros nao fecham entre si: 59% de resposta sobre 101 contatados sao ~60
// pessoas, e o inbox do mesmo tenant tinha 415 conversas ativas no mesmo minuto.
//
// Duas causas somadas:
//   1) o SELECT de /api/dashboard nao trazia a coluna `telefone`, e
//      contactedLeads/noContact3d/responseRate/totalMessaged casam por
//      lead.telefone — metade de cada condicao era sempre falsa;
//   2) mesmo com a coluna, telefone CRU nao casa: o lead guarda 5534997817660 e
//      a mensagem chega como 553497817660 (sem o 9) ou com mascara.
//
// Sobrava so o casamento por lead_id, que nem sempre e gravado.
//
// ATUALIZACAO (Fase 2, 2.1): `contactedLeads` MUDOU DE FONTE — agora e
// pipelineAtendimento (stage='inquiry'), nao mais o casamento de telefone. O
// bloco abaixo, que provava a canonicalizacao atraves de `contactedLeads`, foi
// reescrito para provar a MESMA coisa atraves de `noContact3d` e
// `responseRate` — os dois campos que ainda dependem do join canonico de
// telefone hoje. Nao e enfraquecer o teste: e seguir o campo que carrega a
// garantia depois que o significado de `contactedLeads` mudou por decisao
// aprovada do dono.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildDashboardPayload } from "../services/analytics.js";

const cliente = { id: "t", name: "T" };
const ANTIGO = "2026-01-01T00:00:00Z";

function lead(id, telefone, extra = {}) {
  return { id, telefone, nome: "L" + id, status: "aguardando_resposta", created_at: ANTIGO, ...extra };
}
function msg(phone, direction, quando = new Date().toISOString(), lead_id = null) {
  return { lead_id, phone, direction, created_at: quando };
}

describe("o lead casa com a mensagem mesmo com o telefone em formatos diferentes", () => {
  it("mensagem sem o nono digito casa com o lead que tem o nono", () => {
    const leads = [lead("a", "5534997817660")];
    const messages = [msg("553497817660", "outbound"), msg("553497817660", "inbound")];

    const p = buildDashboardPayload(cliente, leads, [], messages);
    expect(p.summary.responseRate, "lead com conversa contado como sem resposta").toBe(100);
    // A mensagem RECENTE (canonicalizada) vira o ultimo contato: nao fica parado.
    expect(p.summary.noContact3d).toBe(0);
  });

  it("telefone com mascara casa (outbound recente evita 'parado')", () => {
    // Lead criado ha muito tempo (ANTIGO); se a mensagem NAO casar, a data de
    // criacao e o unico fallback e o lead conta como parado (+3 dias).
    const p = buildDashboardPayload(cliente, [lead("a", "(34) 99781-7660")], [], [msg("5534997817660", "outbound")]);
    expect(p.summary.noContact3d, "mascara nao canonicalizou — caiu no fallback da data de criacao").toBe(0);
  });

  it("telefone local sem DDI casa (outbound recente evita 'parado')", () => {
    const p = buildDashboardPayload(cliente, [lead("a", "34997817660")], [], [msg("+55 34 99781-7660", "outbound")]);
    expect(p.summary.noContact3d).toBe(0);
  });

  it("ANTI-COLISAO: DDDs diferentes com os mesmos 8 digitos finais NAO casam", () => {
    // Uberlandia (34) e Sao Paulo (11). Se casassem, a mensagem RECENTE do
    // numero de Uberlandia seria tomada como ultimo contato do lead de Sao
    // Paulo, e ele deixaria de aparecer como parado — o que seria o Dashboard
    // atribuindo conversa de um lead a outro.
    const p = buildDashboardPayload(cliente, [lead("sp", "11997817660")], [], [msg("5534997817660", "outbound")]);
    expect(p.summary.noContact3d, "colidiu: mensagem de outro DDD contou como contato deste lead").toBe(1);
  });

  it("lead sem telefone e sem lead_id nao e afetado por mensagem alheia", () => {
    const p = buildDashboardPayload(cliente, [lead("a", null)], [], [msg("5534997817660", "outbound")]);
    // Sem telefone e sem lead_id, a mensagem nao pode ser atribuida: o lead
    // (criado ha muito tempo) permanece parado.
    expect(p.summary.noContact3d).toBe(1);
  });

  it("casamento por lead_id continua funcionando (nao regrediu)", () => {
    const p = buildDashboardPayload(
      cliente,
      [lead("a", null)],
      [],
      [msg(null, "outbound", new Date().toISOString(), "a"), msg(null, "inbound", new Date().toISOString(), "a")]
    );
    expect(p.summary.responseRate, "casamento por lead_id parou de funcionar").toBe(100);
    expect(p.summary.noContact3d).toBe(0);
  });
});

describe("noContact3d usa a ULTIMA mensagem, nao a idade do cadastro", () => {
  it("lead com mensagem de hoje NAO conta como parado", () => {
    const hoje = new Date().toISOString();
    const p = buildDashboardPayload(cliente, [lead("a", "5534997817660")], [], [msg("553497817660", "inbound", hoje)]);
    expect(p.summary.noContact3d).toBe(0);
  });

  it("lead com mensagem antiga conta como parado", () => {
    const p = buildDashboardPayload(cliente, [lead("a", "5534997817660")], [], [msg("553497817660", "inbound", "2026-01-01T00:00:00Z")]);
    expect(p.summary.noContact3d).toBe(1);
  });
});

describe("a coluna telefone precisa estar no SELECT — sem ela nada acima funciona", () => {
  const fonte = readFileSync(resolve("src/domains/insights/routes.js"), "utf8");

  it("/api/dashboard seleciona telefone", () => {
    const i = fonte.indexOf(".select(\"id, nome");
    expect(i, "SELECT de leads do dashboard sumiu do fonte").toBeGreaterThan(-1);
    expect(fonte.slice(i, i + 200)).toContain("telefone");
  });
});
