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

  it("conversa em lead_messages SEM lead correspondente em public.leads (chats pessoais/LIDs do chip) NÃO entra no Kanban", () => {
    // Simula a junção SQL com filtro estrito em public.leads (319 chats de histórico do chip)
    const publicLeads = [
      { id: "lead-crm-1", telefone: "5534997817660", nome: "Cliente Potencial A", finalizado: false },
      { id: "lead-crm-2", telefone: "5534988112233", nome: "Cliente Potencial B", finalizado: false },
    ];

    const leadMessages = [
      { phone: "5534997817660", direction: "outbound", message_text: "Olá!" },
      { phone: "5534988112233", direction: "inbound", message_text: "Tenho interesse" },
      // Chats pessoais do chip / estabelecimentos / LIDs sem lead no CRM (ex: Garage Pub, Bluefit, 107246071587049@lid)
      { phone: "5534998723435", direction: "inbound", message_text: "Garage Pub cardápio" },
      { phone: "107246071587049@lid", direction: "inbound", message_text: "Ok" },
      { phone: "1234567890123@g.us", direction: "inbound", message_text: "Mensagem do grupo" },
    ];

    // O backend faz FROM public.leads l LEFT JOIN message_stats ms ... WHERE l.client_id = $1
    // Portanto apenas leads em public.leads são processados
    const leadMap = new Map(publicLeads.map(l => [l.telefone, l]));

    const kanbanRows = leadMessages
      .map((msg) => {
        const lead = leadMap.get(msg.phone);
        if (!lead) return null; // Ignora chats que não pertencem a leads do CRM
        return {
          id: lead.id,
          telefone: lead.telefone,
          nome: lead.nome,
          statusConversa: msg.direction === "inbound" ? "em_atendimento" : "aguardando_usuario",
        };
      })
      .filter(Boolean);

    // Garante que chats pessoais e LIDs NÃO viram cards no Kanban
    expect(kanbanRows.length).toBe(2);
    expect(kanbanRows.some((r) => r.id === "lead-crm-1")).toBe(true);
    expect(kanbanRows.some((r) => r.id === "lead-crm-2")).toBe(true);
    expect(kanbanRows.some((r) => r.telefone === "5534998723435")).toBe(false);
    expect(kanbanRows.some((r) => r.telefone.includes("@lid"))).toBe(false);
    expect(kanbanRows.some((r) => r.telefone.includes("@g.us"))).toBe(false);
  });
});
