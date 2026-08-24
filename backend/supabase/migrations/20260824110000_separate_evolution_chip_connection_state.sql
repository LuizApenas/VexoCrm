-- Separa o estágio de aquecimento (chip_state: 'cold'/'warm') do estado de conexão da Evolution (connection_state: 'open'/'close'/'connecting' etc.)
-- Tabela: public.lead_client_evolution_instances

ALTER TABLE public.lead_client_evolution_instances
  ADD COLUMN IF NOT EXISTS connection_state TEXT NOT NULL DEFAULT 'unknown';

-- Copia os valores de conexão existentes gravados em chip_state para connection_state
UPDATE public.lead_client_evolution_instances
SET connection_state = CASE
  WHEN lower(trim(chip_state)) IN ('open', 'connected', 'online', 'close', 'closed', 'disconnected', 'offline', 'connecting', 'refused', 'qrcode')
    THEN lower(trim(chip_state))
  ELSE 'unknown'
END
WHERE connection_state = 'unknown';

-- Normaliza chip_state para estágio de aquecimento estrito ('cold' ou 'warm').
-- Chips com valores de conexão (como 'open') viram 'cold', mantendo cota 100 inalterada no deploy.
UPDATE public.lead_client_evolution_instances
SET chip_state = CASE
  WHEN lower(trim(chip_state)) = 'warm' THEN 'warm'
  ELSE 'cold'
END;
