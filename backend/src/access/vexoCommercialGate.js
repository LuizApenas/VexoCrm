// Comercial Vexo: ferramenta INTERNA do dono, nao modulo vendavel.
//
// Propostas, contratos e briefings da propria Vexo moram nas mesmas tabelas da
// Geracao Digital, separados so pela coluna owner_company. As rotas /api/gd/*
// aceitavam owner_company=vexo com requireFirebaseAuth e mais nada: qualquer
// usuario interno autenticado, de qualquer tenant, listava as propostas
// comerciais do dono digitando a URL. A sidebar mostrava cadeado; a rota
// respondia 200.
//
// Aqui o criterio e o MESMO que ja protege Master Control e Administracao:
// role interno + isAdmin (requireAdminAccess em access/middlewares.js, e
// requireVexoSalesAdminAccess em domains/vexoSales/routes.js). Nao ha
// permissao nova nem plano novo — Comercial Vexo simplesmente nao existe para
// quem nao e administrador.

import { sendError } from "../services/httpInfra.js";

// Tabelas cuja linha carrega owner_company. Lista fechada: o nome vai para
// dentro do SQL, entao nunca pode vir da requisicao.
const TABELAS_COM_DONO = new Set([
  "gd_proposals",
  "gd_contracts",
  "gd_implementation_briefings",
]);

function ehAdministrador(access) {
  return access?.role === "internal" && Boolean(access?.isAdmin);
}

/**
 * Dono pedido na requisicao, lendo as tres formas que os handlers ja aceitam
 * (owner_company, ownerCompany e o booleano isVexo). Se ler menos formas que o
 * handler, sobra caminho para escapar do gate.
 */
export function requestedOwnerCompany(req) {
  const bruto =
    req?.query?.owner_company ??
    req?.query?.ownerCompany ??
    req?.body?.owner_company ??
    req?.body?.ownerCompany;

  if (bruto != null && String(bruto).trim()) return String(bruto).trim().toLowerCase();

  const flagVexo = req?.query?.isVexo ?? req?.body?.isVexo;
  if (flagVexo === true || flagVexo === "1" || flagVexo === "true") return "vexo";

  return null;
}

export function isVexoCommercialRequest(req) {
  return requestedOwnerCompany(req) === "vexo";
}

/**
 * Barra quem nao e administrador quando a requisicao PEDE owner_company=vexo.
 * Requisicao de Geracao Digital passa intacta — este gate nao muda nada para
 * quem nao mencionou "vexo".
 */
export function requireVexoCommercialAccess(req, res, next) {
  if (!isVexoCommercialRequest(req)) {
    next();
    return;
  }

  if (ehAdministrador(req.authAccess)) {
    next();
    return;
  }

  console.warn("[comercial-vexo] acesso negado", {
    rota: req.originalUrl,
    role: req.authAccess?.role,
    clientId: req.authAccess?.clientId,
  });
  sendError(res, 403, "FORBIDDEN", "Comercial Vexo é restrito ao administrador");
}

/**
 * Guard das rotas por :id, onde o dono nao vem na requisicao — vem na linha.
 * Sem isto o gate acima seria contornado pedindo a proposta direto pelo id.
 *
 * FECHA EM CASO DE ERRO, ao contrario do gate de plano modular: la a duvida
 * custa acesso a um tenant pagante; aqui a duvida custa vazamento das propostas
 * comerciais do dono. Administrador nao chega a consultar o banco.
 *
 * `poolOuGetter` aceita funcao porque pgDatabasePool so existe depois do initDb:
 * resolver o pool no registro da rota capturaria null.
 */
export function makeVexoCommercialRowGuard(poolOuGetter, tabela) {
  if (!TABELAS_COM_DONO.has(tabela)) {
    throw new Error(`[comercial-vexo] tabela nao permitida no row guard: ${tabela}`);
  }

  return async function vexoCommercialRowGuard(req, res, next) {
    if (ehAdministrador(req.authAccess)) {
      next();
      return;
    }

    const id = req.params?.id;
    if (!id) {
      next();
      return;
    }

    try {
      const pool = typeof poolOuGetter === "function" ? poolOuGetter() : poolOuGetter;
      if (!pool) throw new Error("pool indisponivel");

      const { rows } = await pool.query(
        `SELECT owner_company FROM public.${tabela} WHERE id = $1`,
        [id]
      );

      // Registro inexistente segue o fluxo: quem responde 404 e o handler.
      if (rows.length === 0) {
        next();
        return;
      }

      if (String(rows[0].owner_company || "").trim().toLowerCase() === "vexo") {
        console.warn("[comercial-vexo] acesso negado por dono do registro", {
          rota: req.originalUrl,
          tabela,
          role: req.authAccess?.role,
          clientId: req.authAccess?.clientId,
        });
        sendError(res, 403, "FORBIDDEN", "Comercial Vexo é restrito ao administrador");
        return;
      }

      next();
    } catch (err) {
      console.error("[comercial-vexo] falha ao verificar dono do registro; negando", {
        tabela,
        erro: err?.message || err,
      });
      sendError(res, 403, "FORBIDDEN", "Não foi possível verificar o dono do registro");
    }
  };
}
