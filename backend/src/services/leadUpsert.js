// Upsert de lead por (client_id, telefone) SEM depender de índice único.
//
// Por que existe: o código usava `INSERT ... ON CONFLICT (client_id, telefone)`,
// que exige um índice único nessas colunas. Esse índice já sumiu duas vezes
// (a tabela public.leads foi recriada por outro caminho), e quando ele falta o
// Postgres responde "there is no unique or exclusion constraint matching the
// ON CONFLICT specification" — derrubando em silêncio a gravação de nomes na aba
// Conversas e a extração de contatos do Banco de Dados.
//
// Estratégia: UPDATE primeiro; se não afetou nenhuma linha, INSERT. Funciona com
// ou sem o índice. O índice continua sendo criado por migration (performance e
// integridade), mas o fluxo não quebra mais se ele não existir.

/**
 * @param {import("pg").Pool} pool
 * @param {string} clientId
 * @param {string} telefone  telefone normalizado (sem "+")
 * @param {Record<string, unknown>} fields  colunas a gravar (exceto client_id/telefone)
 * @returns {Promise<"updated"|"inserted">}
 */
export async function upsertLeadByPhone(pool, clientId, telefone, fields = {}) {
  const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);

  if (cols.length > 0) {
    const setSql = cols.map((c, i) => `"${c}" = $${i + 3}`).join(", ");
    const values = cols.map((c) => fields[c]);
    const upd = await pool.query(
      `UPDATE public.leads SET ${setSql}, updated_at = now()
       WHERE client_id = $1 AND telefone = $2`,
      [clientId, telefone, ...values]
    );
    if (upd.rowCount > 0) return "updated";
  } else {
    const upd = await pool.query(
      `UPDATE public.leads SET updated_at = now() WHERE client_id = $1 AND telefone = $2`,
      [clientId, telefone]
    );
    if (upd.rowCount > 0) return "updated";
  }

  const insertCols = ["client_id", "telefone", ...cols];
  const insertVals = [clientId, telefone, ...cols.map((c) => fields[c])];
  const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(", ");
  await pool.query(
    `INSERT INTO public.leads (${insertCols.map((c) => `"${c}"`).join(", ")})
     VALUES (${placeholders})`,
    insertVals
  );
  return "inserted";
}
