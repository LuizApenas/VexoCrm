// Opcoes de resposta viraram TEXTO no corpo da mensagem.
//
// O valor do recurso nunca foi o toque no botao — era oferecer caminhos para o lead
// nao ter que formular a resposta sozinho. Como o WhatsApp descontinuou botao
// interativo nesta conexao, as opcoes vao escritas e numeradas, e o agente da
// campanha reconhece a escolha porque elas entram no roteiro copiado para o disparo.

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const outboundSource = readFileSync(resolve("src/campaign-outbound.js"), "utf8");
const routesSource = readFileSync(resolve("src/domains/campaigns/routes.js"), "utf8");

// Espelha o formato que formatStepTextWithButtons produz, para travar a forma.
function montarTexto(baseText, buttons) {
  const opcoes = buttons
    .filter((b) => b.type !== "url" && !b.url)
    .map((b) => (b.displayText || "").trim())
    .filter(Boolean)
    .map((rotulo, i) => `${i + 1}. ${rotulo}`);
  const links = buttons
    .filter((b) => b.type === "url" && b.url)
    .map((b) => `👉 ${b.displayText || "Acessar Link"}: ${b.url}`);

  let texto = baseText;
  if (opcoes.length > 0) texto = `${texto}\n\n${opcoes.join("\n")}`;
  if (links.length > 0) texto = `${texto}\n\n${links.join("\n")}`;
  return texto;
}

describe("opcoes escritas na mensagem", () => {
  it("passo com 2 opcoes traz as duas, numeradas", () => {
    const texto = montarTexto("Podemos agendar?", [
      { type: "reply", displayText: "Quero agendar" },
      { type: "reply", displayText: "Prefiro receber por escrito" },
    ]);
    expect(texto).toContain("1. Quero agendar");
    expect(texto).toContain("2. Prefiro receber por escrito");
    expect(texto.startsWith("Podemos agendar?")).toBe(true);
  });

  it("passo SEM opcoes fica igual — sem sobra de formatacao", () => {
    const texto = montarTexto("Mensagem simples", []);
    expect(texto).toBe("Mensagem simples");
    expect(texto).not.toContain("\n\n");
  });

  it("opcao sem rotulo escrito nao vira linha (nada e inventado)", () => {
    const texto = montarTexto("Oi", [
      { type: "reply", displayText: "" },
      { type: "reply", displayText: "Tenho interesse" },
    ]);
    expect(texto).toContain("1. Tenho interesse");
    expect(texto).not.toContain("2.");
  });

  it("opcoes e links convivem no mesmo passo", () => {
    const texto = montarTexto("Escolha:", [
      { type: "reply", displayText: "Quero agendar" },
      { type: "url", displayText: "Ver proposta", url: "https://ex.com/p" },
    ]);
    expect(texto).toContain("1. Quero agendar");
    expect(texto).toContain("👉 Ver proposta: https://ex.com/p");
  });
});

describe("o envio implementa esse formato", () => {
  const bloco = outboundSource.slice(
    outboundSource.indexOf("function formatStepTextWithButtons"),
    outboundSource.indexOf("function buildTextPayload")
  );

  it("monta as opcoes numeradas a partir do rotulo", () => {
    expect(bloco).toContain("optionLines.push(`${idx + 1}. ${rotulo}`)");
  });

  it("usa displayText como texto da opcao, com os campos antigos como fallback", () => {
    // Compatibilidade: quem ja configurou nao perde o que escreveu.
    expect(bloco).toContain("btn.displayText || btn.label || btn.replyText || btn.value");
  });

  it("sem opcao e sem link, devolve o texto intacto", () => {
    expect(bloco).toContain("if (optionLines.length === 0 && urlButtons.length === 0) return text;");
  });

  it("nao inventa opcao: rotulo vazio ou com placaholder pendente e pulado", () => {
    expect(bloco).toContain("if (!rotulo ||");
    expect(bloco).toContain("continue");
  });
});

describe("o agente sabe das opcoes", () => {
  it("o roteiro copiado para o disparo recebe o bloco de contexto", () => {
    expect(routesSource).toContain("function buildStepOptionsContext");
    expect(routesSource).toContain("const contextoDasOpcoes = buildStepOptionsContext(validation.analyticsMeta.sequence)");
    expect(routesSource).toContain("content: conteudoFinal");
  });

  it("o contexto diz que numero, texto ou equivalente sao a mesma escolha", () => {
    const bloco = routesSource.slice(
      routesSource.indexOf("function buildStepOptionsContext"),
      routesSource.indexOf("export function registerCampaignsRoutes")
    );
    expect(bloco).toContain("OPCOES OFERECIDAS AO LEAD");
    expect(bloco).toContain("sem recomecar a conversa");
    // replyText entra como intencao, entao o campo antigo continua tendo uso.
    expect(bloco).toContain("btn.replyText || btn.value");
  });

  it("sem opcao nenhuma, o roteiro fica como estava", () => {
    const bloco = routesSource.slice(
      routesSource.indexOf("function buildStepOptionsContext"),
      routesSource.indexOf("export function registerCampaignsRoutes")
    );
    expect(bloco).toContain('if (linhas.length === 0) return ""');
  });
});
