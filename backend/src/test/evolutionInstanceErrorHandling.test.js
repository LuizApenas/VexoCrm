import { describe, expect, it, vi } from "vitest";
import { _setPgDatabasePoolForTesting } from "../services/database.js";
import {
  getLeadClientEvolutionInstances,
  getLeadClientEvolutionInstancesMap,
} from "../services/evolution.js";

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
});
