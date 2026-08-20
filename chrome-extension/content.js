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

  // Extrai mensagens e contexto da conversa ativa com leitura de texto nativo
  function extractConversationFromActiveView(contactNameFromCard) {
    // 1. Nome do contato: usa o nome capturado com segurança do card lateral
    let contactName = contactNameFromCard || "Contato Social";

    const headerEl =
      document.querySelector('div[role="main"] h2, div[role="main"] h1, header h2, header h1, div[role="dialog"] h2') ||
      document.querySelector('div[role="main"] header span, header span[dir="auto"], div[aria-label="Detalhes da conversa"] h1');

    if (headerEl && headerEl.innerText?.trim() && headerEl.innerText.trim().length > 1) {
      const cleanHeaderName = headerEl.innerText.trim().split("\n")[0];
      if (!cleanHeaderName.includes("Direct") && !cleanHeaderName.includes("Mensagens") && !cleanHeaderName.includes("Chat")) {
        contactName = cleanHeaderName;
      }
    }

    // 2. Extrai o texto completo da área de mensagens da direita
    const mainPane =
      document.querySelector('div[role="main"]') ||
      document.querySelector('section[role="region"]') ||
      document.querySelector('div[role="dialog"]') ||
      document.querySelector('main') ||
      document.body;

    const rawText = mainPane ? (mainPane.innerText || "") : "";
    // Pega as últimas 3.000 letras do diálogo (tamanho ideal para IA)
    const dialogSnippet = rawText.length > 3000 ? rawText.slice(-3000) : rawText;

    return {
      contactName,
      dialogText: `Contato: ${contactName}\n\nDiálogo:\n${dialogSnippet || "Interação no Direct"}`,
    };
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

      const { contactName, dialogText } = extractConversationFromActiveView("Contato");

      if (!dialogText || dialogText.length < 15) {
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
              rawText: dialogText,
              defaultOrigin,
              defaultContactName: contactName,
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
        nome: lead.nome || contactName,
        telefone: lead.telefone || "",
        phone: lead.telefone || "",
        email: lead.email || "",
        stage: lead.temperatura === "Quente" ? "open_budget" : lead.temperatura === "Frio" ? "cold" : "inquiry",
        temperature: lead.temperatura === "Quente" ? "hot" : lead.temperatura === "Frio" ? "cold" : "warm",
        tags: [
          channelTag,
          lead.origem || defaultOrigin,
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

      if (!saveResponse || !saveResponse.ok || !saveResponse.data?.success) {
        const errMsg =
          saveResponse?.data?.error?.message ||
          saveResponse?.data?.message ||
          saveResponse?.error ||
          "Erro ao salvar contatos.";
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

  // Controle do Auto-Scout em Massa
  let isBulkMining = false;
  let bulkCancelRequested = false;

  function showBulkProgress(current, total, savedCount) {
    let progressModal = document.getElementById("vexo-bulk-progress");
    if (!progressModal) {
      progressModal = document.createElement("div");
      progressModal.id = "vexo-bulk-progress";
      document.body.appendChild(progressModal);
    }

    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

    progressModal.innerHTML = `
      <div class="vexo-progress-header">
        <div class="vexo-progress-title">
          <span class="vexo-scout-icon">⚡</span> Vexo Auto-Scout em Massa
        </div>
        <button type="button" class="vexo-progress-cancel-btn" id="vexo-cancel-bulk-btn">
          ⏹️ Parar
        </button>
      </div>
      <div class="vexo-progress-track">
        <div class="vexo-progress-fill" style="width: ${pct}%;"></div>
      </div>
      <div class="vexo-progress-status">
        <span>Processando conversa ${current} de ${total}...</span>
        <span class="vexo-progress-counter">${savedCount} lead(s) salvos</span>
      </div>
    `;

    const cancelBtn = document.getElementById("vexo-cancel-bulk-btn");
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        bulkCancelRequested = true;
        cancelBtn.textContent = "Cancelando...";
        cancelBtn.disabled = true;
      };
    }
  }

  function hideBulkProgress() {
    const progressModal = document.getElementById("vexo-bulk-progress");
    if (progressModal) progressModal.remove();
  }

  // Busca candidatos visíveis na barra lateral
  function getVisibleChatCandidates() {
    if (isInstagram) {
      const mensagensHeader = Array.from(
        document.querySelectorAll("span, div, h4, h2")
      ).find((el) => el.innerText?.trim() === "Mensagens");
      const minY = mensagensHeader ? mensagensHeader.getBoundingClientRect().bottom + 5 : 240;

      const candidates = Array.from(
        document.querySelectorAll(
          'div[role="list"] > div, div[role="listitem"], div[role="row"], div[tabindex="0"], a[href*="/direct/t/"]'
        )
      );
      const seen = new Set();
      return candidates.filter((el) => {
        const rect = el.getBoundingClientRect();
        const text = el.innerText?.trim() || "";
        const isBelowNotes = rect.top >= minY;
        const isLeftSidebar =
          rect.left < window.innerWidth * 0.45 && rect.width > 200 && rect.height >= 45;
        const isNotControl =
          !text.includes("Pesquisar") &&
          !text.includes("Sua nota") &&
          !text.includes("Pedidos") &&
          !text.includes("Compartilhe o que");
        if (!isBelowNotes || !isLeftSidebar || !isNotControl || !text) return false;
        const firstLine = text.split("\n")[0].trim().slice(0, 25);
        if (seen.has(firstLine)) return false;
        seen.add(firstLine);
        return true;
      });
    } else if (isFacebook || isMessenger) {
      const candidates = Array.from(
        document.querySelectorAll(
          'a[href*="/messages/e2ee/t/"], a[href*="/messages/t/"], a[href*="/messages/"], div[data-scope="messages_table"] div[role="row"], div[role="grid"] div[role="row"], div[role="navigation"] div[role="button"]'
        )
      );
      const seen = new Set();
      return candidates.filter((el) => {
        const href = el.getAttribute("href") || "";
        if (
          href.includes("/stories/") ||
          href.includes("/reel/") ||
          href.includes("/watch/") ||
          href.includes("story_tray")
        ) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        const text = el.innerText?.trim() || "";
        const isSidebar = rect.left < window.innerWidth * 0.45 && rect.width > 160 && rect.height >= 40;
        if (!isSidebar || !text) return false;
        const firstLine = text.split("\n")[0].trim().slice(0, 25);
        if (seen.has(firstLine)) return false;
        seen.add(firstLine);
        return true;
      });
    } else if (isLinkedIn) {
      const candidates = Array.from(
        document.querySelectorAll(
          '.msg-conversations-container__conversations-list li a, .msg-conversation-listitem__link, .msg-conversation-card'
        )
      );
      const seenHrefs = new Set();
      return candidates.filter((el) => {
        const href = el.getAttribute("href") || el.innerText;
        if (!href || seenHrefs.has(href)) return false;
        seenHrefs.add(href);
        return true;
      });
    } else if (isTikTok) {
      return Array.from(document.querySelectorAll('[data-e2e="chat-list-item"]'));
    }
    return [];
  }

  async function handleBulkMining(btn) {
    if (isBulkMining || isExtracting) return;

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

    // Carrega cache de conversas já mineradas
    const storageData = await chrome.storage.local.get("minedChatIds");
    let minedChatIds = Array.isArray(storageData?.minedChatIds) ? storageData.minedChatIds : [];

    let initialCandidates = getVisibleChatCandidates();

    if (initialCandidates.length === 0) {
      showToast({
        title: "Lista de Chats Não Encontrada",
        message: isInstagram
          ? "Abra o Direct (instagram.com/direct) com a lista de conversas visível."
          : "Abra a tela de mensagens com a lista de conversas visível para usar o Auto-Scout.",
        isError: true,
      });
      return;
    }

    const TARGET_MAX_CHATS = 35; // Lote de mineração contínua
    isBulkMining = true;
    bulkCancelRequested = false;
    btn.classList.add("vexo-loading");
    btn.innerHTML = `<div class="vexo-spinner"></div> Auto-Scout Rodando...`;

    let totalSavedLeads = 0;
    let processedChatsCount = 0;
    const processedChatKeys = new Set();

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

    showBulkProgress(1, TARGET_MAX_CHATS, 0);

    try {
      let consecutiveEmptyScrolls = 0;

      while (processedChatsCount < TARGET_MAX_CHATS && consecutiveEmptyScrolls < 3) {
        if (bulkCancelRequested) break;

        const currentCandidates = getVisibleChatCandidates();
        const unhandledCandidates = currentCandidates.filter((item) => {
          const key = item.getAttribute("href") || item.innerText?.split("\n")[0].trim();
          return key && !processedChatKeys.has(key);
        });

        if (unhandledCandidates.length === 0) {
          // Rola a barra lateral para carregar novas conversas do feed infinito
          const sidebarContainer =
            document.querySelector('div[role="navigation"]') ||
            document.querySelector('div[role="grid"]') ||
            document.querySelector('div[role="list"]') ||
            document.querySelector('div[aria-label="Chats"]') ||
            document.querySelector('div[aria-label="Conversas"]') ||
            document.querySelector('div[aria-label="Direct"]');

          if (sidebarContainer) {
            sidebarContainer.scrollBy({ top: 400, behavior: "smooth" });
            await new Promise((r) => setTimeout(r, 1200));
            consecutiveEmptyScrolls++;
            continue;
          } else {
            break;
          }
        }

        consecutiveEmptyScrolls = 0;

        for (const item of unhandledCandidates) {
          if (bulkCancelRequested || processedChatsCount >= TARGET_MAX_CHATS) break;

          const chatKey = item.getAttribute("href") || item.innerText?.split("\n")[0].trim() || `chat_${processedChatsCount}`;
          processedChatKeys.add(chatKey);

          // 1. Extrai o nome do contato diretamente do card lateral antes do clique
          const cardText = item.innerText?.trim() || "";
          const cardLines = cardText.split("\n").map((l) => l.trim()).filter(Boolean);
          const contactName = cardLines[0] || "Contato Social";

          // Verifica se já foi minerado anteriormente pelo cache
          if (minedChatIds.includes(chatKey)) {
            processedChatsCount++;
            showBulkProgress(processedChatsCount, TARGET_MAX_CHATS, totalSavedLeads);
            continue;
          }

          processedChatsCount++;
          showBulkProgress(processedChatsCount, TARGET_MAX_CHATS, totalSavedLeads);

          // 2. Dispara a navegação para o chat
          const clickTarget = item.querySelector("a, div[role='button']") || item;
          clickTarget.scrollIntoView({ block: "nearest", behavior: "smooth" });
          ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((evt) => {
            clickTarget.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
          });
          if (clickTarget.tagName === "A" && clickTarget.href) {
            try { clickTarget.click(); } catch (_) {}
          }

          // 3. Aguarda 1.5s para carregar a conversa
          await new Promise((r) => setTimeout(r, 1500));
          if (bulkCancelRequested) break;

          // 4. Captura o texto real do chat
          const { dialogText } = extractConversationFromActiveView(contactName);

          // 5. Envia para IA
          try {
            const extractResponse = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                {
                  action: "VEXO_AI_EXTRACT",
                  payload: {
                    apiUrl,
                    authToken: vexoAuthToken,
                    clientId: vexoClientId,
                    rawText: dialogText,
                    defaultOrigin,
                    defaultContactName: contactName,
                  },
                },
                resolve
              );
            });

            const extractedLeads =
              Array.isArray(extractResponse?.data?.leads) && extractResponse.data.leads.length > 0
                ? extractResponse.data.leads
                : [
                    {
                      nome: contactName,
                      telefone: null,
                      origem: defaultOrigin,
                      interesse: "Interação no Direct",
                      temperatura: "Frio",
                    },
                  ];

            const rowsToSave = extractedLeads.map((lead) => ({
              nome: lead.nome || contactName,
              telefone: lead.telefone || "",
              phone: lead.telefone || "",
              email: lead.email || "",
              stage: lead.temperatura === "Quente" ? "open_budget" : lead.temperatura === "Frio" ? "cold" : "inquiry",
              temperature: lead.temperatura === "Quente" ? "hot" : lead.temperatura === "Frio" ? "cold" : "warm",
              tags: [
                channelTag,
                lead.origem || defaultOrigin,
                lead.interesse ? `Interesse: ${lead.interesse}` : "",
              ].filter(Boolean),
            }));

            // 6. Salva no Banco de Dados
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

            // 7. Incrementa o contador e registra no cache
            if (saveResponse && saveResponse.ok && saveResponse.data?.success) {
              totalSavedLeads += extractedLeads.length;
              minedChatIds.push(chatKey);
              await chrome.storage.local.set({ minedChatIds: minedChatIds.slice(-500) });
              showBulkProgress(processedChatsCount, TARGET_MAX_CHATS, totalSavedLeads);
            } else {
              console.warn(`[Vexo Scout] Falha ao salvar conversa ${contactName}:`, saveResponse?.data?.error || saveResponse?.error);
            }
          } catch (itemErr) {
            console.warn(`[Vexo Scout Bulk] Erro ao minerar conversa:`, itemErr);
          }

          // Pequeno intervalo suave antes da próxima
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      hideBulkProgress();

      showToast({
        title: "Varredura Concluída!",
        message: `🎉 Auto-Scout finalizado! ${totalSavedLeads} contato(s) qualificado(s) e salvo(s) no Banco de Dados.`,
        crmUrl: `${apiUrl}/crm/banco-de-dados`,
      });
    } catch (bulkErr) {
      console.error("[Vexo Scout] Erro no Auto-Scout:", bulkErr);
      hideBulkProgress();
      showToast({
        title: "Auto-Scout Interrompido",
        message: bulkErr.message || "Ocorreu um erro durante a varredura em massa.",
        isError: true,
      });
    } finally {
      isBulkMining = false;
      bulkCancelRequested = false;
      btn.classList.remove("vexo-loading");
      btn.innerHTML = `🤖 Minerar Todas as Conversas`;
    }
  }

  // Injeta a barra flutuante de ferramentas se não existir
  function injectFloatingButton() {
    if (document.getElementById("vexo-scout-toolbar")) return;

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

    const toolbar = document.createElement("div");
    toolbar.id = "vexo-scout-toolbar";

    // Botão 1: Auto-Scout em Massa
    const btnBulk = document.createElement("button");
    btnBulk.id = "vexo-bulk-scout-btn";
    btnBulk.innerHTML = `🤖 Minerar Todas as Conversas`;
    btnBulk.title = "Percorrer automaticamente todas as conversas da lista e minerar os contatos";
    btnBulk.addEventListener("click", () => handleBulkMining(btnBulk));

    // Botão 2: Minerar Esta Conversa
    const btnSingle = document.createElement("button");
    btnSingle.id = BUTTON_ID;
    btnSingle.innerHTML = `<span class="vexo-scout-icon">⚡</span> Minerar com Vexo OS`;
    btnSingle.title = "Extrair dados desta conversa e salvar no Banco de Dados do Vexo OS";
    btnSingle.addEventListener("click", () => handleScoutMining(btnSingle));

    toolbar.appendChild(btnBulk);
    toolbar.appendChild(btnSingle);
    document.body.appendChild(toolbar);
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
