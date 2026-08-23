import { describe, expect, it, vi } from "vitest";
import { _setPgDatabasePoolForTesting } from "../services/database.js";
import {
  getLeadClientEvolutionInstances,
  getLeadClientEvolutionInstancesMap,
} from "../services/evolution.js";
import { resolveInboundDispatchSettings } from "../campaign/settings.js";

describe("evolution instances - separacao de 'sem chip' vs 'erro de banco'", () => {
  it("erro de banco no pool Postgres NAO devolve [] silencioso e lanca erro com contexto", async () => {
    const fakePool = {
      query: vi.fn().mockRejectedValue(new Error("canceling statement due to statement timeout")),
    };
    _setPgDatabasePoolForTesting(fakePool);

    try {
      await expect(getLeadClientEvolutionInstances("cliente-teste")).rejects.toThrow(
        "canceling statement due to statement timeout"
      );
    } finally {
      _setPgDatabasePoolForTesting(null);
    }
  });

  it("erro de banco em getLeadClientEvolutionInstancesMap NAO devolve {} silencioso e lanca erro", async () => {
    const fakePool = {
      query: vi.fn().mockRejectedValue(new Error("connection terminated unexpectedly")),
    };
    _setPgDatabasePoolForTesting(fakePool);

    try {
      await expect(getLeadClientEvolutionInstancesMap(["cliente-teste-1", "cliente-teste-2"])).rejects.toThrow(
        "connection terminated unexpectedly"
      );
    } finally {
      _setPgDatabasePoolForTesting(null);
    }
  });

  it("cliente realmente sem chip (busca com sucesso retornando 0 rows) devolve array vazio legitimo", async () => {
    const fakePool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    _setPgDatabasePoolForTesting(fakePool);

    try {
      const res = await getLeadClientEvolutionInstances("cliente-sem-chip");
      expect(res).toEqual([]);
    } finally {
      _setPgDatabasePoolForTesting(null);
    }
  });

  it("oscilação de 10s: responde usando o chip em cache (lastGood)", async () => {
    vi.useFakeTimers();
    try {
      // 1. Leitura inicial bem-sucedida
      const fakePoolOk = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "chip-1",
              name: "chip-alpha",
              active: true,
              is_default: true,
              dispatch_webhook_url: "https://evo.vexo.com/message/sendText/chip-alpha",
              dispatch_webhook_token: "token-123",
            },
          ],
        }),
      };
      _setPgDatabasePoolForTesting(fakePoolOk);

      const primeira = await resolveInboundDispatchSettings({
        clientId: "cliente-resiliente",
        instanceName: "chip-alpha",
      });
      expect(primeira.webhookUrl).toBe("https://evo.vexo.com/message/sendText/chip-alpha");
      expect(primeira.source).toBe("inbound_chip");

      // 2. 10 segundos depois, banco oscila com erro
      vi.advanceTimersByTime(10 * 1000);
      const fakePoolErr = {
        query: vi.fn().mockRejectedValue(new Error("canceling statement due to statement timeout")),
      };
      _setPgDatabasePoolForTesting(fakePoolErr);

      // 3. Resolução usa o lastGood em cache e não bloqueia a resposta ao lead
      const segunda = await resolveInboundDispatchSettings({
        clientId: "cliente-resiliente",
        instanceName: "chip-alpha",
      });
      expect(segunda.webhookUrl).toBe("https://evo.vexo.com/message/sendText/chip-alpha");
      expect(segunda.webhookToken).toBe("token-123");
      expect(segunda.source).toBe("inbound_chip_cache");
      expect(segunda.tentativas.some((t) => t.fonte === "chip_do_webhook_cache")).toBe(true);
    } finally {
      vi.useRealTimers();
      _setPgDatabasePoolForTesting(null);
    }
  });

  it("oscilação além do horizonte (6 min): recusa o envio com erro explícito para não queimar chip morto", async () => {
    vi.useFakeTimers();
    try {
      const fakePoolOk = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "chip-1",
              name: "chip-beta",
              active: true,
              is_default: true,
              dispatch_webhook_url: "https://evo.vexo.com/message/sendText/chip-beta",
              dispatch_webhook_token: "token-abc",
            },
          ],
        }),
      };
      _setPgDatabasePoolForTesting(fakePoolOk);

      await resolveInboundDispatchSettings({
        clientId: "cliente-expirado",
        instanceName: "chip-beta",
      });

      // Avança 6 minutos (além do horizonte de 5 minutos)
      vi.advanceTimersByTime(6 * 60 * 1000);

      const fakePoolErr = {
        query: vi.fn().mockRejectedValue(new Error("DB_FATAL_ERROR: connection reset")),
      };
      _setPgDatabasePoolForTesting(fakePoolErr);

      await expect(
        resolveInboundDispatchSettings({
          clientId: "cliente-expirado",
          instanceName: "chip-beta",
        })
      ).rejects.toThrow("[inbound-dispatch-settings] falha de banco ao resolver chip 'chip-beta'");
    } finally {
      vi.useRealTimers();
      _setPgDatabasePoolForTesting(null);
    }
  });

  it("ISOLAMENTO MULTI-TENANT ESTRITO: tenant A em degradação NUNCA recebe chip do tenant B", async () => {
    vi.useFakeTimers();
    try {
      // 1. Tenant B tem chip cadastrado e popula o cache
      const fakePoolTenantB = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "chip-b",
              name: "chip-compartilhado",
              active: true,
              is_default: true,
              dispatch_webhook_url: "https://evo.vexo.com/message/sendText/chip-do-tenant-b",
              dispatch_webhook_token: "secret-token-b",
            },
          ],
        }),
      };
      _setPgDatabasePoolForTesting(fakePoolTenantB);

      const resB = await resolveInboundDispatchSettings({
        clientId: "tenant-b",
        instanceName: "chip-compartilhado",
      });
      expect(resB.webhookUrl).toBe("https://evo.vexo.com/message/sendText/chip-do-tenant-b");

      // 2. Agora Tenant A entra durante oscilação de banco pedindo o mesmo instanceName
      const fakePoolErr = {
        query: vi.fn().mockRejectedValue(new Error("database unreachable")),
      };
      _setPgDatabasePoolForTesting(fakePoolErr);

      // Tenant A NUNCA pode receber a URL ou Token do Tenant B
      await expect(
        resolveInboundDispatchSettings({
          clientId: "tenant-a",
          instanceName: "chip-compartilhado",
        })
      ).rejects.toThrow("[inbound-dispatch-settings] falha de banco ao resolver chip 'chip-compartilhado'");
    } finally {
      vi.useRealTimers();
      _setPgDatabasePoolForTesting(null);
    }
  });

  it("chip em cache + leitura boa nova: usa a nova e atualiza o cache", async () => {
    vi.useFakeTimers();
    try {
      // 1. Leitura inicial
      const fakePoolV1 = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "chip-1",
              name: "chip-gamma",
              active: true,
              is_default: true,
              dispatch_webhook_url: "https://evo.vexo.com/message/sendText/chip-gamma-v1",
            },
          ],
        }),
      };
      _setPgDatabasePoolForTesting(fakePoolV1);
      const v1 = await resolveInboundDispatchSettings({
        clientId: "cliente-update",
        instanceName: "chip-gamma",
      });
      expect(v1.webhookUrl).toBe("https://evo.vexo.com/message/sendText/chip-gamma-v1");

      // 2. Passam 2 minutos e o chip é reconfigurado no banco
      vi.advanceTimersByTime(2 * 60 * 1000);
      const fakePoolV2 = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "chip-1",
              name: "chip-gamma",
              active: true,
              is_default: true,
              dispatch_webhook_url: "https://evo.vexo.com/message/sendText/chip-gamma-v2",
            },
          ],
        }),
      };
      _setPgDatabasePoolForTesting(fakePoolV2);

      const v2 = await resolveInboundDispatchSettings({
        clientId: "cliente-update",
        instanceName: "chip-gamma",
      });
      expect(v2.webhookUrl).toBe("https://evo.vexo.com/message/sendText/chip-gamma-v2");
      expect(v2.source).toBe("inbound_chip");
    } finally {
      vi.useRealTimers();
      _setPgDatabasePoolForTesting(null);
    }
  });
});
