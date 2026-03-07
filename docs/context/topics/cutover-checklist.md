# Checklist de Cutover: Supabase Functions para VPS

## Pré-Cutover

### Backend Pronto
- [ ] `backend/.env` configurado com todos os valores de produção
- [ ] Imagem Docker builda com sucesso: `cd backend && docker build -t vexo-api .`
- [ ] Container inicia e `/health` retorna `ok: true`
- [ ] `CORS_ORIGINS` definido com o domínio exato de produção da Vercel
- [ ] Validação de token Firebase Admin funciona (testar com token de staging)
- [ ] Conexão Supabase verificada (consulta de leads retorna dados)

### Frontend Pronto
- [ ] Root Directory da Vercel definido como `frontend` (ou `VexoCrm/frontend`)
- [ ] `VITE_API_BASE_URL` definido no dashboard da Vercel (env Produção)
- [ ] Todas as variáveis Firebase definidas no dashboard da Vercel
- [ ] `cd frontend && npm run build` passa localmente
- [ ] `cd frontend && npm run test` passa localmente

### Infraestrutura Pronta
- [ ] VPS acessível via SSH
- [ ] Docker e Docker Compose instalados na VPS
- [ ] Registro DNS A do domínio `api.seudominio.com` apontando para o IP da VPS
- [ ] Caddyfile atualizado com o nome correto do domínio
- [ ] `docker-compose.prod.yml` na VPS com arquivo `.env`

### Integração Pronta
- [ ] URL do webhook de leads no n8n atualizada para endpoint da VPS
- [ ] URL do webhook de erros no n8n atualizada para endpoint da VPS
- [ ] Segredos dos webhooks n8n correspondem aos valores de `backend/.env`

## Etapas do Cutover

1. **Implantar backend na VPS**
   ```bash
   ssh vps
   cd /opt/vexocrm/backend
   bash deploy.sh
   ```

2. **Verificar saúde do backend**
   ```bash
   curl https://api.seudominio.com/health
   ```
   Esperado: `{"ok":true,...}`

3. **Testar endpoints da API** (da máquina local)
   ```bash
   # Leads
   curl https://api.seudominio.com/api/leads?clientId=infinie

   # Planilhas (usar planilha pública conhecida)
   curl "https://api.seudominio.com/api/sheets?sheetId=SHEET_ID&gid=0"
   ```

4. **Atualizar variáveis de ambiente da Vercel** (se ainda não feito)
   - Definir `VITE_API_BASE_URL=https://api.seudominio.com` na Vercel Produção

5. **Disparar redeploy na Vercel**
   - Fazer push de um commit ou disparar redeploy manual no dashboard da Vercel

6. **Verificar frontend**
   - Abrir URL de produção
   - Verificar se a página `/leads` carrega dados
   - Verificar se o sino de notificações funciona (login necessário)

7. **Testar webhooks n8n**
   - Disparar um lead de teste pelo n8n
   - Verificar se o lead aparece no CRM
   - Disparar um erro de teste (ou aguardar um natural)
   - Verificar se a notificação aparece

## Validação Pós-Cutover

- [ ] Página `/leads` exibe dados do backend na VPS
- [ ] Notificações carregam e marcar-como-lido funciona
- [ ] Novos leads do n8n aparecem no CRM em até 1 minuto
- [ ] Notificações de erro do n8n aparecem no ícone do sino
- [ ] Sem erros de CORS no console do navegador
- [ ] Sem erros 401/500 no console do navegador
- [ ] Logs do backend sem erros inesperados: `docker logs vexo-api --tail=100`

## Plano de Rollback

Se forem encontrados problemas após o cutover:

1. **Reverter variáveis de ambiente da Vercel** para apontar para a API antiga (se aplicável)
2. **SSH na VPS** e executar `bash rollback.sh`
3. **Reverter URLs dos webhooks n8n** para as URLs antigas das Supabase Edge Functions
4. **Disparar redeploy na Vercel**

Meta: rollback completo em menos de 10 minutos.

## Limpeza Pós-Cutover (após 7 dias estável)

- [ ] Remover/desativar Supabase Edge Functions (`leads-webhook`, `n8n-error-webhook`, `notifications-api`, `sheets-proxy`)
- [ ] Remover diretório `VexoCrm/supabase/functions/` do repo
- [ ] Remover `@supabase/supabase-js` do package.json do VexoCrm (se ainda não feito)
- [ ] Atualizar `docs/context/current.md` com status final
