-- Adiciona coluna chatbot_llm_model em lead_client_n8n_settings
ALTER TABLE public.lead_client_n8n_settings
  ADD COLUMN IF NOT EXISTS chatbot_llm_model text DEFAULT 'llama-3.3-70b-versatile';

COMMENT ON COLUMN public.lead_client_n8n_settings.chatbot_llm_model IS 'Modelo de LLM/IA ativo para o chatbot (Groq, OpenAI, Anthropic, Gemini)';
