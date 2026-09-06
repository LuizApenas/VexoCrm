import { describe, expect, it } from "vitest";
import { buildDashboardPayload } from "../services/analytics.js";

describe("ITEM E: Dashboard e Campanhas com política permissiva para operadores", () => {
  const sampleLeads = [
    {
      id: "lead-1",
      nome: "Lead do Operador A 1",
      telefone: "5511999990001",
      tipo_cliente: "Comprador",
      status: "novo",
      stage: "open_budget",
      temperature: "hot",
      assigned_to: "op-a-uid",
      client_id: "geracao-digital",
      created_at: new Date().toISOString(),
    },
    {
      id: "lead-2",
      nome: "Lead do Operador A 2",
      telefone: "5511999990002",
      tipo_cliente: "Comprador",
      status: "aguardando_usuario",
      stage: "inquiry",
      temperature: "warm",
      assigned_to: "op-a-uid",
      client_id: "geracao-digital",
      created_at: new Date().toISOString(),
    },
    {
      id: "lead-3",
      nome: "Lead do Operador B 1",
      telefone: "5511999990003",
      tipo_cliente: "Investidor",
      status: "novo",
      stage: "open_budget",
      temperature: "hot",
      assigned_to: "op-b-uid",
      client_id: "geracao-digital",
      created_at: new Date().toISOString(),
    },
    {
      id: "lead-4-historico",
      nome: "Lead Histórico sem Operador",
      telefone: "5511999990004",
      tipo_cliente: "Comprador",
      status: "novo",
      stage: "inquiry",
      temperature: "cold",
      assigned_to: null, // Lead histórico
      client_id: "geracao-digital",
      created_at: new Date().toISOString(),
    },
  ];

  function filterLeadsForUser(leads, authAccess, query = {}) {
    const isInternalOperator =
      authAccess?.role === "internal" &&
      authAccess?.accessPreset === "operador";

    let targetAssignedTo = null;
    let operatorIdentifiers = null;

    if (isInternalOperator) {
      const uid = authAccess?.uid;
      const email = authAccess?.email;
      operatorIdentifiers = [uid, email].filter(Boolean);
    } else if (authAccess?.role !== "client") {
      targetAssignedTo = query.assigned_to || query.assignedTo || query.userId || null;
    }

    return leads.filter((lead) => {
      if (lead.client_id !== authAccess.clientId) return false;
      if (operatorIdentifiers && operatorIdentifiers.length > 0) {
        // Política: assigned_to = UID/email OR assigned_to IS NULL
        return operatorIdentifiers.includes(lead.assigned_to) || lead.assigned_to == null;
      }
      if (targetAssignedTo) {
        return lead.assigned_to === targetAssignedTo;
      }
      return true;
    });
  }

  function filterCampaignsForUser(campaigns, authAccess) {
    const isInternalOperator =
      authAccess?.role === "internal" &&
      authAccess?.accessPreset === "operador";

    if (!isInternalOperator) return campaigns;

    const uid = authAccess?.uid;
    const email = authAccess?.email;
    const operatorIdentifiers = [uid, email].filter(Boolean);

    return campaigns.filter((camp) => {
      if (operatorIdentifiers.length > 0) {
        return operatorIdentifiers.includes(camp.created_by_uid) || camp.created_by_uid == null;
      }
      return true;
    });
  }

  it("Operadores veem seus próprios leads E também os leads históricos (assigned_to IS NULL)", () => {
    const opA = {
      uid: "op-a-uid",
      email: "op-a@geracaodigital.com",
      role: "internal",
      accessPreset: "operador",
      clientId: "geracao-digital",
    };

    const opB = {
      uid: "op-b-uid",
      email: "op-b@geracaodigital.com",
      role: "internal",
      accessPreset: "operador",
      clientId: "geracao-digital",
    };

    // Operador A vê seus 2 leads + 1 histórico = 3
    const leadsA = filterLeadsForUser(sampleLeads, opA);
    expect(leadsA.length).toBe(3);
    expect(leadsA.map((l) => l.id)).toEqual(["lead-1", "lead-2", "lead-4-historico"]);

    // Operador B vê seu 1 lead + 1 histórico = 2
    const leadsB = filterLeadsForUser(sampleLeads, opB);
    expect(leadsB.length).toBe(2);
    expect(leadsB.map((l) => l.id)).toEqual(["lead-3", "lead-4-historico"]);

    const payloadA = buildDashboardPayload({ id: "geracao-digital", name: "GD" }, leadsA);
    const payloadB = buildDashboardPayload({ id: "geracao-digital", name: "GD" }, leadsB);

    expect(payloadA.summary.totalLeads).toBe(3);
    expect(payloadB.summary.totalLeads).toBe(2);
  });

  it("Gestor vê todos os leads por padrão, mas pode filtrar por operador", () => {
    const gestor = {
      uid: "gestor-uid",
      email: "gestor@geracaodigital.com",
      role: "internal",
      accessPreset: "gestor",
      clientId: "geracao-digital",
    };

    // Sem filtro: vê todos os 4 leads
    const allLeads = filterLeadsForUser(sampleLeads, gestor, {});
    expect(allLeads.length).toBe(4);

    // Filtrando operador A
    const filteredA = filterLeadsForUser(sampleLeads, gestor, { assigned_to: "op-a-uid" });
    expect(filteredA.length).toBe(2);

    // Filtrando operador B
    const filteredB = filterLeadsForUser(sampleLeads, gestor, { assigned_to: "op-b-uid" });
    expect(filteredB.length).toBe(1);
  });

  it("Cliente vê todos os leads do tenant dele sem filtro de operador", () => {
    const cliente = {
      uid: "client-uid",
      email: "cliente@geracaodigital.com",
      role: "client",
      accessPreset: "client_manager",
      clientId: "geracao-digital",
    };

    const clientLeads = filterLeadsForUser(sampleLeads, cliente, {});
    expect(clientLeads.length).toBe(4);
  });

  it("Campanhas: operador vê suas campanhas criadas E campanhas sem criador (created_by_uid IS NULL)", () => {
    const sampleCampaigns = [
      { id: "c1", name: "Campanha Op A", created_by_uid: "op-a-uid" },
      { id: "c2", name: "Campanha Op B", created_by_uid: "op-b-uid" },
      { id: "c3", name: "Campanha Legada Geral", created_by_uid: null },
    ];

    const opA = {
      uid: "op-a-uid",
      role: "internal",
      accessPreset: "operador",
      clientId: "geracao-digital",
    };

    const gestor = {
      uid: "gestor-uid",
      role: "internal",
      accessPreset: "gestor",
      clientId: "geracao-digital",
    };

    const campsA = filterCampaignsForUser(sampleCampaigns, opA);
    expect(campsA.length).toBe(2);
    expect(campsA.map((c) => c.id)).toEqual(["c1", "c3"]);

    const campsGestor = filterCampaignsForUser(sampleCampaigns, gestor);
    expect(campsGestor.length).toBe(3);
  });
});
