// chrome-extension/background.js
// Background Service Worker: executa chamadas de API com permissão nativa de extensão (sem restrição de CORS)

function formatBearer(token) {
  const raw = String(token || "").trim();
  if (!raw) return "";
  return raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "VEXO_AI_EXTRACT") {
    const { apiUrl, authToken, clientId, rawText, defaultOrigin } = request.payload || {};
    (async () => {
      try {
        const authHeader = formatBearer(authToken);
        const res = await fetch(`${apiUrl}/api/leads/ai-extract`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            clientId,
            rawText,
            defaultOrigin,
          }),
        });
        const data = await res.json();
        sendResponse({ ok: res.ok, status: res.status, data });
      } catch (err) {
        console.error("[Vexo Scout Background] Erro em ai-extract:", err);
        sendResponse({ ok: false, error: err.message || "Erro de rede no background" });
      }
    })();
    return true; // Resposta assíncrona
  }

  if (request.action === "VEXO_SAVE_LEADS") {
    const { apiUrl, authToken, clientId, rows, importTags } = request.payload || {};
    (async () => {
      try {
        const authHeader = formatBearer(authToken);
        const res = await fetch(`${apiUrl}/api/leads/import-csv`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            clientId,
            rows,
            importTags,
          }),
        });
        const data = await res.json();
        sendResponse({ ok: res.ok, status: res.status, data });
      } catch (err) {
        console.error("[Vexo Scout Background] Erro em save-leads:", err);
        sendResponse({ ok: false, error: err.message || "Erro ao salvar contatos" });
      }
    })();
    return true; // Resposta assíncrona
  }
});
