// Tela branca nas telas com card de upsell.
//
// Evidencia (2026-08-17): /crm/relatorios com o modulo NAO contratado renderizava
// tela branca, com "Uncaught Error: Minified React error #300" no console.
//
// Causa: o gate estava como return antecipado ANTES dos hooks. Na primeira
// renderizacao a lista de tenants ainda nao chegou, activeTenant e undefined,
// hasFeatureUnlocked devolve true e todos os hooks rodam. Quando a lista chega e
// o modulo nao esta contratado, o return antecipado deixa de chamar os cinco
// useMemo seguintes: React ve menos hooks do que antes e derruba a arvore.
//
// Por isso o teste renderiza no estado LIBERADO e so depois vira para BLOQUEADO —
// e a transicao que quebra. Um teste que so renderiza bloqueado desde o inicio
// passa mesmo com o bug.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { render, screen } from "@testing-library/react";

let tenants: any[] = [];

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ clientId: "teste-modular" }),
}));
const crmClientFake = () => ({
  selectedClientId: "teste-modular",
  selectedClient: tenants[0] ?? null,
  clients: tenants,
  isLoading: false,
  setSelectedClientId: () => {},
});
vi.mock("@/hooks/useCrmClient", () => ({
  useCrmClient: () => crmClientFake(),
  useOptionalCrmClient: () => crmClientFake(),
}));
vi.mock("@/hooks/useLeadClients", () => ({
  useLeadClients: () => ({ data: tenants }),
}));
vi.mock("@/hooks/useReports", () => ({
  useEvolutionUsageReport: () => ({ data: { items: [] }, isLoading: false, error: null }),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
// O PageShell arrasta o widget de suporte, que quer um QueryClient. Fora do
// assunto do teste.
vi.mock("@/components/HelpDeskWidget", () => ({ HelpDeskWidget: () => null, default: () => null }));

const TENANT_MODULAR_SEM_RELATORIOS = {
  id: "teste-modular",
  plan_tier: "modular",
  modulos_avulsos: ["disparador_campanhas"],
  n8n_settings: { evolution_instances: [] },
};

describe("Relatorios com o modulo bloqueado nao derruba a tela", () => {
  let erros: string[] = [];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tenants = [];
    erros = [];
    spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      erros.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("sobrevive a transicao liberado -> bloqueado, que e o caso que quebrava", async () => {
    const { default: Relatorios } = await import("@/pages/Relatorios");

    // 1o render: tenants ainda carregando, entao a tela vem liberada.
    const { rerender } = render(<Relatorios />);

    // 2o render: a lista chega e o tenant NAO tem o modulo. Com o gate antes dos
    // hooks, e aqui que React derrubava tudo por contagem de hooks menor.
    // Array NOVO: o useMemo depende da identidade de `tenants`; mutar em
    // lugar nao dispara recalculo e o teste passaria com o bug em pe.
    tenants = [TENANT_MODULAR_SEM_RELATORIOS];
    rerender(<Relatorios />);

    expect(screen.getByText(/Módulo Não Contratado no Plano Modular/i)).toBeTruthy();

    const errosDeHook = erros.filter((linha) => /Rendered fewer hooks|error #300|hooks than/i.test(linha));
    expect(errosDeHook, `console.error com erro de hooks:\n${errosDeHook.join("\n")}`).toEqual([]);
  });

  it("com o modulo contratado a tela continua abrindo normal", async () => {
    const { default: Relatorios } = await import("@/pages/Relatorios");
    tenants = [{ ...TENANT_MODULAR_SEM_RELATORIOS, modulos_avulsos: ["relatorios"] }];

    render(<Relatorios />);

    expect(screen.queryByText(/Módulo Não Contratado no Plano Modular/i)).toBeNull();
  });
});

// O render acima cobre Relatorios. Este bloco cobre a REGRA nas cinco telas de
// uma vez, e e o que impede a proxima tela de nascer com o mesmo defeito: em
// nenhuma delas pode haver chamada de hook depois do return do card de upsell.
describe("nenhuma tela com card de upsell chama hook depois do gate", () => {
  const dirPaginas = resolve(__dirname, "../pages");

  function arquivosComUpsell(): string[] {
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const caminho = resolve(dir, entrada.name);
        if (entrada.isDirectory()) varrer(caminho);
        else if (entrada.name.endsWith(".tsx") && readFileSync(caminho, "utf8").includes("<UpsellCard")) {
          achados.push(caminho);
        }
      }
    };
    varrer(dirPaginas);
    return achados;
  }

  const telas = arquivosComUpsell();

  it("a varredura encontrou telas (guarda contra teste vazio que passa a toa)", () => {
    expect(telas.length).toBeGreaterThanOrEqual(5);
  });

  it.each(telas)("%s", (caminho) => {
    const linhas = readFileSync(caminho, "utf8").split("\n");

    // Ultimo return de gate: linha `if (!...Unlocked) {` — o padrao que as cinco usam.
    let ultimoGate = -1;
    linhas.forEach((linha, i) => {
      if (/^\s*if\s*\(\s*!\s*is\w*Unlocked\s*\)/.test(linha)) ultimoGate = i;
    });
    if (ultimoGate === -1) return; // tela sem gate desse formato

    const depoisDoGate = linhas
      .slice(ultimoGate)
      .map((linha, i) => ({ n: ultimoGate + i + 1, linha }))
      .filter(({ linha }) => /^\s*(const|let|var)?\s*[\w{},:\s]*=?\s*use[A-Z]\w*\s*\(/.test(linha));

    expect(
      depoisDoGate.map(({ n, linha }) => `${n}: ${linha.trim()}`),
      `${caminho}: hook chamado depois do gate de upsell — e assim que nasce o React error #300`
    ).toEqual([]);
  });
});
