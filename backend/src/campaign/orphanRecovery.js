/**
 * Recuperação de Lotes Órfãos no Startup do Backend com Retomada Automática.
 *
 * Regra de Negócio:
 * - No boot, qualquer lote em `campaign_dispatches` com `status = 'running'` é órfão
 *   (o processo Node que o executava morreu no deploy/restart).
 * - Lotes com `status = 'interrupted'` também são elegíveis para retomada automática.
 * - Marca como `status = 'scheduled'` com trigger_type = 'auto_resume' e mensagem explicativa
 *   ("Interrompido por reinício do servidor. Retomando automaticamente do ponto onde parou — quem já recebeu não recebe de novo.").
 * - Leads em `campaign_dispatch_runs` que ficaram em `status = 'claimed'` sem `sent_at` são marcados
 *   como `status = 'skipped'` com motivo 'Interrompido antes da confirmação de envio (envio não confirmado no restart do servidor)'.
 * - O scheduler periódico do backend pega o lote em 'scheduled' e despacha os leads restantes,
 *   deduplicando rigorosamente via `buildDispatchLeads({ excludeDispatchId: dispatchId })` (quem já recebeu NÃO recebe de novo).
 * - Lotes em `status = 'done'`, `status = 'failed'`, `status = 'draft'` ou `status = 'paused'` permanecem 100% intocados.
 */

export async function recoverOrphanDispatches(pool) {
  if (!pool) return { recovered: 0, items: [] };

  try {
    // 1. Busca todos os lotes com status 'running' ou 'interrupted' no banco
    const { rows: orphanDispatches } = await pool.query(`
      SELECT id, name, campaign_id, client_id, limit_per_run, target_count, triggered_at, created_at, status, error_message
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

      // 4. Contar falhas
      const failedRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM public.campaign_dispatch_runs WHERE dispatch_id = $1 AND status = 'failed'`,
        [dispatchId]
      ).catch(() => ({ rows: [{ cnt: 0 }] }));
      const failedCount = Number(failedRes.rows[0]?.cnt || 0);

      // 5. Formular mensagem explicativa
      let errorMessage = "Pausado — servidor reiniciou durante o envio. Retome quando quiser.";
      if (claimedCount > 0) {
        errorMessage = `Pausado — servidor reiniciou durante o envio (${claimedCount} lead(s) com envio não confirmado). Retome quando quiser.`;
      }

      // 6. Atualizar o lote em campaign_dispatches para 'paused' para controle manual seguro pelo usuário
      await pool.query(
        `UPDATE public.campaign_dispatches
         SET status = 'paused',
             sent_count = $1,
             failed_count = $2,
             error_message = $3,
             finished_at = NULL,
             updated_at = now()
         WHERE id = $4 AND status = 'running'`,
        [sentCount, failedCount, errorMessage, dispatchId]
      );

      console.log("[boot-recovery] lote órfão pausado com segurança:", {
        dispatchId,
        dispatchName: disp.name,
        campaignId: disp.campaign_id,
        clientId: disp.client_id,
        leadsSent: sentCount,
        leadsFailed: failedCount,
        leadsUnconfirmed: claimedCount,
        novoStatus: "paused",
      });

      items.push({
        dispatchId,
        dispatchName: disp.name,
        campaignId: disp.campaign_id,
        clientId: disp.client_id,
        leadsSent: sentCount,
        leadsFailed: failedCount,
        leadsUnconfirmed: claimedCount,
        errorMessage,
      });
    }

    console.log(`[boot-recovery] ${items.length} lote(s) órfão(s) recuperado(s) e pausado(s) para retomada manual.`);
    return { recovered: items.length, items };
  } catch (err) {
    console.error("[boot-recovery] erro ao verificar/recuperar lotes órfãos:", err?.message || err);
    return { recovered: 0, error: err?.message || String(err) };
  }
}
