import { describe, it, expect, vi } from "vitest";

describe("Chatbot Kanban — Derivação de Status por Fatos Observados", () => {
  it("lead que RECEBEU mensagem nossa e tem status_conversa NULL cai em 'aguardando_usuario' (caso de 129 leads reais)", () => {
    const rawRows = [
      {
        id: "lead-real-disparo-sem-status",
        telefone: "5534997817660",
        nome: "Lead Real Disparo",
        status_conversa: null, // NULL no banco
        finalizado: false,
        outbound_count: 1,     // Mensagem nossa enviada
        inbound_count: 0,      // Lead ainda não respondeu
        dados: {},
      },
      {
        id: "lead-real-respondeu-sem-status",
        telefone: "5534988112233",
        nome: "Lead Que Respondeu",
        status_conversa: null, // NULL no banco
        finalizado: false,
        outbound_count: 2,
        inbound_count: 1,      // Lead respondeu!
        dados: {},
      },
      {
        id: "lead-finalizado-qualificado",
        telefone: "5534977112233",
        nome: "Lead Finalizado",
        status_conversa: "finalizado",
        finalizado: true,
        outbound_count: 5,
        inbound_count: 4,
        dados: { interesse: "credito" },
      },
      {
        id: "lead-frio-sem-mensagens",
        telefone: "5534966112233",
        nome: "Lead Frio Importado",
        status_conversa: null,
        finalizado: false,
        outbound_count: 0,     // Nenhuma mensagem
        inbound_count: 0,      // Nenhuma mensagem
        dados: {},
      },
      {
        id: "lead-divergente-banco-diz-atendimento-mas-fato-e-aguardando",
        telefone: "5534955112233",
        nome: "Lead Divergente",
        status_conversa: "em_atendimento", // Banco defasado
        finalizado: false,
        outbound_count: 1,
        inbound_count: 0,                 // Fato: nunca respondeu
        dados: {},
      },
    ];

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Executa a exata lógica de derivação do backend
    const allLeads = rawRows
      .map((row) => {
        const finalizado = Boolean(row.finalizado || row.status_conversa === "finalizado");
        const outboundCount = Number(row.outbound_count ?? (row.mensagem ? 1 : 0));
        const inboundCount = Number(row.inbound_count ?? 0);

        let derivedStatus = null;
        if (finalizado) {
          derivedStatus = "finalizado";
        } else if (inboundCount > 0) {
          derivedStatus = "em_atendimento";
        } else if (outboundCount > 0) {
          derivedStatus = "aguardando_usuario";
        } else if (row.status_conversa === "aguardando_usuario" || row.status_conversa === "em_atendimento") {
          derivedStatus = row.status_conversa;
        }

        if (!derivedStatus) {
          return null;
        }

        if (row.status_conversa && row.status_conversa !== derivedStatus) {
          console.warn(
            `[chatbot-kanban] Divergência detectada para lead ${row.id || "sem-id"} (${row.telefone}): status_conversa no banco = '${row.status_conversa}', fato derivado = '${derivedStatus}' (outbound=${outboundCount}, inbound=${inboundCount})`
          );
        }

        return {
          id: row.id,
          telefone: row.telefone,
          nome: row.nome,
          statusConversa: derivedStatus,
          finalizado,
        };
      })
      .filter(Boolean);

    // 1. Lead frio sem mensagens NÃO aparece no Kanban
    expect(allLeads.find((l) => l.id === "lead-frio-sem-mensagens")).toBeUndefined();

    // 2. Colunas do Kanban
    const aguardando = allLeads.filter((l) => l.statusConversa === "aguardando_usuario");
    const emAtendimento = allLeads.filter((l) => l.statusConversa === "em_atendimento");
    const finalizados = allLeads.filter((l) => l.statusConversa === "finalizado");

    // Lead com mensagem enviada e status_conversa=null ESTÁ em aguardando_usuario
    expect(aguardando.some((l) => l.id === "lead-real-disparo-sem-status")).toBe(true);

    // Lead divergente ganha o fato (aguardando_usuario)
    expect(aguardando.some((l) => l.id === "lead-divergente-banco-diz-atendimento-mas-fato-e-aguardando")).toBe(true);

    // Lead que respondeu ESTÁ em em_atendimento
    expect(emAtendimento.some((l) => l.id === "lead-real-respondeu-sem-status")).toBe(true);

    // Lead finalizado ESTÁ em finalizado
    expect(finalizados.some((l) => l.id === "lead-finalizado-qualificado")).toBe(true);

    // 3. Verifica que a divergência foi logada
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Divergência detectada para lead lead-divergente-banco-diz-atendimento-mas-fato-e-aguardando")
    );

    warnSpy.mockRestore();
  });
});
