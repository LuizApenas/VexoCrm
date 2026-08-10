// Qual cerebro atende o lead que respondeu: o da CAMPANHA ou o de ATENDIMENTO.
//
// Defeito real: lead que respondeu a um disparo era atendido pelo agente de
// atendimento, com o roteiro de quem procurou a empresa. O ramo "disparo" usava
// o prompt padrao e o roteiro da campanha era inalcancavel — `mode` existia no
// tipo, o backend aceitava, o roteamento consumia, e nenhuma tela escrevia.
//
// O gatilho e o ROTEIRO EXISTIR, nao o `mode`. Campanha antiga tem
// campaign_prompt_id nulo e continua exatamente como antes.

export const AGENTE_CAMPANHA = "campanha";
export const AGENTE_ATENDIMENTO = "atendimento";

export function resolveCampaignAgent(activeCampaign) {
  if (!activeCampaign) {
    return {
      agente: AGENTE_ATENDIMENTO,
      campaignPromptId: null,
      porque: "nenhuma campanha ativa para este telefone",
    };
  }

  const roteiro = activeCampaign.campaignPromptId || null;
  if (roteiro) {
    return {
      agente: AGENTE_CAMPANHA,
      campaignPromptId: roteiro,
      porque: "campanha ativa com roteiro proprio",
    };
  }

  return {
    agente: AGENTE_ATENDIMENTO,
    campaignPromptId: null,
    porque: "campanha ativa sem roteiro proprio",
    // Marcado como agente e sem roteiro e configuracao incompleta: o chamador
    // loga como erro, mas o lead segue atendido em vez de ficar sem resposta.
    configuracaoIncompleta: activeCampaign.mode === "agente",
  };
}
