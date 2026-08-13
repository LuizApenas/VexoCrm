// Chatbot mudo em producao: a IA gerava a resposta e o envio abortava com
// "[chatbot-webhook] No Evolution URL for clientId: geracao-digital". Lead real
// mandou audio e recebeu silencio.
//
// Causa: DOIS resolvedores de Evolution, e o inbound usava o que nao sabe de qual
// chip veio a conversa.
//   campanha -> resolveCampaignDispatchSettings: instancia escolhida na campanha
//   inbound  -> resolveDispatchWebhookSettings(clientId): DEFAULT do tenant
// Por isso o disparo funcionava para o mesmo clientId enquanto o inbound falhava.
//
// Agora o inbound resolve pelo chip que RECEBEU a mensagem, e cai no default so se
// nao identificar. E nunca falha calado: devolve `tentativas` com cada fonte.

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(resolve("src/campaign/settings.js"), "utf8");
const chatbotSource = readFileSync(resolve("src/domains/chatbot/routes.js"), "utf8");

describe("o inbound resolve pelo chip que recebeu", () => {
  const bloco = settingsSource.slice(
    settingsSource.indexOf("export async function resolveInboundDispatchSettings"),
    settingsSource.indexOf("export async function resolveCampaignDispatchSettings")
  );

  it("consulta as instancias do tenant quando o webhook informa o chip", () => {
    expect(bloco).toContain("getLeadClientEvolutionInstances(clientId)");
  });

  it("casa o chip pelos TRES nomes: amigavel, id e o da URL de disparo", () => {
    // Comparar so por `name` erra: o webhook manda qualquer um dos tres.
    expect(bloco).toContain("inst.name === alvo || inst.id === alvo || daUrl === alvo");
  });

  it("chip inativo ou sem URL nao e usado — cai para o default", () => {
    expect(bloco).toContain("instancia_inativa");
    expect(bloco).toContain("sem_url_de_disparo");
  });

  it("sem chip identificado, usa o default do tenant", () => {
    expect(bloco).toContain("resolveDispatchWebhookSettings(clientId)");
    expect(bloco).toContain("default_do_tenant");
  });

  it("registra CADA fonte consultada, para o log poder explicar a falha", () => {
    expect(bloco).toContain("const tentativas = []");
    expect(bloco).toContain("tentativas.push");
    expect(bloco).toContain("tentativas,");
  });
});

describe("o webhook do chatbot passa a usar o resolvedor certo", () => {
  it("chama resolveInboundDispatchSettings com o instanceName do webhook", () => {
    expect(chatbotSource).toContain(
      "await resolveInboundDispatchSettings({ clientId, instanceName })"
    );
  });

  it("nao usa mais o resolvedor de default para responder o lead", () => {
    const envio = chatbotSource.slice(
      chatbotSource.indexOf("// Enviar resposta via Evolution"),
      chatbotSource.indexOf("const evolutionHeaders")
    );
    expect(envio).not.toContain("resolveDispatchWebhookSettings(clientId)");
  });

  it("a falha vira console.error com as fontes consultadas, nao um warn generico", () => {
    const envio = chatbotSource.slice(
      chatbotSource.indexOf("// Enviar resposta via Evolution"),
      chatbotSource.indexOf("const evolutionHeaders")
    );
    expect(envio).toContain("resposta NAO enviada: sem URL da Evolution");
    expect(envio).toContain("tentativas: dispatchSettings.tentativas");
    expect(envio).toContain("instanceName");
    // A mensagem antiga nao dizia o que foi consultado.
    expect(chatbotSource).not.toContain("No Evolution URL for clientId");
  });
});
