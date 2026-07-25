-- Tabela de Briefings de Implantação (Pós-contrato / Onboarding técnico) da Geração Digital
CREATE TABLE IF NOT EXISTS public.gd_implementation_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  model_type text NOT NULL CHECK (model_type IN ('essencial', 'avancado')),
  suggested_model text NOT NULL,
  num_employees integer DEFAULT 1,
  has_commercial_sector boolean DEFAULT false,
  prerequisites jsonb DEFAULT '{}'::jsonb,
  operacao jsonb DEFAULT '{}'::jsonb,
  inteligencia jsonb DEFAULT '{}'::jsonb,
  agente_ia jsonb DEFAULT '{}'::jsonb,
  canais jsonb DEFAULT '{}'::jsonb,
  modulos_custom jsonb DEFAULT '{}'::jsonb,
  fechamento jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'em_andamento',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gd_implementation_briefings_tenant ON public.gd_implementation_briefings (tenant_id);
