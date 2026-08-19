# ⚡ Vexo Scout — Extensão Google Chrome

> **Mineração Inteligente de Leads com 1 Clique (Instagram Direct & LinkedIn)**

O **Vexo Scout** é uma extensão do Google Chrome (Manifest V3) que permite aos operadores comerciais extrair, qualificar com Inteligência Artificial e salvar contatos diretamente de conversas no **Instagram Direct** e **LinkedIn Messaging** no Banco de Dados do **Vexo OS**.

---

## 📦 Como Instalar no Google Chrome

1. Abra o Google Chrome e acesse: `chrome://extensions/`
2. No canto superior direito, ative a chave **"Modo do desenvolvedor"** (*Developer mode*).
3. Clique no botão **"Carregar sem compactação"** (*Load unpacked*).
4. Selecione a pasta `chrome-extension/` deste repositório (`vexo-sales-module/chrome-extension`).
5. A extensão **Vexo Scout** aparecerá na sua barra de extensões.

---

## ⚙️ Configuração Inicial

1. Clique no ícone do **Vexo Scout** na barra de ferramentas do Chrome.
2. Preencha os campos:
   - **URL da API**: `https://crm.vexoia.com` (ou `http://localhost:3001` em desenvolvimento local).
   - **ID da Empresa / Tenant**: Exemplo: `geracao-digital`.
   - **Token de Autenticação**: Seu Token de Acesso / Bearer Token do Vexo OS.
3. Clique em **"Salvar"** e depois em **"Testar"** para validar a conexão 🟢.

---

## 🚀 Como Minerar Contatos

1. Abra qualquer conversa no [Instagram Direct](https://www.instagram.com/direct/) ou no [LinkedIn Messaging](https://www.linkedin.com/messaging/).
2. O botão flutuante **⚡ Minerar com Vexo OS** aparecerá automaticamente no canto inferior direito.
3. Clique no botão:
   - A IA do Vexo OS analisa todo o diálogo da conversa.
   - Extrai nome, telefone normalizado, e-mail, interesse, nível de temperatura (`🔥 Quente`, `☀️ Morno`, `❄️ Frio`).
   - Salva o contato automaticamente na tabela de Leads do seu tenant com a tag `Instagram Direct (Vexo Scout)` ou `LinkedIn (Vexo Scout)`.
   - Um banner animado exibirá a confirmação do lead minerado com link direto para o Banco de Dados.
