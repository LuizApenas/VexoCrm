import { existsSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DATA_PATH = join(__dirname, "..", ".wwebjs_auth");
const SESSION_CLIENT_ID = "vexocrm";
const CHROME_CANDIDATE_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_BIN,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function buildInitialState() {
  return {
    status: "idle",
    message: "WhatsApp ainda nao iniciado.",
    qrCodeDataUrl: null,
    lastError: null,
    clientInfo: null,
    syncProgress: null,
    syncStatusMessage: null,
    syncStartedAt: null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function normalizePhoneToWhatsAppId(phone) {
  const normalized = String(phone || "").replace(/\D/g, "");

  if (!normalized) {
    throw new Error("Phone is required.");
  }

  if (normalized.includes("@")) {
    return normalized;
  }

  if (normalized.length === 10 || normalized.length === 11) {
    return `55${normalized}@c.us`;
  }

  if (normalized.length >= 12) {
    return `${normalized}@c.us`;
  }

  throw new Error("Phone number is invalid.");
}

function resolveChromeExecutablePath() {
  return CHROME_CANDIDATE_PATHS.find((candidate) => existsSync(candidate)) || undefined;
}

class WhatsAppSessionManager {
  constructor() {
    this.client = null;
    this.initializingPromise = null;
    this.state = buildInitialState();
  }

  getSessionDirectory() {
    return join(AUTH_DATA_PATH, `session-${SESSION_CLIENT_ID}`);
  }

  hasPersistedSession() {
    return existsSync(this.getSessionDirectory());
  }

  getState() {
    return {
      ...this.state,
      hasPersistedSession: this.hasPersistedSession(),
    };
  }

  updateState(nextState) {
    this.state = {
      ...this.state,
      ...nextState,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  registerClientEvents(client) {
    client.on("qr", async (qr) => {
      try {
        const qrCodeDataUrl = await qrcode.toDataURL(qr, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
        });

        this.updateState({
          status: "qr_ready",
          message: "Escaneie o QR Code com o WhatsApp para conectar.",
          qrCodeDataUrl,
          lastError: null,
          clientInfo: null,
          syncProgress: null,
          syncStatusMessage: null,
          syncStartedAt: null,
        });
      } catch (error) {
        this.updateState({
          status: "error",
          message: "Falha ao gerar o QR Code do WhatsApp.",
          qrCodeDataUrl: null,
          lastError: error instanceof Error ? error.message : String(error),
          syncProgress: null,
          syncStatusMessage: null,
          syncStartedAt: null,
        });
      }
    });

    client.on("authenticated", () => {
      this.updateState({
        status: "authenticated",
        message: "QR lido. Iniciando sincronizacao das conversas...",
        qrCodeDataUrl: null,
        lastError: null,
        syncProgress: 0,
        syncStatusMessage: "Preparando sincronizacao",
        syncStartedAt: this.state.syncStartedAt || new Date().toISOString(),
      });
    });

    client.on("loading_screen", (percent, message) => {
      this.updateState({
        status: "authenticated",
        message: "Sincronizando mensagens do WhatsApp...",
        qrCodeDataUrl: null,
        lastError: null,
        syncProgress: typeof percent === "number" ? percent : this.state.syncProgress,
        syncStatusMessage: typeof message === "string" ? message : this.state.syncStatusMessage,
        syncStartedAt: this.state.syncStartedAt || new Date().toISOString(),
      });
    });

    client.on("ready", () => {
      this.updateState({
        status: "ready",
        message: "WhatsApp conectado e pronto para uso.",
        qrCodeDataUrl: null,
        lastError: null,
        clientInfo: this.buildClientInfo(),
        syncProgress: 100,
        syncStatusMessage: "Conversas sincronizadas",
        syncStartedAt: null,
      });
    });

    client.on("auth_failure", (message) => {
      this.updateState({
        status: "auth_failure",
        message: "Falha na autenticacao do WhatsApp. Gere um novo QR Code.",
        qrCodeDataUrl: null,
        lastError: typeof message === "string" ? message : "Authentication failure",
        clientInfo: null,
        syncProgress: null,
        syncStatusMessage: null,
        syncStartedAt: null,
      });
    });

    client.on("disconnected", (reason) => {
      this.client = null;
      this.initializingPromise = null;
      this.updateState({
        status: "disconnected",
        message: "Sessao desconectada. Gere um novo QR Code para reconectar.",
        qrCodeDataUrl: null,
        lastError: typeof reason === "string" ? reason : "Disconnected",
        clientInfo: null,
        syncProgress: null,
        syncStatusMessage: null,
        syncStartedAt: null,
      });
    });
  }

  buildClientInfo() {
    const info = this.client?.info;

    return info
      ? {
          wid: info.wid?._serialized || null,
          pushname: info.pushname || null,
          platform: info.platform || null,
        }
      : null;
  }

  ensureReadyClient() {
    if (!this.client || this.state.status !== "ready") {
      throw new Error("WhatsApp session is not connected.");
    }

    return this.client;
  }

  serializeChat(chat) {
    const lastMessage = chat.lastMessage
      ? {
          id: chat.lastMessage.id?._serialized || null,
          body: chat.lastMessage.body || "",
          fromMe: !!chat.lastMessage.fromMe,
          timestamp: chat.lastMessage.timestamp || chat.lastMessage.t || null,
          type: chat.lastMessage.type || null,
        }
      : null;

    return {
      id: chat.id._serialized,
      name: chat.name || chat.formattedTitle || chat.pushname || chat.id.user || "Contato sem nome",
      isGroup: !!chat.isGroup,
      unreadCount: chat.unreadCount || 0,
      timestamp: chat.t || chat.timestamp || lastMessage?.timestamp || null,
      archived: !!chat.archived,
      pinned: !!chat.pinned,
      muted: !!chat.isMuted,
      lastMessage,
    };
  }

  serializeMessage(message) {
    return {
      id: message.id?._serialized || null,
      body: message.body || "",
      from: message.from || null,
      to: message.to || null,
      author: message.author || null,
      fromMe: !!message.fromMe,
      timestamp: message.timestamp || null,
      type: message.type || null,
      hasMedia: !!message.hasMedia,
    };
  }

  async start() {
    if (this.client) {
      return this.getState();
    }

    if (this.initializingPromise) {
      await this.initializingPromise;
      return this.getState();
    }

    this.updateState({
      status: "initializing",
      message: "Inicializando sessao do WhatsApp...",
      qrCodeDataUrl: null,
      lastError: null,
    });

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: SESSION_CLIENT_ID,
        dataPath: AUTH_DATA_PATH,
      }),
      puppeteer: {
        executablePath: resolveChromeExecutablePath(),
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
    });

    this.client = client;
    this.registerClientEvents(client);

    this.initializingPromise = client
      .initialize()
      .catch((error) => {
        this.client = null;
        this.updateState({
          status: "error",
          message: "Nao foi possivel iniciar a sessao do WhatsApp.",
          qrCodeDataUrl: null,
          lastError: error instanceof Error ? error.message : String(error),
          clientInfo: null,
          syncProgress: null,
          syncStatusMessage: null,
          syncStartedAt: null,
        });
      })
      .finally(() => {
        this.initializingPromise = null;
      });

    await this.initializingPromise;
    return this.getState();
  }

  async restorePersistedSession() {
    if (!this.hasPersistedSession()) {
      return this.getState();
    }

    if (this.state.status !== "idle" && this.state.status !== "disconnected") {
      return this.getState();
    }

    return this.start();
  }

  async reset() {
    const currentClient = this.client;
    this.client = null;
    this.initializingPromise = null;

    if (currentClient) {
      try {
        await currentClient.destroy();
      } catch (error) {
        console.error("Failed to destroy WhatsApp client:", error);
      }
    }

    if (existsSync(AUTH_DATA_PATH)) {
      rmSync(AUTH_DATA_PATH, { recursive: true, force: true });
    }

    this.state = buildInitialState();
    this.updateState({
      status: "idle",
      message: "Sessao reiniciada. Gere um novo QR Code para conectar.",
    });

    return this.getState();
  }

  async getChats() {
    const client = this.ensureReadyClient();
    const chats = await client.getChats();

    return chats
      .filter((chat) => !chat.isStatus)
      .map((chat) => this.serializeChat(chat))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  async getChatsPage({ limit = 20, offset = 0, search = "" } = {}) {
    const client = this.ensureReadyClient();

    return client.pupPage.evaluate(({ limit, offset, search }) => {
      const normalizedSearch = String(search || "").trim().toLowerCase();
      const safeOffset = Math.max(0, Number(offset) || 0);
      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

      const baseChats = window.Store.Chat.getModelsArray().filter((chat) => chat?.id?.server !== "status");

      const filteredChats = normalizedSearch
        ? baseChats.filter((chat) => {
            const name =
              chat.formattedTitle ||
              chat.name ||
              chat.contact?.pushname ||
              chat.contact?.name ||
              chat.id?.user ||
              "";
            const lastBody =
              chat.lastMessage?.body ||
              chat.lastMessage?.caption ||
              chat.previewMessage?.body ||
              "";

            return (
              String(name).toLowerCase().includes(normalizedSearch) ||
              String(chat.id?._serialized || "").toLowerCase().includes(normalizedSearch) ||
              String(lastBody).toLowerCase().includes(normalizedSearch)
            );
          })
        : baseChats;

      const pageChats = filteredChats.slice(safeOffset, safeOffset + safeLimit);

      return Promise.all(pageChats.map((chat) => window.WWebJS.getChatModel(chat))).then((models) => {
        const items = models
          .filter(Boolean)
          .map((model) => {
            const serializedId =
              typeof model.id === "string" ? model.id : model.id?._serialized || null;
            const lastMessage = model.lastMessage
              ? {
                  id:
                    typeof model.lastMessage.id === "string"
                      ? model.lastMessage.id
                      : model.lastMessage.id?._serialized || null,
                  body: model.lastMessage.body || model.lastMessage.caption || "",
                  fromMe:
                    model.lastMessage.fromMe ??
                    model.lastMessage.id?.fromMe ??
                    false,
                  timestamp:
                    model.lastMessage.t ||
                    model.lastMessage.timestamp ||
                    null,
                  type: model.lastMessage.type || null,
                }
              : null;

            return {
              id: serializedId,
              name:
                model.formattedTitle ||
                model.name ||
                model.contact?.pushname ||
                model.contact?.name ||
                model.id?.user ||
                "Contato sem nome",
              isGroup: !!model.isGroup,
              unreadCount: model.unreadCount || 0,
              timestamp: model.t || model.timestamp || lastMessage?.timestamp || null,
              archived: !!(model.archived ?? model.archive),
              pinned: !!model.pinned,
              muted: !!model.isMuted,
              lastMessage,
            };
          })
          .filter((item) => !!item.id);

        return {
          items,
          total: filteredChats.length,
          nextOffset: safeOffset + items.length,
          hasMore: safeOffset + items.length < filteredChats.length,
        };
      });
    }, { limit, offset, search });
  }

  async getMessages(chatId, limit = 50) {
    const client = this.ensureReadyClient();
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });

    return messages
      .map((message) => this.serializeMessage(message))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  async sendMessage(chatId, body) {
    const client = this.ensureReadyClient();
    const message = await client.sendMessage(chatId, body);
    return this.serializeMessage(message);
  }

  async sendDirectMessage(phone, body) {
    const client = this.ensureReadyClient();
    const chatId = normalizePhoneToWhatsAppId(phone);
    const number = await client.getNumberId(chatId);

    if (!number?._serialized) {
      throw new Error("WhatsApp number not found.");
    }

    const message = await client.sendMessage(number._serialized, body);
    return {
      chatId: number._serialized,
      message: this.serializeMessage(message),
    };
  }

  async markChatAsSeen(chatId) {
    const client = this.ensureReadyClient();
    const chat = await client.getChatById(chatId);
    await chat.sendSeen();

    return {
      success: true,
      chatId,
    };
  }
}

export const whatsappSessionManager = new WhatsAppSessionManager();
