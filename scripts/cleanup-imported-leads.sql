-- Cleanup dos leads criados indevidamente a partir das importacoes de planilha.
-- Uso:
-- 1. Troque CLIENT_ID e os IMPORT_IDs abaixo pelos valores reais.
-- 2. Rode primeiro o bloco de PREVIEW e confira o resultado.
-- 3. Se estiver correto, rode o bloco de DELETE.

-- =========================================================
-- PARAMETROS
-- =========================================================
-- CLIENT_ID alvo:
--   infinie
--
-- IMPORT_IDs alvo:
--   30592533-adc7-4dba-bda6-ff2e5...
--
-- Opcional:
--   ajuste o corte de data em l.created_at se quiser restringir ainda mais.

-- =========================================================
-- PREVIEW
-- =========================================================
WITH imported_phones AS (
  SELECT DISTINCT
    lii.client_id,
    lii.telefone
  FROM public.lead_import_items lii
  WHERE lii.client_id = 'infinie'
    AND lii.import_id IN (
      '30592533-adc7-4dba-bda6-ff2e5...'
    )
    AND lii.telefone IS NOT NULL
)
SELECT
  l.id,
  l.client_id,
  l.telefone,
  l.nome,
  l.status,
  l.created_at
FROM public.leads l
JOIN imported_phones ip
  ON ip.client_id = l.client_id
 AND ip.telefone = l.telefone
WHERE l.client_id = 'infinie'
-- AND l.created_at >= '2026-03-15 00:00:00+00'
ORDER BY l.created_at DESC;

-- =========================================================
-- DELETE
-- =========================================================
BEGIN;

WITH imported_phones AS (
  SELECT DISTINCT
    lii.client_id,
    lii.telefone
  FROM public.lead_import_items lii
  WHERE lii.client_id = 'infinie'
    AND lii.import_id IN (
      '30592533-adc7-4dba-bda6-ff2e5...'
    )
    AND lii.telefone IS NOT NULL
)
DELETE FROM public.leads l
USING imported_phones ip
WHERE ip.client_id = l.client_id
  AND ip.telefone = l.telefone
  AND l.client_id = 'infinie';
-- AND l.created_at >= '2026-03-15 00:00:00+00';

COMMIT;
