/**
 * Recuperação de Lotes Órfãos no Startup do Backend.
 *
 * Regra de Negócio (Opção 2 - Decisão do Dono):
 * - No boot, qualquer lote em `campaign_dispatches` com `status = 'running'` é órfão
 *   por definição (o processo Node que o executava morreu no deploy/restart).
 * - Marca como `status = 'failed'` com mensagem explicativa para retomada manual pelo dono
 *   ("Interrompido por reinício do servidor. Clique em Disparar para continuar de onde parou — quem já recebeu não recebe de novo.").
 * - Leads em `campaign_dispatch_runs` que ficaram em `status = 'claimed'` sem `sent_at` são marcados
 *   como `status = 'skipped'` com motivo 'Interrompido antes da confirmação de envio (envio não confirmado no restart do servidor)'.
 *   Esses leads são contados e exibidos na mensagem do lote para visibilidade total.
 * - Lotes em `status = 'done'`, `status = 'failed'`, `status = 'draft'` ou `status = 'paused'` permanecem 100% intocados.
 */

export async function recoverOrphanDispatches(pool) {
  if (!pool) return { recovered: 0, items: [] };

  try {
    // 1. Busca todos os lotes com status 'running' no banco
    const { rows: orphanDispatches } = await pool.query(`
      SELECT id, name, campaign_id, client_id, limit_per_run, triggered_at, created_at
      FROM public.campaign_dispatches
      WHERE status = 'running'
      ORDER BY triggered_at ASC NULLS LAST
    `);

    if (!orphanDispatches || orphanDispatches.length === 0) {
      return { recovered: 0, items: [] };
    }

    const items = [];

    for (const disp of orphanDispatches) {
      const dispatchId = disp.id;

      // 2. Contar leads já enviados com sucesso ('sent')
      const sentRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM public.campaign_dispatch_runs WHERE dispatch_id = $1 AND status = 'sent'`,
        [dispatchId]
      ).catch(() => ({ rows: [{ cnt: 0 }] }));
      const sentCount = Number(sentRes.rows[0]?.cnt || 0);

      // 3. Contar e tratar leads em 'claimed' sem confirmação de envio
      const claimedRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM public.campaign_dispatch_runs WHERE dispatch_id = $1 AND status = 'claimed'`,
        [dispatchId]
      ).catch(() => ({ rows: [{ cnt: 0 }] }));
      const claimedCount = Number(claimedRes.rows[0]?.cnt || 0);

      if (claimedCount > 0) {
        // Marca leads em 'claimed' como 'skipped' para que constem no histórico como não confirmados
        // e NÃO sejam reenviados automaticamente.
        await pool.query(
          `UPDATE public.campaign_dispatch_runs
           SET status = 'skipped',
               error_message = 'Interrompido antes da confirmação de envio (envio não confirmado no restart do servidor)'
           WHERE dispatch_id = $1 AND status = 'claimed'`,
          [dispatchId]
        ).catch((err) => {
          console.warn("[boot-recovery] falha ao atualizar status de leads em 'claimed':", err?.message || err);
        });
      }

      // 4. Formular mensagem explicativa com o número de não confirmados
      let errorMessage = "Interrompido por reinício do servidor. Clique em Disparar para continuar de onde parou — quem já recebeu não recebe de novo.";
      if (claimedCount > 0) {
        errorMessage = `Interrompido por reinício do servidor (${claimedCount} lead(s) com envio não confirmado — interrompidos antes da confirmação). Clique em Disparar para continuar de onde parou — quem já recebeu não recebe de novo.`;
      }

      // 5. Atualizar o lote em campaign_dispatches para 'failed'
      await pool.query(
        `UPDATE public.campaign_dispatches
         SET status = 'failed',
             error_message = $1,
             finished_at = now(),
             updated_at = now()
         WHERE id = $2 AND status = 'running'`,
        [errorMessage, dispatchId]
      );

      console.log("[boot-recovery] lote órfão recuperado:", {
        dispatchId,
        dispatchName: disp.name,
        campaignId: disp.campaign_id,
        clientId: disp.client_id,
        leadsSent: sentCount,
        leadsUnconfirmed: claimedCount,
        novoStatus: "failed",
      });

      items.push({
        dispatchId,
        dispatchName: disp.name,
        campaignId: disp.campaign_id,
        clientId: disp.client_id,
        leadsSent: sentCount,
        leadsUnconfirmed: claimedCount,
        errorMessage,
      });
    }

    console.log(`[boot-recovery] ${items.length} lote(s) órfão(s) em 'running' recuperado(s) e marcado(s) como 'failed' para retomada manual.`);
    return { recovered: items.length, items };
  } catch (err) {
    console.error("[boot-recovery] erro ao verificar/recuperar lotes órfãos:", err?.message || err);
    return { recovered: 0, error: err?.message || String(err) };
  }
}
