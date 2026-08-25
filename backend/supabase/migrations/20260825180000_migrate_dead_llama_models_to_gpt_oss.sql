-- Migration: Migrate dead/deprecated Groq models to openai/gpt-oss-120b in followup_companies and lead_client_n8n_settings
UPDATE public.followup_companies
  SET inbound_model = 'openai/gpt-oss-120b'
  WHERE inbound_model IN (
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'gemma-7b-it',
    'deepseek-r1-distill-llama-70b',
    'qwen-2.5-32b'
  );

UPDATE public.lead_client_n8n_settings
  SET chatbot_llm_model = 'openai/gpt-oss-120b'
  WHERE chatbot_llm_model IN (
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'gemma-7b-it',
    'deepseek-r1-distill-llama-70b',
    'qwen-2.5-32b'
  );
