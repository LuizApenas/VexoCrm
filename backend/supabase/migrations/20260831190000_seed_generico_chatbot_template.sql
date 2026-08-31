-- Seed do template 'generico' built-in para chatbot (atendimento geral / vendas)
INSERT INTO public.chatbot_templates (template_key, client_id, display_name, agent_name, agent_role, data_fields, required_fields, classification, is_builtin)
VALUES (
  'generico', NULL, 'Atendimento Geral / Vendas', 'Consultor', 'Consultor de Atendimento e Qualificação Comercial',
  '[
    {"key":"interesse",      "label":"Interesse",      "description":"Produto ou serviço de interesse", "required":true},
    {"key":"objetivo",       "label":"Objetivo",       "description":"Objetivo principal do lead",       "required":false},
    {"key":"cidade",         "label":"Cidade",         "description":"Cidade do lead",                   "required":false},
    {"key":"estado",         "label":"Estado",         "description":"Estado (UF)",                      "required":false},
    {"key":"prazo",          "label":"Prazo",          "description":"Quando deseja começar ou comprar", "required":false},
    {"key":"melhor_horario", "label":"Melhor Horário", "description":"Melhor momento para contato",     "required":false}
  ]'::jsonb,
  '["interesse"]'::jsonb,
  '{"quente":"Interesse claro com prazo definido","morno":"Interesse demonstrado mas tirando dúvidas","frio":"Sem interesse ou curioso sem prazo"}'::jsonb,
  true
)
ON CONFLICT (template_key, client_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  data_fields = EXCLUDED.data_fields,
  required_fields = EXCLUDED.required_fields,
  classification = EXCLUDED.classification;
