// chrome-extension/content.js
// Injeção de botão flutuante e extração inteligente de conversas do Instagram Direct e LinkedIn

(function () {
  const BUTTON_ID = "vexo-scout-btn";
  const TOAST_ID = "vexo-scout-toast";
  let isExtracting = false;

  // Detecta qual rede social/canal está ativo
  const isInstagram = window.location.hostname.includes("instagram.com");
  const isFacebook = window.location.hostname.includes("facebook.com");
  const isMessenger = window.location.hostname.includes("messenger.com");
  const isLinkedIn = window.location.hostname.includes("linkedin.com");
  const isTikTok = window.location.hostname.includes("tiktok.com");

  function showToast({ title, message, leadInfo = null, isError = false, crmUrl = null }) {
    const existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    if (isError) toast.classList.add("vexo-toast-error");

    const header = document.createElement("div");
    header.className = "vexo-toast-header";

    const titleEl = document.createElement("div");
    titleEl.className = "vexo-toast-title";
    titleEl.innerHTML = isError ? `⚠️ ${title}` : `⚡ ${title}`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "vexo-toast-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => toast.remove();

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    toast.appendChild(header);

    const body = document.createElement("div");
    body.className = "vexo-toast-body";
    body.textContent = message;
    toast.appendChild(body);

    if (leadInfo) {
      const leadPill = document.createElement("div");
      leadPill.className = "vexo-lead-pill";
      leadPill.innerHTML = `👤 <strong>${leadInfo.nome}</strong> ${leadInfo.telefone ? `• ${leadInfo.telefone}` : ""} ${leadInfo.temperatura ? `• ${leadInfo.temperatura}` : ""}`;
      toast.appendChild(leadPill);
    }

    if (crmUrl) {
      const actions = document.createElement("div");
      actions.className = "vexo-toast-actions";
      const link = document.createElement("a");
      link.href = crmUrl;
      link.target = "_blank";
      link.className = "vexo-toast-btn";
      link.textContent = "Ver no Banco de Dados ➔";
      actions.appendChild(link);
      toast.appendChild(actions);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
      if (document.getElementById(TOAST_ID) === toast) {
        toast.remove();
      }
    }, 7000);
  }

  // Extrai mensagens e contexto da conversa ativa
  function extractConversationText() {
    let contactName = "Contato";
    const messages = [];

    if (isInstagram) {
      // Busca nome e @username no topo da conversa
      const headerTitleEl =
        document.querySelector('header span[dir="auto"]') ||
        document.querySelector('header h2') ||
        document.querySelector('header span') ||
        document.querySelector('div[role="main"] header span') ||
        document.querySelector('div[role="grid"] header');

      if (headerTitleEl && headerTitleEl.textContent.trim()) {
        contactName = headerTitleEl.textContent.trim();
      }

      // Bolhas de mensagens do Direct
      const bubbleElements = document.querySelectorAll(
        'div[role="row"] div[dir="auto"], div[role="main"] div[dir="auto"], div[class*="x1lliihq"]'
      );

      bubbleElements.forEach((el) => {
        const text = el.textContent.trim();
        if (text && text.length > 1 && !messages.includes(text)) {
          if (
            !text.includes("Active") &&
            !text.includes("Visto") &&
            !text.includes("Seen") &&
            !text.match(/^\d{1,2}:\d{2}$/)
          ) {
            messages.push(text);
          }
        }
      });
    } else if (isFacebook || isMessenger) {
      // Nome no Facebook Messenger
      const headerEl =
        document.querySelector('div[role="main"] h2') ||
        document.querySelector('header h1') ||
        document.querySelector('div[aria-label="Detalhes da conversa"] h1') ||
        document.querySelector('div[role="main"] header span');

      if (headerEl && headerEl.textContent.trim()) {
        contactName = headerEl.textContent.trim();
      }

      // Mensagens no Messenger
      const bubbleElements = document.querySelectorAll(
        'div[role="main"] div[dir="auto"], div[data-scope="messages_table"] div[dir="auto"], div[class*="x1lliihq"]'
      );

      bubbleElements.forEach((el) => {
        const text = el.textContent.trim();
        if (text && text.length > 1 && !messages.includes(text)) {
          messages.push(text);
        }
      });
    } else if (isLinkedIn) {
      // Nome no LinkedIn Messaging
      const headerEl =
        document.querySelector(".msg-entity-lockup__entity-title") ||
        document.querySelector(".artdeco-entity-lockup__title") ||
        document.querySelector(".msg-conversation-header h2");

      if (headerEl && headerEl.textContent.trim()) {
        contactName = headerEl.textContent.trim();
      }

      // Mensagens no LinkedIn
      const bubbleElements = document.querySelectorAll(
        ".msg-s-event-listitem__body, .msg-s-message-group__item, .msg-s-message-list p"
      );

      bubbleElements.forEach((el) => {
        const text = el.textContent.trim();
        if (text && !messages.includes(text)) {
          messages.push(text);
        }
      });
    } else if (isTikTok) {
      // Nome no TikTok
      const headerEl =
        document.querySelector('[data-e2e="chat-user-name"]') ||
        document.querySelector("header h1") ||
        document.querySelector("header h2");

      if (headerEl && headerEl.textContent.trim()) {
        contactName = headerEl.textContent.trim();
      }

      // Mensagens no TikTok
      const bubbleElements = document.querySelectorAll(
        '[data-e2e="chat-message-text"], div[class*="DivMessageText"]'
      );

      bubbleElements.forEach((el) => {
        const text = el.textContent.trim();
        if (text && !messages.includes(text)) {
          messages.push(text);
        }
      });
    }

    if (messages.length === 0) {
      // Fallback: extrai todo o texto visível da área principal
      const mainContainer = document.querySelector('div[role="main"]') || document.querySelector("main");
      if (mainContainer) {
        const fullText = mainContainer.innerText.slice(-4000);
        return `Contato: ${contactName}\n\nDiálogo:\n${fullText}`;
      }
    }

    return `Contato: ${contactName}\n\nDiálogo:\n${messages.join("\n")}`;
  }

  // Ação ao clicar no botão "Minerar com Vexo OS"
  async function handleScoutMining(btn) {
    if (isExtracting) return;

    isExtracting = true;
    btn.classList.add("vexo-loading");
    btn.innerHTML = `<div class="vexo-spinner"></div> Minerar com IA...`;

    try {
      const { vexoApiUrl, vexoClientId, vexoAuthToken } = await chrome.storage.sync.get([
        "vexoApiUrl",
        "vexoClientId",
        "vexoAuthToken",
      ]);

      const apiUrl = (vexoApiUrl || "https://crm.vexoia.com").replace(/\/+$/, "");

      if (!vexoClientId || !vexoAuthToken) {
        showToast({
          title: "Configuração Pendente",
          message: "Abra o ícone do Vexo Scout no Chrome e configure seu ID de Cliente e Token.",
          isError: true,
        });
        return;
      }

      const rawText = extractConversationText();

      if (!rawText || rawText.length < 15) {
        showToast({
          title: "Conversa Vazia",
          message: "Abra uma conversa com mensagens ativas para minerar.",
          isError: true,
        });
        return;
      }

      const defaultOrigin = isInstagram
        ? "Instagram Direct"
        : isFacebook || isMessenger
        ? "Facebook Messenger"
        : isTikTok
        ? "TikTok"
        : "LinkedIn";

      const channelTag = isInstagram
        ? "Instagram Direct (Vexo Scout)"
        : isFacebook || isMessenger
        ? "Facebook Messenger (Vexo Scout)"
        : isTikTok
        ? "TikTok (Vexo Scout)"
        : "LinkedIn (Vexo Scout)";

      // 1. Extração Semântica com IA
      btn.innerHTML = `<div class="vexo-spinner"></div> Extraindo com IA...`;

      const extractResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "VEXO_AI_EXTRACT",
            payload: {
              apiUrl,
              authToken: vexoAuthToken,
              clientId: vexoClientId,
              rawText,
              defaultOrigin,
            },
          },
          resolve
        );
      });

      if (!extractResponse || !extractResponse.ok || !extractResponse.data?.success) {
        const errMsg =
          extractResponse?.data?.error?.message ||
          extractResponse?.error ||
          "Erro na análise com IA.";
        throw new Error(errMsg);
      }

      const leads = Array.isArray(extractResponse.data.leads) ? extractResponse.data.leads : [];

      if (leads.length === 0) {
        showToast({
          title: "Nenhum Lead Encontrado",
          message: "A IA não conseguiu identificar dados de contato (nome/telefone) nesta conversa.",
          isError: true,
        });
        return;
      }

      // 2. Salvar Lead no Banco de Dados
      btn.innerHTML = `<div class="vexo-spinner"></div> Salvando Lead...`;

      const rowsToSave = leads.map((lead) => ({
        nome: lead.nome,
        telefone: lead.telefone || "",
        phone: lead.telefone || "",
        email: lead.email || "",
        stage: lead.temperatura === "Quente" ? "open_budget" : lead.temperatura === "Frio" ? "cold" : "inquiry",
        temperature: lead.temperatura === "Quente" ? "hot" : lead.temperatura === "Frio" ? "cold" : "warm",
        tags: [
          channelTag,
          lead.origem,
          lead.interesse ? `Interesse: ${lead.interesse}` : "",
        ].filter(Boolean),
      }));

      const saveResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "VEXO_SAVE_LEADS",
            payload: {
              apiUrl,
              authToken: vexoAuthToken,
              clientId: vexoClientId,
              rows: rowsToSave,
              importTags: [channelTag],
            },
          },
          resolve
        );
      });

      if (!saveResponse || !saveResponse.ok) {
        const errMsg = saveResponse?.data?.message || saveResponse?.error || "Erro ao salvar contatos.";
        throw new Error(errMsg);
      }

      const mainLead = leads[0];
      showToast({
        title: "Lead Minerado com Sucesso!",
        message: `${leads.length} contato(s) extraído(s) e qualificado(s) pela IA no Vexo OS.`,
        leadInfo: mainLead,
        crmUrl: `${apiUrl}/crm/banco-de-dados`,
      });
    } catch (err) {
      console.error("[Vexo Scout] Erro na mineração:", err);
      showToast({
        title: "Falha na Mineração",
        message: err.message || "Não foi possível extrair e salvar os contatos.",
        isError: true,
      });
    } finally {
      isExtracting = false;
      btn.classList.remove("vexo-loading");
      btn.innerHTML = `<span class="vexo-scout-icon">⚡</span> Minerar com Vexo OS`;
    }
  }

  // Injeta o botão flutuante se não existir
  function injectFloatingButton() {
    if (document.getElementById(BUTTON_ID)) return;

    // Apenas injeta se estiver em uma página de mensagens/chat
    const isDirectChat =
      (isInstagram && (
        window.location.pathname.includes("/direct") ||
        window.location.pathname.includes("/your_activity") ||
        Boolean(document.querySelector('div[role="main"] div[dir="auto"], header h2, div[role="grid"]'))
      )) ||
      ((isFacebook || isMessenger) && (
        window.location.pathname.includes("/messages") ||
        window.location.pathname.includes("/t/") ||
        window.location.hostname.includes("messenger.com") ||
        Boolean(document.querySelector('div[role="main"], div[data-scope="messages_table"], div[aria-label="Mensagens"]'))
      )) ||
      (isLinkedIn && (
        window.location.pathname.includes("/messaging") ||
        Boolean(document.querySelector(".msg-s-message-list, .msg-conversation-header"))
      )) ||
      (isTikTok && (
        window.location.pathname.includes("/messages") ||
        Boolean(document.querySelector('[data-e2e="chat-user-name"]'))
      ));

    if (!isDirectChat) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.innerHTML = `<span class="vexo-scout-icon">⚡</span> Minerar com Vexo OS`;
    btn.title = "Extrair dados deste contato e salvar no Banco de Dados do Vexo OS";

    btn.addEventListener("click", () => handleScoutMining(btn));
    document.body.appendChild(btn);
  }

  // Observer para SPA navigation e mudanças no DOM
  const observer = new MutationObserver(() => {
    injectFloatingButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Checagem periódica inicial
  setInterval(injectFloatingButton, 2000);
  injectFloatingButton();
})();
