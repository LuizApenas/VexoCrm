-- Adiciona suporte ao tipo 'resumo' na tabela chatbot_prompts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'chatbot_prompts'
  ) THEN
    ALTER TABLE public.chatbot_prompts DROP CONSTRAINT IF EXISTS chatbot_prompts_type_check;
    ALTER TABLE public.chatbot_prompts ADD CONSTRAINT chatbot_prompts_type_check 
      CHECK (type IN ('padrao', 'campanha', 'qualificar', 'extrato', 'resumo'));
  END IF;
END $$;
