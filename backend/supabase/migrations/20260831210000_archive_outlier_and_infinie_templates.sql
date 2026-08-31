-- Desativa outlier e infinie como templates globais (não são mais clientes ativos da Vexo)
-- Mantém as linhas associadas aos seus respectivos client_ids para preservar histórico sem poluir novos tenants

UPDATE public.chatbot_templates
SET is_builtin = false, client_id = 'outlier', updated_at = now()
WHERE template_key = 'outlier' AND (client_id IS NULL OR is_builtin = true);

UPDATE public.chatbot_templates
SET is_builtin = false, client_id = 'infinie', updated_at = now()
WHERE template_key = 'infinie' AND (client_id IS NULL OR is_builtin = true);
