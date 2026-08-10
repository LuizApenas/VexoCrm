// Quem o chatbot pode atender.
//
// Incidente real: a mae do dono escreveu "Boa tarde filho!" para o numero da
// empresa e o bot respondeu "O que voce procura na Geracao Digital?". Depois
// negou conhecer o Gustavo e agradeceu a bencao. Qualquer pessoa que escrevia
// para o numero — contato pessoal, fornecedor, engano — entrava no funil,
// consumia LLM e recebia atendimento de robo.
//
// Criterio derivado do DADO, nunca de lista de numeros no codigo:
//   1. ja existe registro de lead desse telefone no tenant, ou
//   2. o telefone casa com alguma campanha (veio de disparo).
// Quem nao e nenhum dos dois fica em silencio, para atendimento humano.

export const INBOUND_SCOPE_LEADS_ONLY = "leads_only";
export const INBOUND_SCOPE_ALL = "all";

/**
 * Escopo configurado no tenant. Default seguro: sem configuracao explicita,
 * responde so lead conhecido — e o que evita constrangimento com o cliente.
 * So o valor exato "all" abre para todo mundo.
 */
export function resolveInboundScope(tenantSettings) {
  const bruto = String(tenantSettings?.chatbot_inbound_scope ?? "").trim().toLowerCase();
  return bruto === INBOUND_SCOPE_ALL ? INBOUND_SCOPE_ALL : INBOUND_SCOPE_LEADS_ONLY;
}

/**
 * Decide se o chatbot engaja. Puro: recebe os fatos ja apurados, nao consulta
 * banco — assim da para testar sem infra e o chamador controla o custo da query.
 *
 * @param {object}  params
 * @param {string}  params.scope           resolveInboundScope(tenantSettings)
 * @param {boolean} params.isKnownLead     existe registro de lead com esse telefone
 * @param {boolean} params.hasCampaignMatch telefone casa com alguma campanha
 */
export function shouldEngageInbound({ scope, isKnownLead, hasCampaignMatch }) {
  if (scope === INBOUND_SCOPE_ALL) return { engage: true, reason: null };
  if (isKnownLead) return { engage: true, reason: null };
  if (hasCampaignMatch) return { engage: true, reason: null };
  return { engage: false, reason: "desconhecido_sem_lead" };
}
