// Roteiro do agente ISOLADO por disparo — e editavel, nao congelado.
//
// Antes o disparo apontava para campaigns.campaign_prompt_id, lido ao vivo quando o
// lead respondia: editar o roteiro da campanha mudava o atendimento de disparos ja em
// andamento, e nao dava para corrigir UM disparo sem afetar os outros.
//
// Congelar seria pior: roteiro imutavel prende o dono numa campanha defeituosa — se a
// IA responde errado, a unica saida seria cancelar o disparo, e quem ja recebeu a
// mensagem uma vez nao abre de novo. Por isso e COPIA (isolada) e continua editavel.

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const dispatchSource = readFileSync(resolve("src/campaign/dispatch.js"), "utf8");
const routesSource = readFileSync(resolve("src/domains/campaigns/routes.js"), "utf8");
const migrationSource = readFileSync(
  resolve("supabase/migrations/20260811090000_campaign_dispatches_prompt_copy.sql"),
  "utf8"
);
const migrateSource = readFileSync(resolve("src/migrate.js"), "utf8");

// Espelha a precedencia de findCampaignReplyMatches: disparo manda, campanha e o resto.
function roteiroEfetivo({ promptDoDisparo, promptDaCampanha }) {
  return promptDoDisparo || promptDaCampanha || null;
}

describe("precedencia do roteiro", () => {
  it("o roteiro do DISPARO manda sobre o da campanha", () => {
    expect(roteiroEfetivo({ promptDoDisparo: "copia-1", promptDaCampanha: "original" })).toBe("copia-1");
  });

  it("editar a campanha NAO afeta disparo em andamento", () => {
    // A campanha passou a apontar para outro roteiro; o disparo mantem o dele.
    const antes = roteiroEfetivo({ promptDoDisparo: "copia-1", promptDaCampanha: "original" });
    const depoisDeEditarCampanha = roteiroEfetivo({ promptDoDisparo: "copia-1", promptDaCampanha: "outro" });
    expect(depoisDeEditarCampanha).toBe(antes);
  });

  it("cada disparo tem o seu: corrigir um nao mexe no outro", () => {
    expect(roteiroEfetivo({ promptDoDisparo: "copia-A", promptDaCampanha: "original" })).toBe("copia-A");
    expect(roteiroEfetivo({ promptDoDisparo: "copia-B", promptDaCampanha: "original" })).toBe("copia-B");
  });

  it("disparo ANTIGO (sem copia) continua no roteiro da campanha", () => {
    expect(roteiroEfetivo({ promptDoDisparo: null, promptDaCampanha: "original" })).toBe("original");
  });

  it("sem roteiro em lugar nenhum, fica null e o atendimento assume", () => {
    expect(roteiroEfetivo({ promptDoDisparo: null, promptDaCampanha: null })).toBeNull();
  });
});

describe("a leitura implementa essa precedencia", () => {
  it("findCampaignReplyMatches prefere o roteiro do disparo", () => {
    expect(dispatchSource).toContain(
      "campaignPromptId: promptDoDisparoPorCampanha[campaign.id] || campaign.campaign_prompt_id || null"
    );
  });

  it("busca o roteiro do disparo escopada por tenant", () => {
    const bloco = dispatchSource.slice(
      dispatchSource.indexOf("const promptDoDisparoPorCampanha"),
      dispatchSource.indexOf("const importIds")
    );
    expect(bloco).toContain('.from("campaign_dispatches")');
    expect(bloco).toContain('.eq("client_id", clientId)');
    expect(bloco).toContain('.not("campaign_prompt_id", "is", null)');
    // Coluna ausente num deploy antigo nao pode derrubar o roteamento.
    expect(bloco).toContain("catch");
  });
});

describe("a criacao do disparo copia o roteiro em vez de apontar", () => {
  const bloco = routesSource.slice(
    routesSource.indexOf("let dispatchPromptId = null;"),
    routesSource.indexOf(".from(\"campaign_dispatches\")\n        .insert({")
  );

  it("insere uma linha NOVA em campaign_prompts", () => {
    expect(bloco).toContain('.from("campaign_prompts")');
    expect(bloco).toContain(".insert({");
    // O conteudo copiado passou a ser `conteudoFinal` — o roteiro da origem MAIS o
    // bloco de opcoes daquele disparo. Continua sendo copia, nao ponteiro.
    expect(bloco).toContain("content: conteudoFinal");
    expect(bloco).toContain("promptOrigem.content");
  });

  it("le e grava a copia escopadas por tenant", () => {
    expect(bloco).toContain('.eq("client_id", authorizedClientId)');
    expect(bloco).toContain("client_id: authorizedClientId");
  });

  it("falha na copia nao impede o disparo", () => {
    expect(bloco).toContain("catch");
    expect(bloco).toContain("usando o da campanha");
  });

  it("o id da copia vai para a linha do disparo", () => {
    expect(routesSource).toContain("campaign_prompt_id: dispatchPromptId");
  });
});

describe("migration", () => {
  it("e aditiva: coluna nullable, sem tocar dado existente", () => {
    expect(migrationSource).toContain("ADD COLUMN IF NOT EXISTS campaign_prompt_id UUID");
    expect(migrationSource).not.toMatch(/\bDROP\s+(COLUMN|TABLE)\b/i);
    expect(migrationSource).not.toMatch(/\bNOT NULL\b/);
  });

  it("a sentinela cobre o efeito COMPLETO (coluna E indice)", () => {
    const linha = migrateSource
      .split("\n")
      .find((l) => l.includes("20260811090000_campaign_dispatches_prompt_copy.sql"));
    expect(linha).toBeTruthy();
    expect(linha).toContain("column_name='campaign_prompt_id'");
    expect(linha).toContain("idx_campaign_dispatches_prompt");
  });
});
