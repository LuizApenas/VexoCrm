// Quantos chips de WhatsApp este tenant pode ter.
//
// ESPELHO de backend/src/access/chipLimit.js — a autoridade é o backend, que
// recusa a criação; aqui só se decide o que desenhar. chipLimitParity.test.js
// (backend) falha no dia em que um mudar sem o outro.
//
// O módulo "multiplos_chips" vende chip A MAIS, não vende a tela. Gate booleano
// na página impedia o cliente Essencial de conectar os dois chips que ele já
// pagou — e sem chip nada mais funciona: nem disparo, nem inbound. Foi o que
// aconteceu com o tenant Sonhare, que é Essencial e viu "Módulo Não Contratado
// no Plano Modular".

export const CHIP_LIMIT_DEFAULTS = {
  essencial: 2,
  modular_com_ferramenta: 2,
  modular_sem_ferramenta: 0,
} as const;

export type ChipLimits = {
  essencial: number | null;
  modular_com_ferramenta: number | null;
  modular_sem_ferramenta: number | null;
};

/** null = ilimitado */
export const ILIMITADO = null;

function texto(valor: unknown): string {
  return String(valor ?? "").toLowerCase().trim();
}

/** Fonte dos campos: o tenant pode trazê-los na raiz ou em n8n_settings. */
function campo(client: any, ...nomes: string[]): unknown {
  for (const nome of nomes) {
    if (client?.[nome] !== undefined && client?.[nome] !== null) return client[nome];
    if (client?.n8n_settings?.[nome] !== undefined && client?.n8n_settings?.[nome] !== null) {
      return client.n8n_settings[nome];
    }
    if (client?.n8nSettings?.[nome] !== undefined && client?.n8nSettings?.[nome] !== null) {
      return client.n8nSettings[nome];
    }
  }
  return undefined;
}

export function planoDoTenant(client: any): "essencial" | "avancado" | "modular" {
  const bruto = texto(campo(client, "plan_tier", "planTier"));
  if (bruto.includes("avancad") || bruto.includes("advanced") || bruto === "pro") return "avancado";
  if (bruto.includes("modular") || bruto.includes("avulso") || bruto.includes("custom")) return "modular";
  return "essencial";
}

function modulosContratados(client: any): Set<string> {
  const bruto = campo(client, "modulos_avulsos", "modulosAvulsos") ?? [];
  const lista: unknown[] = Array.isArray(bruto)
    ? bruto
    : typeof bruto === "string"
      ? bruto.split(",")
      : [];
  return new Set(lista.map((item) => texto(item).replace(/^(mod_|modulo_)/, "")).filter(Boolean));
}

function contratou(client: any, ids: string[]): boolean {
  const contratados = modulosContratados(client);
  if (contratados.has("all") || contratados.has("*")) return true;
  return ids.some((id) => contratados.has(texto(id)));
}

export function normalizeChipLimits(bruto?: Partial<ChipLimits> | null): ChipLimits {
  const limites: ChipLimits = { ...CHIP_LIMIT_DEFAULTS };
  if (!bruto || typeof bruto !== "object") return limites;

  for (const chave of Object.keys(CHIP_LIMIT_DEFAULTS) as (keyof ChipLimits)[]) {
    const valor = bruto[chave];
    if (valor === null) {
      limites[chave] = null;
      continue;
    }
    const numero = Number(valor);
    if (Number.isInteger(numero) && numero >= 0) limites[chave] = numero;
  }
  return limites;
}

function overrideDoTenant(client: any): number | null | undefined {
  const bruto = campo(client, "chip_limit", "chipLimit");
  if (bruto === null || bruto === undefined || bruto === "") return undefined;
  if (texto(bruto) === "ilimitado" || texto(bruto) === "unlimited") return null;
  const numero = Number(bruto);
  return Number.isInteger(numero) && numero >= 0 ? numero : undefined;
}

/**
 * Limite de chips do tenant. `null` = ilimitado.
 *
 *   Essencial ............................ base
 *   Essencial + multiplos_chips .......... ilimitado
 *   Avançado ............................. ilimitado
 *   Modular COM disparador OU agente ..... base
 *   Modular sem nenhum dos dois .......... 0
 */
export function chipLimitFor(client: any, limitesConfigurados?: Partial<ChipLimits> | null): number | null {
  const limites = normalizeChipLimits(limitesConfigurados);

  const override = overrideDoTenant(client);
  if (override !== undefined) return override;

  if (contratou(client, ["multiplos_chips", "conexoes", "chips-whatsapp", "chips"])) {
    return ILIMITADO;
  }

  const plano = planoDoTenant(client);
  if (plano === "avancado") return ILIMITADO;

  if (plano === "modular") {
    const temFerramenta = contratou(client, [
      "disparador_campanhas", "campanhas", "disparos", "planilhas",
      "agente_inbound", "agente", "agente-ia", "agente_rag", "rag",
    ]);
    return temFerramenta ? limites.modular_com_ferramenta : limites.modular_sem_ferramenta;
  }

  return limites.essencial;
}

/** Tem direito a pelo menos um chip? Só o 0 fecha a tela inteira. */
export function canUseChipsPage(client: any, limitesConfigurados?: Partial<ChipLimits> | null): boolean {
  // Sem tenant selecionado a tela abre: quem recusa de verdade é a rota.
  if (!client) return true;
  return chipLimitFor(client, limitesConfigurados) !== 0;
}

export function chipLimitExceeded(quantidadeAtual: number, limite: number | null): boolean {
  if (limite === null) return false;
  return Number(quantidadeAtual || 0) >= Number(limite);
}

/** Texto do limite para a interface. */
export function chipLimitLabel(limite: number | null): string {
  return limite === null ? "ilimitado" : String(limite);
}
