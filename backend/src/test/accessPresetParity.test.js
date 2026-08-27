// Um preset valido nao pode ser recusado, e um invalido nao pode atravessar.
//
// Onboarding real travado (27/08/2026, tenant "Bia do Spazio"):
//   PATCH /api/admin/users/rFf.../access -> 400 "Unsupported access preset"
//
// Havia DOIS validadores no mesmo backend, com regras diferentes:
//   normalizeAccessPreset (claims.js)  -> `if (normalized) return normalized;`
//                                          devolvia QUALQUER string
//   auth/routes.js                     -> aceitava 8 chaves
//
// Preset desconhecido atravessava o normalizador, era devolvido pela API, a tela
// o reenviava no PATCH e so entao era recusado — com uma mensagem que nao dizia
// qual valor. O usuario ficava preso: cada tentativa reenviava o mesmo valor.
//
// Varredura das claims em 27/08/2026: 10 usuarios, 1 com preset fora das 8
// ("internal_admin"). O ramo permissivo era o unico jeito de esse valor existir.

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import {
  ACCESS_PRESET_KEYS,
  ACCESS_PRESET_DEFAULTS,
  buildSystemAccessProfiles,
  findAccessProfileByKey,
  normalizeAccessPreset,
  resolveAccessPreset,
  describeAccessPresetAdjustment,
  listAccessPresetKeys,
  getDefaultPresetForRole,
} from "../access/claims.js";

const PERFIS = buildSystemAccessProfiles();

describe("o normalizador NUNCA devolve entrada nao reconhecida", () => {
  const desconhecidos = [
    "internal_admin", // o valor real encontrado na base
    "admin",
    "interno",
    "manager",
    "equipe_vexo",
    "  GESTOR_ANTIGO  ",
    "adminvexo",
  ];

  it.each(desconhecidos)("%s vira uma chave valida", (valor) => {
    const preset = normalizeAccessPreset(valor, "internal");
    expect(ACCESS_PRESET_KEYS, `"${valor}" atravessou o normalizador`).toContain(preset);
  });

  it("o que o normalizador devolve, o validador ACEITA — era esse o descasamento", () => {
    for (const valor of [...desconhecidos, ...ACCESS_PRESET_KEYS, "", null, undefined, 42]) {
      for (const papel of ["internal", "client", "pending"]) {
        const preset = normalizeAccessPreset(valor, papel);
        expect(
          findAccessProfileByKey(PERFIS, preset),
          `normalizador devolveu "${preset}" (de ${JSON.stringify(valor)}/${papel}) e o validador recusaria`
        ).toBeTruthy();
      }
    }
  });

  it("valor valido do papel certo passa INTACTO", () => {
    expect(normalizeAccessPreset("gestor", "internal")).toBe("gestor");
    expect(normalizeAccessPreset("admin_vexo", "internal")).toBe("admin_vexo");
    expect(normalizeAccessPreset("client_operator", "client")).toBe("client_operator");
    expect(normalizeAccessPreset("pending", "pending")).toBe("pending");
  });

  it("caixa e espaco nao quebram", () => {
    expect(normalizeAccessPreset("  Gestor  ", "internal")).toBe("gestor");
  });

  it("vazio cai no padrao do papel, sem marcar ajuste", () => {
    for (const papel of ["internal", "client", "pending"]) {
      const r = resolveAccessPreset("", papel);
      expect(r.preset).toBe(getDefaultPresetForRole(papel));
      expect(r.ajustado).toBe(false);
    }
  });
});

describe("quando ajusta, CONTA que ajustou", () => {
  it("preset desconhecido: ajustado, com o valor recebido preservado no aviso", () => {
    const r = resolveAccessPreset("internal_admin", "internal");
    expect(r.ajustado).toBe(true);
    expect(r.motivo).toBe("preset_desconhecido");
    expect(r.recebido).toBe("internal_admin");
    expect(r.preset).toBe("operador");

    const aviso = describeAccessPresetAdjustment(r);
    expect(aviso).toContain("internal_admin");
    expect(aviso).toContain("não existe");
    expect(aviso).toContain("Operador");
  });

  it("perfil de OUTRO papel: ajustado, com motivo proprio", () => {
    // O item 4 do bloco: a tela oferece perfil de cliente para usuario interno,
    // e a escolha era reescrita em silencio. Agora avisa.
    const r = resolveAccessPreset("client_operator", "internal");
    expect(r.ajustado).toBe(true);
    expect(r.motivo).toBe("papel_incompativel");
    expect(describeAccessPresetAdjustment(r)).toContain("outro tipo de usuário");
  });

  it("valor valido do papel certo NAO marca ajuste", () => {
    expect(resolveAccessPreset("gestor", "internal").ajustado).toBe(false);
  });
});

describe("PARIDADE: as listas de preset do backend e do frontend", () => {
  function listaDoFrontend() {
    const src = readFileSync(resolve("../frontend/src/lib/access.ts"), "utf8");
    const bloco = src.slice(
      src.indexOf("export const ACCESS_PRESET_ORDER"),
      src.indexOf("];", src.indexOf("export const ACCESS_PRESET_ORDER"))
    );
    return (bloco.match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ""));
  }

  function listaDoFallbackDaTela() {
    const src = readFileSync(resolve("../frontend/src/pages/UserAccessManagement.tsx"), "utf8");
    const i = src.indexOf("const fallbackKeys: AccessPreset[] = [");
    const bloco = src.slice(i, src.indexOf("];", i));
    return (bloco.match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ""));
  }

  it("as tres listas foram lidas (guarda contra teste vazio)", () => {
    expect(ACCESS_PRESET_KEYS.length).toBe(8);
    expect(listaDoFrontend().length).toBe(8);
    expect(listaDoFallbackDaTela().length).toBe(8);
  });

  it("backend x ACCESS_PRESET_ORDER do frontend", () => {
    expect([...listaDoFrontend()].sort()).toEqual([...ACCESS_PRESET_KEYS].sort());
  });

  it("backend x fallback da tela de usuarios", () => {
    expect([...listaDoFallbackDaTela()].sort()).toEqual([...ACCESS_PRESET_KEYS].sort());
  });

  it("listAccessProfiles devolve exatamente as mesmas chaves", () => {
    expect(PERFIS.map((p) => p.key).sort()).toEqual([...ACCESS_PRESET_KEYS].sort());
  });

  it("toda chave tem defaults declarados, com papel coerente", () => {
    for (const chave of ACCESS_PRESET_KEYS) {
      expect(ACCESS_PRESET_DEFAULTS[chave], `${chave} sem defaults`).toBeTruthy();
      const perfil = findAccessProfileByKey(PERFIS, chave);
      expect(perfil.role).toBe(ACCESS_PRESET_DEFAULTS[chave].role);
    }
  });

  it("listAccessPresetKeys devolve copia, nao a lista viva", () => {
    const copia = listAccessPresetKeys();
    copia.push("nao_deveria_vazar");
    expect(ACCESS_PRESET_KEYS).not.toContain("nao_deveria_vazar");
  });
});

describe("o erro do validador diz o que foi rejeitado", () => {
  const fonte = readFileSync(resolve("src/domains/auth/routes.js"), "utf8");

  it('a mensagem crua "Unsupported access preset" saiu do CODIGO', () => {
    // Linha a linha, pulando comentario: explicar por que a frase saiu e
    // legitimo; usar como mensagem de erro, nao.
    const emCodigo = fonte
      .split("\n")
      .filter((linha) => {
        const t = linha.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .filter((linha) => linha.includes("Unsupported access preset"));
    expect(emCodigo, `ainda em codigo:\n${emCodigo.join("\n")}`).toEqual([]);
  });

  it("a mensagem carrega o valor recebido e a lista de aceitos", () => {
    expect(fonte).toContain("não existe. Aceitos:");
    expect(fonte).toContain("recebido: presetPedido");
  });

  it("o ajuste e logado em error e vai como aviso na resposta", () => {
    expect(fonte).toContain("preset de acesso AJUSTADO");
    expect(fonte).toContain("avisosDeAcesso");
    expect(fonte).toContain("avisos: avisosDeAcesso");
  });

  it("as DUAS rotas validam — PATCH de acesso e POST de criacao", () => {
    expect((fonte.match(/INVALID_ACCESS_PRESET/g) || []).length).toBe(2);
  });
});
