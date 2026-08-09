// Reenvio do passo 1 ao mesmo lead, por horas (19:50, 20:21, 02:08, 10:58).
//
// Duas travas faltavam no caminho da fila de campaign_dispatches:
//
// 1. O scheduler roda a cada 60s. Ele fazia SELECT status='scheduled' e depois
//    UPDATE status='running' SEM condicao de status. Entre os dois havia janela:
//    o ciclo seguinte pegava o MESMO disparo e rodava em paralelo.
// 2. claimLead devolvia `true` quando o lead nao tinha id ("permite (legado)"),
//    ou seja, envio sem trava nenhuma nessas bases.
//
// Assercoes estruturais: o comportamento vive em SQL/Supabase, e o que precisa ser
// travado contra regressao e a FORMA da consulta.

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve("src/domains/campaigns/routes.js"), "utf8");

function trecho(inicio, fim) {
  const a = source.indexOf(inicio);
  expect(a, `nao achei: ${inicio}`).toBeGreaterThan(-1);
  const b = source.indexOf(fim, a);
  return source.slice(a, b > a ? b : a + 3000);
}

describe("claim atomico do disparo (scheduler)", () => {
  const bloco = trecho("const { data: claimed, error: claimErr }", "await runCampaignDispatch");

  it("o UPDATE exige status scheduled — senao nao e claim", () => {
    expect(bloco).toContain('.eq("status", "scheduled")');
    expect(bloco).toContain('.select("id")');
  });

  it("sem linha reivindicada, o disparo e PULADO em vez de rodar de novo", () => {
    expect(bloco).toMatch(/claimed\.length === 0/);
    expect(bloco).toContain("continue");
    expect(bloco).toContain("already_claimed");
  });

  it("nenhum UPDATE para running pode ser incondicional", () => {
    // Regressao: marcar running filtrando so por id reabre a janela de dupla execucao.
    // Vale para os DOIS gatilhos — o do scheduler e o botao manual.
    const updates = source.match(/status:\s*"running"[\s\S]{0,600}?\.select\("id"\)/g) || [];
    expect(updates.length, "esperava os dois claims (scheduler e manual)").toBe(2);
    for (const u of updates) {
      const temGuarda = u.includes('.eq("status", "scheduled")') || u.includes('.neq("status", "running")');
      expect(temGuarda, "update de running sem guarda de status").toBe(true);
    }
  });

  it("gatilho manual recusa disparo ja em execucao", () => {
    expect(source).toContain("DISPATCH_ALREADY_RUNNING");
  });
});

describe("claim por lead, e por telefone quando nao ha lead id", () => {
  const bloco = trecho("const claimLead = async", "const finalizeLeadSent");

  it("nao libera mais o envio so porque o lead nao tem id", () => {
    // A linha antiga era: if (!pgDatabasePool || !lead?.id) return true;
    expect(bloco).not.toMatch(/if \(!pgDatabasePool \|\| !lead\?\.id\) return true;/);
  });

  it("sem lead id, trava por telefone dentro do mesmo disparo", () => {
    expect(bloco).toContain("WHERE dispatch_id = $1 AND phone = $2");
    expect(bloco).toMatch(/rows\.length > 0[\s\S]{0,200}return false/);
  });

  it("com lead id, mantem o ON CONFLICT por (dispatch_id, lead_id)", () => {
    expect(bloco).toContain("ON CONFLICT (dispatch_id, lead_id) DO NOTHING");
  });

  it("bloqueio de reenvio deixa rastro no log", () => {
    expect(bloco).toContain("reenvio bloqueado");
  });
});

describe("o caminho de envio real esta instrumentado", () => {
  it("runCampaignDispatch da fila loga o plano de passos", () => {
    const bloco = trecho('console.info("[campaign-dispatch] plano"', "});");
    expect(bloco).toContain("origemDosPassos");
    expect(bloco).toContain("passosAposResposta");
    expect(bloco).toContain("ignoraFluxoDeResposta");
  });
});
