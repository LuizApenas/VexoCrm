
-- Block all direct access to n8n_error_logs (only edge functions with service_role can access)
CREATE POLICY "Deny all direct access to n8n_error_logs"
ON public.n8n_error_logs
FOR ALL
USING (false);

-- Block all direct access to notifications (only edge functions with service_role can access)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access to notifications"
ON public.notifications
FOR ALL
USING (false);
