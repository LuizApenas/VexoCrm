// chrome-extension/content.js
// Injeção de botão flutuante e extração inteligente de conversas do Instagram Direct e LinkedIn

(function () {
  const BUTTON_ID = "vexo-scout-btn";
  const TOAST_ID = "vexo-scout-toast";
  let isExtracting = false;

  // Detecta se a página atual é Instagram ou LinkedIn
  const isInstagram = window.location.hostname.includes("instagram.com");
  const isLinkedIn = window.location.hostname.includes("linkedin.com");

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
      // Nome no topo da conversa do Direct
      const headerEl =
        document.querySelector('header h2') ||
        document.querySelector('div[role="main"] header span') ||
        document.querySelector('header span[dir="auto"]') ||
        document.querySelector('div[role="grid"] header');

      if (headerEl && headerEl.textContent.trim()) {
        contactName = headerEl.textContent.trim();
      }

      // Bolhas de mensagens do Direct
      const bubbleElements = document.querySelectorAll(
        'div[role="row"] div[dir="auto"], div[role="main"] div[dir="auto"], div[class*="x1lliihq"]'
      );

      bubbleElements.forEach((el) => {
        const text = el.textContent.trim();
        if (text && text.length > 1 && !messages.includes(text)) {
          // Ignora mensagens de status e timestamps
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

      const defaultOrigin = isInstagram ? "Instagram Direct" : "LinkedIn";

      // 1. Extração Semântica com IA
      btn.innerHTML = `<div class="vexo-spinner"></div> Extraindo com IA...`;

      const extractRes = await fetch(`${apiUrl}/api/leads/ai-extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vexoAuthToken}`,
        },
        body: JSON.stringify({
          clientId: vexoClientId,
          rawText,
          defaultOrigin,
        }),
      });

      const extractData = await extractRes.json();

      if (!extractRes.ok || !extractData.success) {
        throw new Error(extractData?.error?.message || extractData?.message || "Erro na análise com IA.");
      }

      const leads = Array.isArray(extractData.leads) ? extractData.leads : [];

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
          isInstagram ? "Instagram Direct (Vexo Scout)" : "LinkedIn (Vexo Scout)",
          lead.origem,
          lead.interesse ? `Interesse: ${lead.interesse}` : "",
        ].filter(Boolean),
      }));

      const saveRes = await fetch(`${apiUrl}/api/leads/import-csv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vexoAuthToken}`,
        },
        body: JSON.stringify({
          clientId: vexoClientId,
          rows: rowsToSave,
          importTags: [isInstagram ? "Instagram Direct (Vexo Scout)" : "LinkedIn (Vexo Scout)"],
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveData?.message || "Erro ao salvar contatos no Banco de Dados.");
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
      (isInstagram && (window.location.pathname.includes("/direct/") || window.location.pathname.includes("/your_activity/"))) ||
      (isLinkedIn && window.location.pathname.includes("/messaging/"));

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
