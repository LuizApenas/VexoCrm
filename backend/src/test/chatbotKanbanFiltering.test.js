import { describe, it, expect } from "vitest";

describe("Chatbot Kanban — Filtragem e Integridade de Status das Conversas", () => {
  it("leads sem conversa iniciada (status_conversa = null) não devem aparecer em nenhuma coluna do Kanban", () => {
    const rawDbRows = [
      {
        id: "lead-sem-msg-1",
        telefone: "553491111111",
        nome: "Lead Frio Importado",
        status_conversa: null,
        finalizado: false,
        dados: {},
      },
      {
        id: "lead-sem-msg-2",
        telefone: "553492222222",
        nome: "Outro Lead Sem Conversa",
        status_conversa: undefined,
        finalizado: false,
        dados: {},
      },
      {
        id: "lead-aguardando",
        telefone: "553493333333",
        nome: "Lead Que Recebeu Disparo",
        status_conversa: "aguardando_usuario",
        finalizado: false,
        dados: {},
      },
      {
        id: "lead-em-atendimento",
        telefone: "553494444444",
        nome: "Lead Que Respondeu",
        status_conversa: "em_atendimento",
        finalizado: false,
        dados: { interesse: "credito" },
      },
      {
        id: "lead-finalizado",
        telefone: "553495555555",
        nome: "Lead Qualificado Finalizado",
        status_conversa: "finalizado",
        finalizado: true,
        dados: { interesse: "credito", credito_faixa: "100k" },
      },
    ];

    // Simula a transformação aplicada no backend
    const filteredLeads = rawDbRows
      .filter((row) => row.status_conversa !== null && row.status_conversa !== undefined)
      .map((row) => ({
        id: row.id,
        telefone: row.telefone,
        nome: row.nome,
        statusConversa: row.status_conversa,
        finalizado: row.finalizado,
      }));

    // Verifica que leads sem conversa foram excluídos
    expect(filteredLeads.map((l) => l.id)).toEqual([
      "lead-aguardando",
      "lead-em-atendimento",
      "lead-finalizado",
    ]);

    // Separação das colunas do Kanban
    const aguardando = filteredLeads.filter((l) => l.statusConversa === "aguardando_usuario");
    const emAtendimento = filteredLeads.filter((l) => l.statusConversa === "em_atendimento");
    const finalizados = filteredLeads.filter((l) => l.statusConversa === "finalizado");

    expect(aguardando.length).toBe(1);
    expect(aguardando[0].id).toBe("lead-aguardando");

    expect(emAtendimento.length).toBe(1);
    expect(emAtendimento[0].id).toBe("lead-em-atendimento");

    expect(finalizados.length).toBe(1);
    expect(finalizados[0].id).toBe("lead-finalizado");
  });
});
