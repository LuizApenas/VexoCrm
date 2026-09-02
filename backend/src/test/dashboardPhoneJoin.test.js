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

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildDashboardPayload } from "../services/analytics.js";

const cliente = { id: "t", name: "T" };

function lead(id, telefone, extra = {}) {
  return { id, telefone, nome: "L" + id, status: "aguardando_resposta", created_at: "2026-01-01T00:00:00Z", ...extra };
}
function msg(phone, direction, quando = "2026-09-02T12:00:00Z", lead_id = null) {
  return { lead_id, phone, direction, created_at: quando };
}

describe("o lead casa com a mensagem mesmo com o telefone em formatos diferentes", () => {
  it("mensagem sem o nono digito casa com o lead que tem o nono", () => {
    const leads = [lead("a", "5534997817660")];
    const messages = [msg("553497817660", "outbound"), msg("553497817660", "inbound")];

    const p = buildDashboardPayload(cliente, leads, [], messages);
    expect(p.summary.contactedLeads, "lead com conversa contado como sem contato").toBe(1);
    expect(p.summary.responseRate).toBe(100);
  });

  it("telefone com mascara casa", () => {
    const p = buildDashboardPayload(cliente, [lead("a", "(34) 99781-7660")], [], [msg("5534997817660", "outbound")]);
    expect(p.summary.contactedLeads).toBe(1);
  });

  it("telefone local sem DDI casa", () => {
    const p = buildDashboardPayload(cliente, [lead("a", "34997817660")], [], [msg("+55 34 99781-7660", "outbound")]);
    expect(p.summary.contactedLeads).toBe(1);
  });

  it("ANTI-COLISAO: DDDs diferentes com os mesmos 8 digitos finais NAO casam", () => {
    // Uberlandia (34) e Sao Paulo (11). Se casassem, o Dashboard contaria
    // conversa de um lead como sendo de outro.
    const p = buildDashboardPayload(cliente, [lead("sp", "11997817660")], [], [msg("5534997817660", "outbound")]);
    expect(p.summary.contactedLeads).toBe(0);
  });

  it("lead sem telefone e sem lead_id nao e contado", () => {
    const p = buildDashboardPayload(cliente, [lead("a", null)], [], [msg("5534997817660", "outbound")]);
    expect(p.summary.contactedLeads).toBe(0);
  });

  it("casamento por lead_id continua funcionando (nao regrediu)", () => {
    const p = buildDashboardPayload(cliente, [lead("a", null)], [], [msg(null, "outbound", "2026-09-02T12:00:00Z", "a")]);
    expect(p.summary.contactedLeads).toBe(1);
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
