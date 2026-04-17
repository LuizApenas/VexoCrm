import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.30.0";

// Cabecalhos CORS para permitir chamadas externas para a Edge Function.
const cabecalhosCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Le uma variavel de ambiente principal e, se nao existir, tenta uma alternativa.
const obterEnv = (principal: string, alternativa?: string): string | null => {
  const valor = Deno.env.get(principal);
  if (valor) return valor;
  if (!alternativa) return null;
  return Deno.env.get(alternativa) ?? null;
};

// Le o token de autenticacao configurado no ambiente da funcao.
const obterTokenBearerEsperado = (): string | null =>
  obterEnv("EDGE_FUNCTION_BEARER_TOKEN", "BEARER_TOKEN");

// Extrai o token Bearer do header Authorization.
const obterTokenBearerDaRequisicao = (req: Request): string | null => {
  const headerAutorizacao =
    req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  return headerAutorizacao.startsWith("Bearer ")
    ? headerAutorizacao.slice(7).trim()
    : null;
};

// Normaliza qualquer valor para texto, removendo espacos e um possivel "=" inicial.
const normalizarTexto = (valor: unknown): string | null => {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  return texto.startsWith("=") ? texto.slice(1).trim() : texto;
};

// Mantem somente os digitos do telefone para padronizar a busca no banco.
const sanitizarTelefone = (valor: unknown): string | null => {
  const telefoneNormalizado = normalizarTexto(valor);
  if (!telefoneNormalizado) return null;

  const somenteDigitos = telefoneNormalizado.replace(/\D/g, "");
  return somenteDigitos || null;
};

// Converte o valor da coluna "qualificacao" para booleano.
// Regras:
// - true quando o campo vier booleano true ou texto "true"
// - false quando vier false, vazio, nulo ou qualquer outro valor
const obterQualificacaoComoBooleano = (valor: unknown): boolean => {
  if (typeof valor === "boolean") return valor;

  const textoNormalizado = normalizarTexto(valor)?.toLowerCase();
  return textoNormalizado === "true";
};

// Padroniza respostas JSON da funcao.
const respostaJson = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...cabecalhosCors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });

// Padroniza respostas de erro.
const respostaErro = (status: number, erro: string, detalhes?: string) =>
  respostaJson(
    detalhes ? { success: false, error: erro, details: detalhes } : {
      success: false,
      error: erro,
    },
    status,
  );

console.info("conversation-memory-latest started");

Deno.serve(async (req: Request) => {
  // Preflight do CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cabecalhosCors });
  }

  // Esta funcao aceita somente GET.
  if (req.method !== "GET") {
    return respostaErro(405, "Method not allowed");
  }

  try {
    const tokenBearerEsperado = obterTokenBearerEsperado();
    if (!tokenBearerEsperado) {
      return respostaErro(
        500,
        "Missing bearer token",
        "Configure EDGE_FUNCTION_BEARER_TOKEN",
      );
    }

    const tokenBearer = obterTokenBearerDaRequisicao(req);
    if (tokenBearer !== tokenBearerEsperado) {
      return respostaErro(401, "Unauthorized");
    }

    // Le e sanitiza o telefone enviado via query string.
    const url = new URL(req.url);
    const telefone = sanitizarTelefone(url.searchParams.get("telefone"));

    if (!telefone) {
      return respostaErro(400, "Missing required query param: telefone");
    }

    // Busca as credenciais necessarias para acessar o Supabase com service role.
    const supabaseUrl = obterEnv("SUPABASE_URL", "URL");
    const serviceRoleKey = obterEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      "SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl || !serviceRoleKey) {
      return respostaErro(
        500,
        "Missing Supabase secrets",
        "Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    // Cliente do Supabase usado para consultar as tabelas.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: { headers: { "x-upsert": "true" } },
    });

    // Busca em paralelo:
    // 1. Se o lead existe na tabela leads e qual o valor de qualificacao.
    // 2. Qual a conversa mais recente desse telefone.
    const [resultadoLeads, resultadoConversa] = await Promise.all([
      supabase
        .from("leads")
        .select("telefone, qualificacao")
        .eq("telefone", telefone)
        .limit(1),
      supabase
        .from("lead_conversations")
        .select(
          "id, telefone, conversation_compressed, tamanho_original, unknown_lead, created_at",
        )
        .eq("telefone", telefone)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    // Trata erro de consulta na tabela leads.
    if (resultadoLeads.error) {
      console.error("conversation-memory-latest leads error:", {
        telefone,
        message: resultadoLeads.error.message,
        code: (resultadoLeads.error as { code?: string }).code ?? null,
      });

      return respostaJson(
        {
          success: false,
          error: "Failed to query leads table",
          details: resultadoLeads.error.message,
          code: (resultadoLeads.error as { code?: string }).code ?? null,
        },
        500,
      );
    }

    // Trata erro de consulta na tabela de conversas.
    if (resultadoConversa.error) {
      console.error("conversation-memory-latest conversation error:", {
        telefone,
        message: resultadoConversa.error.message,
        code: (resultadoConversa.error as { code?: string }).code ?? null,
      });

      return respostaJson(
        {
          success: false,
          error: "Failed to load conversation",
          details: resultadoConversa.error.message,
          code: (resultadoConversa.error as { code?: string }).code ?? null,
        },
        500,
      );
    }

    // O lead precisa existir na tabela leads.
    const leadExiste = (resultadoLeads.data?.length ?? 0) > 0;

    // Pega a conversa mais recente, se existir.
    const conversaMaisRecente = resultadoConversa.data?.[0] ?? null;

    // Converte a qualificacao do lead para true/false.
    // Se nao existir valor salvo, assume false.
    const leadQualificado = obterQualificacaoComoBooleano(
      resultadoLeads.data?.[0]?.qualificacao,
    );

    // found = true somente quando existe o lead e tambem existe conversa.
    const encontrado = leadExiste && conversaMaisRecente !== null;

    // Retorna a conversa somente quando as duas tabelas possuem informacao.
    return respostaJson(
      encontrado
        ? {
            success: true,
            found: true,
            telefone,
            conversation: conversaMaisRecente,
            latestConversation: conversaMaisRecente,
            id: conversaMaisRecente.id,
            conversation_compressed:
              conversaMaisRecente.conversation_compressed,
            tamanho_original: conversaMaisRecente.tamanho_original,
            unknown_lead: conversaMaisRecente.unknown_lead,
            created_at: conversaMaisRecente.created_at,
            qualificacao: leadQualificado,
          }
        : {
            success: true,
            found: false,
            telefone,
            conversation: null,
            latestConversation: null,
            qualificacao: leadQualificado,
          },
    );
  } catch (erro) {
    console.error("conversation-memory-latest error:", erro);
    return respostaErro(500, "Internal server error");
  }
});
