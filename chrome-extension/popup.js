// chrome-extension/popup.js
// Gerenciamento de configurações, sincronização automática em 1 clique e teste de conexão do Vexo Scout

const DEFAULT_API_URL = "https://crm.vexoia.com";

const apiUrlInput = document.getElementById("apiUrl");
const clientIdInput = document.getElementById("clientId");
const authTokenInput = document.getElementById("authToken");
const configForm = document.getElementById("configForm");
const btnTest = document.getElementById("btnTest");
const btnAutoSync = document.getElementById("btnAutoSync");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const messageBox = document.getElementById("messageBox");

function showMessage(text, type = "success") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  setTimeout(() => {
    messageBox.className = "message";
  }, 4500);
}

function updateStatus(connected, text) {
  if (connected) {
    statusDot.className = "status-dot connected";
    statusText.textContent = text || "Conectado ao Vexo OS";
  } else {
    statusDot.className = "status-dot disconnected";
    statusText.textContent = text || "Não conectado";
  }
}

// Carregar credenciais salvas
async function loadConfig() {
  try {
    const data = await chrome.storage.sync.get(["vexoApiUrl", "vexoClientId", "vexoAuthToken"]);
    apiUrlInput.value = data.vexoApiUrl || DEFAULT_API_URL;
    clientIdInput.value = data.vexoClientId || "";
    authTokenInput.value = data.vexoAuthToken || "";

    if (data.vexoClientId && data.vexoAuthToken) {
      updateStatus(true, `Conectado (${data.vexoClientId})`);
    } else {
      updateStatus(false, "Configuração pendente");
    }
  } catch (err) {
    console.error("Erro ao carregar configurações:", err);
    updateStatus(false, "Erro ao carregar");
  }
}

// Sincronização automática em 1 clique com aba aberta do Vexo OS
async function handleAutoSync() {
  if (!btnAutoSync) return;

  btnAutoSync.disabled = true;
  btnAutoSync.textContent = "⏳ Sincronizando...";

  try {
    // Procura abas abertas do CRM
    let tabs = await chrome.tabs.query({
      url: [
        "*://crm.vexoia.com/*",
        "*://*.vexoia.com/*",
        "*://*.vercel.app/*",
        "*://localhost/*",
        "*://localhost:*/*",
        "*://127.0.0.1/*",
        "*://127.0.0.1:*/*",
      ],
    });

    if (!tabs || tabs.length === 0) {
      // Fallback: busca em todas as abas abertas na janela atual
      const allTabs = await chrome.tabs.query({});
      tabs = (allTabs || []).filter(
        (t) => t.url && (t.url.includes("vexoia.com") || t.url.includes("localhost") || t.url.includes("vercel.app"))
      );
    }

    if (!tabs || tabs.length === 0) {
      showMessage("Abra o Vexo OS no Chrome antes de conectar.", "error");
      return;
    }

    const targetTab = tabs[0];

    // Executa script na aba do Vexo OS para capturar a sessão (IndexedDB + localStorage)
    const [execResult] = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: async () => {
        let token = null;
        let clientId = null;

        // 1. Tenta ler direto do localStorage
        try {
          token = localStorage.getItem("vexo_auth_token") || null;
          clientId =
            localStorage.getItem("crm_selected_client_id") ||
            localStorage.getItem("vexo_client_id") ||
            localStorage.getItem("vexo.crm.selected-client") ||
            null;

          if (!token) {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith("firebase:authUser") || key.includes("authUser") || key.includes("firebase"))) {
                try {
                  const val = JSON.parse(localStorage.getItem(key) || "{}");
                  if (val?.stsTokenManager?.accessToken) {
                    token = val.stsTokenManager.accessToken;
                    break;
                  }
                  if (val?.accessToken) {
                    token = val.accessToken;
                    break;
                  }
                } catch (e) {}
              }
            }
          }
        } catch (e) {}

        // 2. Tenta ler do IndexedDB (Padrão do Firebase Web SDK modular v9/v10)
        if (!token && typeof indexedDB !== "undefined") {
          try {
            token = await new Promise((resolve) => {
              const req = indexedDB.open("firebaseLocalStorageDb");
              req.onerror = () => resolve(null);
              req.onsuccess = (event) => {
                try {
                  const db = event.target.result;
                  if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
                    return resolve(null);
                  }
                  const tx = db.transaction("firebaseLocalStorage", "readonly");
                  const store = tx.objectStore("firebaseLocalStorage");
                  const getAllReq = store.getAll();
                  getAllReq.onsuccess = () => {
                    const records = getAllReq.result || [];
                    for (const rec of records) {
                      const val = rec?.value || rec;
                      if (val?.stsTokenManager?.accessToken) {
                        return resolve(val.stsTokenManager.accessToken);
                      }
                      if (val?.accessToken) {
                        return resolve(val.accessToken);
                      }
                    }
                    resolve(null);
                  };
                  getAllReq.onerror = () => resolve(null);
                } catch (err) {
                  resolve(null);
                }
              };
            });
          } catch (e) {}
        }

        if (!clientId) {
          clientId = "geracao-digital";
        }

        return {
          token,
          clientId,
          origin: window.location.origin,
        };
      },
    });

    const extracted = execResult?.result;
    if (!extracted || !extracted.token) {
      showMessage("Faça login no Vexo OS na aba aberta e tente novamente.", "error");
      return;
    }

    apiUrlInput.value = extracted.origin || DEFAULT_API_URL;
    clientIdInput.value = extracted.clientId || "geracao-digital";
    authTokenInput.value = extracted.token;

    // Salva no storage da extensão
    await chrome.storage.sync.set({
      vexoApiUrl: apiUrlInput.value,
      vexoClientId: clientIdInput.value,
      vexoAuthToken: authTokenInput.value,
    });

    updateStatus(true, `Conectado ao Vexo OS (${clientIdInput.value})`);
    showMessage("✅ Conectado automaticamente com sucesso!", "success");
  } catch (err) {
    console.error("[popup] Erro na sincronização automática:", err);
    showMessage("Erro ao sincronizar. Verifique se o Vexo OS está aberto.", "error");
  } finally {
    btnAutoSync.disabled = false;
    btnAutoSync.textContent = "⚡ Conectar com Vexo OS Aberto";
  }
}

// Testar conexão com a API do Vexo OS
async function testConnection() {
  const apiUrl = (apiUrlInput.value || "").trim().replace(/\/+$/, "");
  const clientId = (clientIdInput.value || "").trim();
  const authToken = (authTokenInput.value || "").trim();

  if (!apiUrl || !clientId || !authToken) {
    showMessage("Preencha todos os campos antes de testar.", "error");
    updateStatus(false, "Campos incompletos");
    return;
  }

  btnTest.disabled = true;
  btnTest.textContent = "⏳ Testando...";

  try {
    const response = await fetch(`${apiUrl}/api/leads/ai-extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        clientId,
        rawText: "Teste de conexão Vexo Scout: Contato Teste, Tel: 5534999999999",
        defaultOrigin: "Vexo Scout Test",
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      updateStatus(true, `Conectado ao Vexo OS (${clientId})`);
      showMessage("Conexão validada com sucesso!", "success");
    } else if (response.status === 401 || response.status === 403) {
      updateStatus(false, "Token inválido ou expirado");
      showMessage("Token de autenticação não autorizado (401/403).", "error");
    } else {
      updateStatus(false, "Erro na resposta da API");
      showMessage(data?.error?.message || data?.message || "Erro ao conectar com a API.", "error");
    }
  } catch (err) {
    updateStatus(false, "Falha de rede");
    showMessage("Não foi possível conectar ao servidor. Verifique a URL.", "error");
  } finally {
    btnTest.disabled = false;
    btnTest.textContent = "🔄 Testar";
  }
}

// Salvar configurações
async function saveConfig(e) {
  e.preventDefault();

  const apiUrl = (apiUrlInput.value || "").trim().replace(/\/+$/, "");
  const clientId = (clientIdInput.value || "").trim();
  const authToken = (authTokenInput.value || "").trim();

  if (!apiUrl || !clientId || !authToken) {
    showMessage("Preencha todos os campos obrigatórios.", "error");
    return;
  }

  try {
    await chrome.storage.sync.set({
      vexoApiUrl: apiUrl,
      vexoClientId: clientId,
      vexoAuthToken: authToken,
    });

    updateStatus(true, `Salvo (${clientId})`);
    showMessage("Configurações salvas com sucesso!", "success");
  } catch (err) {
    console.error("Erro ao salvar:", err);
    showMessage("Erro ao salvar no armazenamento local.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
  if (btnAutoSync) {
    btnAutoSync.addEventListener("click", handleAutoSync);
  }
  configForm.addEventListener("submit", saveConfig);
  btnTest.addEventListener("click", testConnection);
});
