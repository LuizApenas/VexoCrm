const DEFAULT_SETTINGS = {
  qualificationThreshold: 60,
  slaMinutes: 30,
  defaultPeriod: "30d",
  distributionStrategy: "round_robin",
  rankingRules: {
    cities: "qualificationRate",
    campaigns: "qualifiedLeads",
    consultants: "conversionRate",
  },
  metricRules: {
    qualificationStatus: ["qualificado", "qualificados", "em_qualificacao"],
  },
  alertRules: {
    lowResponseRate: 15,
    lowConversionRate: 10,
    highQualificationDelayHours: 24,
    consultantBelowAverageFactor: 0.7,
  },
  permissions: {
    canEditSettings: true,
    canManageConsultants: true,
    canManageDistribution: true,
  },
};

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function sanitizePhone(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  let digits = normalized.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    const national = digits.slice(2);
    if (national.length === 10) {
      return `55${national}`;
    }
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits;
  }
  return digits;
}

function safePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function average(values) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function hoursBetween(start, end) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return (endDate.getTime() - startDate.getTime()) / 36e5;
}

function normalizeWonStatus(value) {
  const normalized = normalizeString(value)?.toLowerCase();
  return normalized === "won" || normalized === "closed_won" || normalized === "convertido" || normalized === "converted";
}

function isQualifiedStatus(value) {
  const normalized = normalizeString(value)?.toLowerCase();
  return normalized === "qualificado" || normalized === "qualificados" || normalized === "em_qualificacao";
}

function detectTemperature(lead) {
  const source = normalizeString(lead.qualificacao)?.toLowerCase() || "";
  if (source.includes("quente")) return "hot";
  if (source.includes("morno")) return "warm";
  if (source.includes("frio")) return "cold";
  return "unknown";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatMetricValue(value, kind = "number") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (kind === "percent") return `${Number(value).toFixed(1)}%`;
  if (kind === "currency") return formatCurrency(value);
  if (kind === "hours") return `${Number(value).toFixed(1)}h`;
  if (kind === "ratio") return Number(value).toFixed(2);
  return String(value);
}

function getRangeDays(period) {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  if (period === "90d") return 90;
  if (period === "180d") return 180;
  return null;
}

function getDateRange(period = "30d") {
  const now = new Date();
  const days = getRangeDays(period);
  if (!days) {
    return {
      period,
      since: null,
      until: now,
      previousSince: null,
      previousUntil: null,
      chartSince: new Date(now.getTime() - 29 * 86400000),
    };
  }

  const since = new Date(now.getTime() - (days - 1) * 86400000);
  const previousUntil = new Date(since.getTime() - 86400000);
  const previousSince = new Date(previousUntil.getTime() - (days - 1) * 86400000);

  return {
    period,
    since,
    until: now,
    previousSince,
    previousUntil,
    chartSince: since,
  };
}

function isWithinRange(dateValue, since, until) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  if (since && date < since) return false;
  if (until && date > until) return false;
  return true;
}

function getLeadDate(lead) {
  return lead.data_hora || lead.created_at || lead.updated_at || null;
}

function getDateKey(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function startCaseStatus(value) {
  const normalized = normalizeString(value);
  if (!normalized) return "Sem status";
  return normalized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mergeSettings(storedSettings) {
  const source = storedSettings || {};
  return {
    qualificationThreshold: Number(source.qualification_threshold ?? DEFAULT_SETTINGS.qualificationThreshold),
    slaMinutes: Number(source.sla_minutes ?? DEFAULT_SETTINGS.slaMinutes),
    defaultPeriod: normalizeString(source.default_period) || DEFAULT_SETTINGS.defaultPeriod,
    distributionStrategy: normalizeString(source.distribution_strategy) || DEFAULT_SETTINGS.distributionStrategy,
    rankingRules: { ...DEFAULT_SETTINGS.rankingRules, ...(source.ranking_rules || {}) },
    metricRules: { ...DEFAULT_SETTINGS.metricRules, ...(source.metric_rules || {}) },
    alertRules: { ...DEFAULT_SETTINGS.alertRules, ...(source.alert_rules || {}) },
    permissions: { ...DEFAULT_SETTINGS.permissions, ...(source.permissions || {}) },
  };
}

function summarizeLeadForPreview(lead) {
  return {
    id: lead.id,
    nome: lead.nome || "Sem nome",
    telefone: lead.telefone || "—",
    cidade: lead.cidade || "—",
    estado: lead.estado || "—",
    status: startCaseStatus(lead.status),
    qualificacao: lead.qualificacao || "—",
    createdAt: lead.created_at || null,
  };
}

function computeLeadScore(lead, respondedPhones) {
  const base = Number(lead.lead_score || 0);
  if (base) return base;
  const temperature = detectTemperature(lead);
  const temperatureBoost = temperature === "hot" ? 35 : temperature === "warm" ? 20 : temperature === "cold" ? 8 : 0;
  const responseBoost = lead.telefone && respondedPhones.has(lead.telefone) ? 15 : 0;
  const statusBoost = isQualifiedStatus(lead.status) ? 25 : 0;
  return temperatureBoost + responseBoost + statusBoost;
}

function buildInsight({
  id = null,
  title,
  message,
  severity = "info",
  impact = "Moderado",
  recommendation,
  actionLabel,
  actionType,
  actionTargetId = null,
  actionTargetName = null,
  scope = "dashboard",
  generatedAt = null,
}) {
  return {
    id,
    title,
    message,
    severity,
    impact,
    recommendation,
    actionLabel,
    actionType,
    actionTargetId,
    actionTargetName,
    scope,
    generatedAt,
  };
}

function createMetricRow({
  key,
  name,
  current,
  previous,
  kind,
  target = null,
  accent = "cyan",
}) {
  const delta = previous === null || previous === undefined ? null : Number((current - previous).toFixed(1));
  return {
    key,
    name,
    current,
    previous,
    delta,
    direction: delta === null ? "stable" : delta > 0 ? "up" : delta < 0 ? "down" : "stable",
    kind,
    accent,
    target,
    currentLabel: formatMetricValue(current, kind),
    previousLabel: formatMetricValue(previous, kind),
    deltaLabel: delta === null ? "—" : `${delta > 0 ? "+" : ""}${formatMetricValue(delta, kind)}`,
  };
}

function buildStats({ leads, respondedPhones, conversationCounts, messageStatsByPhone, conversions, assignmentByLeadId }) {
  const addressedLeads = leads.filter((lead) => {
    const phone = lead.telefone;
    return Boolean(
      lead.bot_ativo ||
      normalizeString(lead.status) ||
      normalizeString(lead.historico) ||
      (phone && conversationCounts.has(phone)) ||
      (phone && messageStatsByPhone.has(phone))
    );
  });

  const qualifiedLeads = leads.filter((lead) =>
    isQualifiedStatus(lead.status) || (normalizeString(lead.qualificacao)?.toLowerCase() || "").includes("qualific")
  );

  const convertedLeadIds = new Set(
    conversions
      .filter((item) => normalizeWonStatus(item.conversion_status))
      .map((item) => item.lead_id)
      .filter(Boolean)
  );

  const qualifiedDurations = qualifiedLeads
    .map((lead) => hoursBetween(lead.first_contact_at || getLeadDate(lead), lead.qualified_at || lead.updated_at))
    .filter((value) => typeof value === "number" && value >= 0);

  const closingDurations = leads
    .filter((lead) => convertedLeadIds.has(lead.id))
    .map((lead) => {
      const conversion = conversions.find((item) => item.lead_id === lead.id && normalizeWonStatus(item.conversion_status)) || null;
      return hoursBetween(
        conversion?.first_contact_at || lead.first_contact_at || getLeadDate(lead),
        conversion?.closed_at || lead.closed_at || lead.updated_at
      );
    })
    .filter((value) => typeof value === "number" && value >= 0);

  const respondedLeads = addressedLeads.filter((lead) => lead.telefone && respondedPhones.has(lead.telefone));
  const convertedLeads = leads.filter((lead) => convertedLeadIds.has(lead.id));
  const totalInteractions = leads.reduce((sum, lead) => {
    const phone = lead.telefone;
    const stats = phone ? messageStatsByPhone.get(phone) : null;
    if (stats) return sum + stats.total;
    return sum + (phone ? conversationCounts.get(phone) || 0 : 0);
  }, 0);

  const reactivatedCount = leads.filter((lead) => {
    const phone = lead.telefone;
    const stats = phone ? messageStatsByPhone.get(phone) : null;
    return Boolean(stats && stats.outbound > 1 && stats.inbound > 0);
  }).length;

  const revenue = conversions
    .filter((item) => normalizeWonStatus(item.conversion_status))
    .reduce((sum, item) => sum + Number(item.revenue_amount || item.contract_value || 0), 0);

  const receivedAssignments = leads.filter((lead) => assignmentByLeadId.has(lead.id)).length;

  return {
    totalLeads: leads.length,
    addressedLeads: addressedLeads.length,
    respondedLeads: respondedLeads.length,
    qualifiedLeads: qualifiedLeads.length,
    convertedLeads: convertedLeads.length,
    revenue,
    totalInteractions,
    responseRate: safePercent(respondedLeads.length, addressedLeads.length),
    qualificationRate: safePercent(qualifiedLeads.length, addressedLeads.length),
    finalConversionRate: safePercent(convertedLeads.length, leads.length),
    interactionsPerQualifiedLead: qualifiedLeads.length ? Number((totalInteractions / qualifiedLeads.length).toFixed(2)) : null,
    interactionsPerClosing: convertedLeads.length ? Number((totalInteractions / convertedLeads.length).toFixed(2)) : null,
    avgTimeToQualification: average(qualifiedDurations),
    avgTimeToClosing: average(closingDurations),
    abandonmentRate: safePercent(addressedLeads.length - respondedLeads.length, addressedLeads.length),
    reactivationRate: safePercent(reactivatedCount, addressedLeads.length),
    baseQualityRate: safePercent(respondedLeads.length, addressedLeads.length),
    closings: convertedLeads.length,
    receivedAssignments,
  };
}

export function getCommercialIntelligenceDefaultSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}

export function buildCommercialIntelligencePayload({
  client,
  filters,
  leads,
  campaigns,
  leadImportItems,
  conversations,
  messages,
  assignments,
  conversions,
  consultants,
  rules,
  storedInsights,
  settings,
}) {
  const mergedSettings = mergeSettings(settings);
  const range = getDateRange(filters.period || mergedSettings.defaultPeriod);
  const allLeads = (leads || []).map((lead) => ({ ...lead, telefone: sanitizePhone(lead.telefone) }));
  const leadById = new Map(allLeads.map((lead) => [lead.id, lead]));
  const allCampaigns = campaigns || [];
  const allAssignments = assignments || [];
  const allConversions = conversions || [];
  const allConsultants = consultants || [];
  const allRules = rules || [];
  const allMessages = messages || [];
  const allConversations = conversations || [];

  const importPhonesByImportId = new Map();
  for (const item of leadImportItems || []) {
    if (!item.import_id) continue;
    const phone = sanitizePhone(item.telefone);
    if (!phone) continue;
    const current = importPhonesByImportId.get(item.import_id) || [];
    current.push(phone);
    importPhonesByImportId.set(item.import_id, current);
  }

  const campaignById = new Map(allCampaigns.map((campaign) => [campaign.id, campaign]));
  const consultantById = new Map(allConsultants.map((consultant) => [consultant.id, consultant]));

  const leadCampaignIdByLeadId = new Map();
  const leadIdsByCampaignId = new Map();
  for (const campaign of allCampaigns) {
    const explicitPhones = Array.isArray(campaign.phones)
      ? campaign.phones.map((phone) => sanitizePhone(phone)).filter(Boolean)
      : [];
    const importPhones = campaign.import_id ? importPhonesByImportId.get(campaign.import_id) || [] : [];
    const campaignPhones = new Set([...explicitPhones, ...importPhones]);
    const leadIds = [];

    for (const lead of allLeads) {
      if (lead.source_campaign_id && lead.source_campaign_id === campaign.id) {
        leadCampaignIdByLeadId.set(lead.id, campaign.id);
      } else if (lead.telefone && campaignPhones.has(lead.telefone)) {
        leadCampaignIdByLeadId.set(lead.id, campaign.id);
      }

      if (leadCampaignIdByLeadId.get(lead.id) === campaign.id) {
        leadIds.push(lead.id);
      }
    }

    leadIdsByCampaignId.set(campaign.id, leadIds);
  }

  const conversationCounts = new Map();
  for (const item of allConversations) {
    const phone = sanitizePhone(item.telefone);
    if (!phone) continue;
    conversationCounts.set(phone, (conversationCounts.get(phone) || 0) + 1);
  }

  const messageStatsByPhone = new Map();
  for (const item of allMessages) {
    const phone = sanitizePhone(item.phone) || leadById.get(item.lead_id)?.telefone || null;
    if (!phone) continue;
    const current = messageStatsByPhone.get(phone) || {
      total: 0,
      inbound: 0,
      outbound: 0,
      engaged: 0,
      lastInboundAt: null,
      firstOutboundAt: null,
    };
    current.total += 1;
    if (item.direction === "inbound" || item.sender_type === "lead") {
      current.inbound += 1;
      if (!current.lastInboundAt || new Date(item.created_at) > new Date(current.lastInboundAt)) {
        current.lastInboundAt = item.created_at;
      }
    } else {
      current.outbound += 1;
      if (!current.firstOutboundAt || new Date(item.created_at) < new Date(current.firstOutboundAt)) {
        current.firstOutboundAt = item.created_at;
      }
    }
    if (item.engagement_signal === "reply" || item.engagement_signal === "clicked" || item.direction === "inbound") {
      current.engaged += 1;
    }
    messageStatsByPhone.set(phone, current);
  }

  const respondedPhones = new Set(
    [...messageStatsByPhone.entries()]
      .filter(([, stats]) => stats.inbound > 0 || stats.engaged > 0)
      .map(([phone]) => phone)
  );

  const latestAssignmentByLeadId = new Map();
  for (const assignment of [...allAssignments].sort((a, b) => new Date(b.assigned_at || 0) - new Date(a.assigned_at || 0))) {
    if (assignment.lead_id && !latestAssignmentByLeadId.has(assignment.lead_id)) {
      latestAssignmentByLeadId.set(assignment.lead_id, assignment);
    }
  }

  const consultantIdsByLeadId = new Map();
  for (const assignment of allAssignments) {
    if (assignment.lead_id && assignment.consultant_id) {
      consultantIdsByLeadId.set(assignment.lead_id, assignment.consultant_id);
    }
  }
  for (const conversion of allConversions) {
    if (conversion.lead_id && conversion.consultant_id && !consultantIdsByLeadId.has(conversion.lead_id)) {
      consultantIdsByLeadId.set(conversion.lead_id, conversion.consultant_id);
    }
  }

  const filteredLeads = allLeads.filter((lead) => {
    const leadDate = getLeadDate(lead);
    const campaignId = leadCampaignIdByLeadId.get(lead.id) || lead.source_campaign_id || null;
    const consultantId = consultantIdsByLeadId.get(lead.id) || null;
    const city = normalizeString(lead.cidade);
    const status = normalizeString(lead.status);

    if (filters.period !== "all" && !isWithinRange(leadDate, range.since, range.until)) return false;
    if (filters.campaignId && campaignId !== filters.campaignId) return false;
    if (filters.city && city !== filters.city) return false;
    if (filters.status && status !== filters.status) return false;
    if (filters.consultantId && consultantId !== filters.consultantId) return false;
    return true;
  });

  const previousPeriodLeads = allLeads.filter((lead) => {
    const leadDate = getLeadDate(lead);
    const campaignId = leadCampaignIdByLeadId.get(lead.id) || lead.source_campaign_id || null;
    const consultantId = consultantIdsByLeadId.get(lead.id) || null;
    const city = normalizeString(lead.cidade);
    const status = normalizeString(lead.status);

    if (!range.previousSince || !range.previousUntil) return false;
    if (!isWithinRange(leadDate, range.previousSince, range.previousUntil)) return false;
    if (filters.campaignId && campaignId !== filters.campaignId) return false;
    if (filters.city && city !== filters.city) return false;
    if (filters.status && status !== filters.status) return false;
    if (filters.consultantId && consultantId !== filters.consultantId) return false;
    return true;
  });

  const filteredLeadIds = new Set(filteredLeads.map((lead) => lead.id));
  const filteredConversions = allConversions.filter((item) => filteredLeadIds.has(item.lead_id));
  const previousLeadIds = new Set(previousPeriodLeads.map((lead) => lead.id));
  const previousConversions = allConversions.filter((item) => previousLeadIds.has(item.lead_id));

  const currentStats = buildStats({
    leads: filteredLeads,
    respondedPhones,
    conversationCounts,
    messageStatsByPhone,
    conversions: filteredConversions,
    assignmentByLeadId: latestAssignmentByLeadId,
  });
  const previousStats = buildStats({
    leads: previousPeriodLeads,
    respondedPhones,
    conversationCounts,
    messageStatsByPhone,
    conversions: previousConversions,
    assignmentByLeadId: latestAssignmentByLeadId,
  });

  const metricRows = [
    createMetricRow({ key: "qualificationRate", name: "Taxa de qualificação", current: currentStats.qualificationRate, previous: previousStats.qualificationRate, kind: "percent", accent: "cyan" }),
    createMetricRow({ key: "responseRate", name: "Taxa de resposta", current: currentStats.responseRate, previous: previousStats.responseRate, kind: "percent", accent: "teal" }),
    createMetricRow({ key: "interactionsPerQualifiedLead", name: "Conversas por lead qualificado", current: currentStats.interactionsPerQualifiedLead, previous: previousStats.interactionsPerQualifiedLead, kind: "ratio", accent: "violet" }),
    createMetricRow({ key: "interactionsPerClosing", name: "Conversas por fechamento", current: currentStats.interactionsPerClosing, previous: previousStats.interactionsPerClosing, kind: "ratio", accent: "pink" }),
    createMetricRow({ key: "finalConversionRate", name: "Taxa de conversão final", current: currentStats.finalConversionRate, previous: previousStats.finalConversionRate, kind: "percent", accent: "amber" }),
    createMetricRow({ key: "avgTimeToQualification", name: "Tempo médio até qualificação", current: currentStats.avgTimeToQualification, previous: previousStats.avgTimeToQualification, kind: "hours", accent: "cyan" }),
    createMetricRow({ key: "avgTimeToClosing", name: "Tempo médio até fechamento", current: currentStats.avgTimeToClosing, previous: previousStats.avgTimeToClosing, kind: "hours", accent: "violet" }),
    createMetricRow({ key: "abandonmentRate", name: "Taxa de abandono", current: currentStats.abandonmentRate, previous: previousStats.abandonmentRate, kind: "percent", accent: "rose" }),
    createMetricRow({ key: "reactivationRate", name: "Taxa de reativação", current: currentStats.reactivationRate, previous: previousStats.reactivationRate, kind: "percent", accent: "teal" }),
    createMetricRow({ key: "baseQualityRate", name: "Qualidade da base", current: currentStats.baseQualityRate, previous: previousStats.baseQualityRate, kind: "percent", accent: "slate" }),
  ];

  const chartDays = [];
  const chartSince = range.chartSince || new Date(Date.now() - 29 * 86400000);
  const chartUntil = range.until || new Date();
  for (let cursor = new Date(chartSince); cursor <= chartUntil; cursor = new Date(cursor.getTime() + 86400000)) {
    chartDays.push(cursor.toISOString().slice(0, 10));
  }

  const lineQualifiedMap = new Map(chartDays.map((key) => [key, { date: key, qualificados: 0, respondidos: 0, fechamentos: 0 }]));
  for (const lead of filteredLeads) {
    const key = getDateKey(getLeadDate(lead));
    if (!key || !lineQualifiedMap.has(key)) continue;
    const row = lineQualifiedMap.get(key);
    if (isQualifiedStatus(lead.status) || (normalizeString(lead.qualificacao)?.toLowerCase() || "").includes("qualific")) row.qualificados += 1;
    if (lead.telefone && respondedPhones.has(lead.telefone)) row.respondidos += 1;
    if (filteredConversions.some((item) => item.lead_id === lead.id && normalizeWonStatus(item.conversion_status))) row.fechamentos += 1;
  }

  const statusMap = new Map();
  const cityMap = new Map();
  const consultantPerformanceMap = new Map();
  for (const lead of filteredLeads) {
    const status = startCaseStatus(lead.status);
    statusMap.set(status, (statusMap.get(status) || 0) + 1);

    const city = normalizeString(lead.cidade) || "Sem cidade";
    const currentCity = cityMap.get(city) || { city, leads: 0, qualified: 0, converted: 0, revenue: 0 };
    currentCity.leads += 1;
    if (isQualifiedStatus(lead.status) || (normalizeString(lead.qualificacao)?.toLowerCase() || "").includes("qualific")) currentCity.qualified += 1;
    const conversion = filteredConversions.find((item) => item.lead_id === lead.id && normalizeWonStatus(item.conversion_status));
    if (conversion) {
      currentCity.converted += 1;
      currentCity.revenue += Number(conversion.revenue_amount || conversion.contract_value || 0);
    }
    cityMap.set(city, currentCity);

    const consultantId = consultantIdsByLeadId.get(lead.id);
    if (consultantId) {
      const consultant = consultantById.get(consultantId);
      const key = consultantId;
      const currentConsultant = consultantPerformanceMap.get(key) || {
        consultantId,
        consultantName: consultant?.name || "Sem consultor",
        leadsReceived: 0,
        responded: 0,
        converted: 0,
        revenue: 0,
      };
      currentConsultant.leadsReceived += 1;
      if (lead.telefone && respondedPhones.has(lead.telefone)) currentConsultant.responded += 1;
      if (conversion) {
        currentConsultant.converted += 1;
        currentConsultant.revenue += Number(conversion.revenue_amount || conversion.contract_value || 0);
      }
      consultantPerformanceMap.set(key, currentConsultant);
    }
  }

  const cityRanking = [...cityMap.values()].map((item) => ({
    id: item.city,
    name: item.city,
    qualificationRate: safePercent(item.qualified, item.leads),
    conversionRate: safePercent(item.converted, item.leads),
    volumeLeads: item.leads,
    revenue: item.revenue,
    avgCloseHours: average(
      filteredConversions
        .filter((conversion) => {
          const lead = leadById.get(conversion.lead_id);
          return (normalizeString(lead?.cidade) || "Sem cidade") === item.city;
        })
        .map((conversion) => hoursBetween(conversion.first_contact_at, conversion.closed_at))
        .filter((value) => typeof value === "number" && value >= 0)
    ),
  }));

  const campaignPerformance = allCampaigns
    .filter((campaign) => !filters.campaignId || campaign.id === filters.campaignId)
    .map((campaign) => {
      const campaignLeadIds = new Set(leadIdsByCampaignId.get(campaign.id) || []);
      const campaignLeads = filteredLeads.filter((lead) => campaignLeadIds.has(lead.id));
      const approached = campaignLeads.filter((lead) => Boolean(lead.bot_ativo || normalizeString(lead.status) || (lead.telefone && (respondedPhones.has(lead.telefone) || conversationCounts.has(lead.telefone)))));
      const responded = campaignLeads.filter((lead) => lead.telefone && respondedPhones.has(lead.telefone));
      const qualified = campaignLeads.filter((lead) => isQualifiedStatus(lead.status) || (normalizeString(lead.qualificacao)?.toLowerCase() || "").includes("qualific"));
      const conversionsForCampaign = filteredConversions.filter((item) => item.campaign_id === campaign.id && normalizeWonStatus(item.conversion_status));
      const revenue = conversionsForCampaign.reduce((sum, item) => sum + Number(item.revenue_amount || item.contract_value || 0), 0);
      const cost = Number(campaign.budget_amount || campaign.analytics_meta?.cost || 0);
      const cplq = qualified.length ? cost / qualified.length : null;
      const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : null;

      const topCities = [...new Set(campaignLeads.map((lead) => normalizeString(lead.cidade)).filter(Boolean))]
        .slice(0, 5)
        .map((city) => ({
          city,
          qualificationRate: safePercent(
            campaignLeads.filter((lead) => normalizeString(lead.cidade) === city && (isQualifiedStatus(lead.status) || (normalizeString(lead.qualificacao)?.toLowerCase() || "").includes("qualific"))).length,
            campaignLeads.filter((lead) => normalizeString(lead.cidade) === city).length
          ),
        }));

      const topConsultants = [...consultantPerformanceMap.values()]
        .filter((item) =>
          campaignLeads.some((lead) => consultantIdsByLeadId.get(lead.id) === item.consultantId)
        )
        .sort((a, b) => b.converted - a.converted)
        .slice(0, 5)
        .map((item) => ({
          consultantId: item.consultantId,
          consultantName: item.consultantName,
          converted: item.converted,
          revenue: item.revenue,
        }));

      const dailyTrendMap = new Map(chartDays.map((key) => [key, { date: key, qualificados: 0, fechamentos: 0 }]));
      for (const lead of campaignLeads) {
        const key = getDateKey(getLeadDate(lead));
        if (!key || !dailyTrendMap.has(key)) continue;
        const row = dailyTrendMap.get(key);
        if (isQualifiedStatus(lead.status) || (normalizeString(lead.qualificacao)?.toLowerCase() || "").includes("qualific")) row.qualificados += 1;
        if (conversionsForCampaign.some((item) => item.lead_id === lead.id && normalizeWonStatus(item.conversion_status))) row.fechamentos += 1;
      }

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status || "active",
        period: filters.period,
        leadsImported: campaignLeadIds.size,
        leadsApproached: approached.length,
        leadsResponded: responded.length,
        leadsQualified: qualified.length,
        responseRate: safePercent(responded.length, approached.length),
        qualificationRate: safePercent(qualified.length, approached.length),
        closings: conversionsForCampaign.length,
        revenue,
        cost,
        cplq,
        roiEstimated: roi,
        topCities,
        topConsultants,
        funnel: [
          { stage: "Importados", value: campaignLeadIds.size },
          { stage: "Abordados", value: approached.length },
          { stage: "Respondidos", value: responded.length },
          { stage: "Qualificados", value: qualified.length },
          { stage: "Fechados", value: conversionsForCampaign.length },
        ],
        trend: [...dailyTrendMap.values()],
        previewLeads: campaignLeads.slice(0, 8).map(summarizeLeadForPreview),
      };
    });

  const campaignRanking = campaignPerformance.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    qualificationRate: campaign.qualificationRate,
    conversionRate: safePercent(campaign.closings, campaign.leadsImported),
    responseRate: campaign.responseRate,
    qualifiedLeads: campaign.leadsQualified,
    leadsImported: campaign.leadsImported,
    revenue: campaign.revenue,
    cplq: campaign.cplq,
    roiEstimated: campaign.roiEstimated,
  }));

  const consultantPerformance = allConsultants.map((consultant) => {
    const extra = consultant.performance_meta || {};
    const consultantAssignments = allAssignments.filter((assignment) => assignment.consultant_id === consultant.id);
    const consultantAssignmentsFiltered = consultantAssignments.filter((assignment) => filteredLeadIds.has(assignment.lead_id));
    const consultantConversions = filteredConversions.filter((conversion) => conversion.consultant_id === consultant.id && normalizeWonStatus(conversion.conversion_status));
    const responseTimes = consultantAssignmentsFiltered
      .map((assignment) => hoursBetween(assignment.assigned_at, assignment.first_response_at))
      .filter((value) => typeof value === "number" && value >= 0);
    const regions = Array.isArray(extra.territory_regions) ? extra.territory_regions : [];
    const availableHours = extra.availableHours || {};
    return {
      id: consultant.id,
      name: consultant.name,
      phone: consultant.phone || "",
      email: consultant.email || "",
      status: consultant.active ? "Ativo" : "Inativo",
      city: consultant.city || "",
      state: consultant.state || "",
      territoryCities: consultant.territory_cities || [],
      territoryStates: consultant.territory_states || [],
      territoryRegions: regions,
      contractValueMin: Number(consultant.contract_value_min || 0),
      contractValueMax: Number(consultant.contract_value_max || 0),
      leadTypes: consultant.lead_types || [],
      dailyCapacity: Number(consultant.daily_capacity || 0),
      openLeadLimit: Number(consultant.open_lead_limit || 0),
      assignmentWeight: Number(consultant.assignment_weight || 0),
      priorityRank: Number(consultant.priority_rank || 0),
      conversionRate: safePercent(consultantConversions.length, consultantAssignmentsFiltered.length),
      responseTimeHours: average(responseTimes),
      leadsReceived: consultantAssignmentsFiltered.length,
      closings: consultantConversions.length,
      revenue: consultantConversions.reduce((sum, item) => sum + Number(item.revenue_amount || item.contract_value || 0), 0),
      available: Boolean(consultant.available),
      acceptsAutoAssign: extra.acceptsAutoAssign !== false,
      position: extra.position || "",
      availableHours,
      notes: extra.notes || "",
    };
  });

  const insights = [];
  const weakCampaign = campaignPerformance.find((campaign) => campaign.leadsApproached >= 5 && campaign.responseRate < mergedSettings.alertRules.lowResponseRate);
  if (weakCampaign) {
    insights.push(buildInsight({
      title: `${weakCampaign.name} com baixa resposta`,
      message: `${weakCampaign.responseRate.toFixed(1)}% dos leads abordados responderam no período filtrado.`,
      severity: "warning",
      impact: "Pipeline menor que o esperado",
      recommendation: "Revise copy do agente, origem da base e horário dos disparos.",
      actionLabel: "Abrir campanha",
      actionType: "campaign",
      actionTargetId: weakCampaign.id,
      actionTargetName: weakCampaign.name,
      scope: "campaign",
    }));
  }

  const cityOpportunity = cityRanking.find((item) => item.qualificationRate >= mergedSettings.qualificationThreshold && item.conversionRate < mergedSettings.alertRules.lowConversionRate);
  if (cityOpportunity) {
    insights.push(buildInsight({
      title: `${cityOpportunity.name} qualifica e converte pouco`,
      message: `A cidade manteve ${cityOpportunity.qualificationRate.toFixed(1)}% de qualificação, mas só ${cityOpportunity.conversionRate.toFixed(1)}% de fechamento.`,
      severity: "warning",
      impact: "Oportunidade represada na operação comercial",
      recommendation: "Revise distribuição por região e tempo de resposta dos consultores dessa praça.",
      actionLabel: "Ver ranking",
      actionType: "ranking_city",
      actionTargetId: cityOpportunity.id,
      actionTargetName: cityOpportunity.name,
      scope: "city",
    }));
  }

  if (currentStats.avgTimeToQualification !== null && currentStats.avgTimeToQualification > mergedSettings.alertRules.highQualificationDelayHours) {
    insights.push(buildInsight({
      title: "Tempo de qualificação acima do esperado",
      message: `A média atual está em ${currentStats.avgTimeToQualification.toFixed(1)}h até qualificar um lead.`,
      severity: "critical",
      impact: "Perda de velocidade no funil",
      recommendation: "Revisar prompts, automações e regras de follow-up do agente.",
      actionLabel: "Abrir métricas",
      actionType: "metrics",
      scope: "agent",
    }));
  }

  const consultantAverage = average(consultantPerformance.map((item) => item.conversionRate).filter((value) => value !== null));
  const weakConsultant = consultantPerformance.find((item) => consultantAverage !== null && item.conversionRate < consultantAverage * mergedSettings.alertRules.consultantBelowAverageFactor && item.leadsReceived > 0);
  if (weakConsultant) {
    insights.push(buildInsight({
      title: `${weakConsultant.name} abaixo da média`,
      message: `Conversão de ${weakConsultant.conversionRate.toFixed(1)}% com ${weakConsultant.leadsReceived} leads recebidos.`,
      severity: "warning",
      impact: "Baixo aproveitamento da carteira",
      recommendation: "Avalie redistribuição e acompanhe tempo de resposta e aderência regional.",
      actionLabel: "Abrir consultor",
      actionType: "consultant",
      actionTargetId: weakConsultant.id,
      actionTargetName: weakConsultant.name,
      scope: "consultant",
    }));
  }

  const storedInsightRows = (storedInsights || []).map((item) =>
    buildInsight({
      id: item.id || null,
      title: item.title,
      message: item.message,
      severity: item.severity || "info",
      impact: item.meta?.impact || "Acompanhar",
      recommendation: item.meta?.recommendation || "Acompanhar no módulo e tomar ação conforme o contexto.",
      actionLabel: item.meta?.actionLabel || "Abrir detalhe",
      actionType: item.meta?.actionType || "insight",
      actionTargetId: item.related_id || item.meta?.actionTargetId || null,
      actionTargetName: item.meta?.actionTargetName || null,
      scope: item.insight_scope || "dashboard",
      generatedAt: item.generated_at || null,
    })
  );

  const mergedInsights = [...insights, ...storedInsightRows].slice(0, 20);

  const queueRows = allAssignments
    .filter((assignment) => filteredLeadIds.has(assignment.lead_id))
    .filter((assignment) => !["closed"].includes(normalizeString(assignment.assignment_status)?.toLowerCase() || ""))
    .sort((a, b) => new Date(b.assigned_at || 0) - new Date(a.assigned_at || 0))
    .map((assignment) => {
      const lead = leadById.get(assignment.lead_id);
      const consultant = consultantById.get(assignment.consultant_id);
      const campaign = campaignById.get(assignment.campaign_id || leadCampaignIdByLeadId.get(assignment.lead_id));
      const dueAt = assignment.response_due_at || null;
      const dueDate = dueAt ? new Date(dueAt) : null;
      const now = new Date();
      let slaStatus = "Sem SLA";
      if (dueDate) {
        slaStatus = dueDate < now ? "Expirado" : hoursBetween(now, dueDate) < 2 ? "Critico" : "Dentro do prazo";
      }

      return {
        id: assignment.id,
        leadId: assignment.lead_id,
        leadName: lead?.nome || "Sem nome",
        leadPhone: lead?.telefone || "—",
        campaignId: campaign?.id || null,
        campaignName: campaign?.name || "Sem campanha",
        city: lead?.cidade || "—",
        potentialValue: Number(lead?.potential_contract_value || 0),
        consultantId: consultant?.id || null,
        consultantName: consultant?.name || "Sem consultor",
        ruleApplied: assignment.assignment_mode || "manual",
        assignedAt: assignment.assigned_at || null,
        status: assignment.assignment_status || "assigned",
        slaStatus,
        responseDueAt: dueAt,
        actionLocked: (assignment.assignment_status || "").toLowerCase() === "locked",
      };
    });

  const historyRows = allAssignments
    .filter((assignment) => filteredLeadIds.has(assignment.lead_id))
    .sort((a, b) => new Date((b.reassigned_at || b.closed_at || b.assigned_at || 0)) - new Date((a.reassigned_at || a.closed_at || a.assigned_at || 0)))
    .slice(0, 100)
    .map((assignment) => {
      const lead = leadById.get(assignment.lead_id);
      const currentConsultant = consultantById.get(assignment.consultant_id);
      const previousConsultantId = assignment.assignment_reason?.previousConsultantId || assignment.assignment_reason?.previous_consultant_id || null;
      const previousConsultant = previousConsultantId ? consultantById.get(previousConsultantId) : null;
      return {
        id: assignment.id,
        dateTime: assignment.reassigned_at || assignment.closed_at || assignment.assigned_at || null,
        leadName: lead?.nome || "Sem nome",
        previousConsultant: previousConsultant?.name || assignment.assignment_reason?.previousConsultantName || "—",
        currentConsultant: currentConsultant?.name || "Sem consultor",
        reason: assignment.assignment_reason?.reason || assignment.assignment_mode || "Regra automatica",
        distributionType: assignment.assignment_mode || "manual",
        responsible: assignment.assignment_reason?.actor || "Sistema",
      };
    });

  const filtersOptions = {
    companies: [{ id: client.id, name: client.name }],
    campaigns: allCampaigns.map((campaign) => ({ id: campaign.id, name: campaign.name })),
    cities: [...new Set(allLeads.map((lead) => normalizeString(lead.cidade)).filter(Boolean))].map((city) => ({ value: city, label: city })),
    consultants: consultantPerformance.map((consultant) => ({ id: consultant.id, name: consultant.name })),
    statuses: [...new Set(allLeads.map((lead) => normalizeString(lead.status)).filter(Boolean))].map((status) => ({ value: status, label: startCaseStatus(status) })),
  };

  const strategies = [
    {
      key: "round_robin",
      label: "Round-robin",
      description: "Rodízio simples entre consultores elegíveis.",
      enabled: mergedSettings.distributionStrategy === "round_robin" || allRules.some((rule) => rule.active && rule.distribution_mode === "round_robin"),
    },
    {
      key: "performance_weighted",
      label: "Peso por performance",
      description: "Consultores com melhor desempenho recebem mais oportunidades.",
      enabled: mergedSettings.distributionStrategy === "performance_weighted" || allRules.some((rule) => rule.active && rule.distribution_mode === "performance_weighted"),
    },
    {
      key: "regional_priority",
      label: "Prioridade por região",
      description: "Entrega preferencial por cidade, estado ou região.",
      enabled: mergedSettings.distributionStrategy === "regional_priority" || allRules.some((rule) => rule.active && rule.distribution_mode === "regional_priority"),
    },
    {
      key: "potential_value",
      label: "Prioridade por valor potencial",
      description: "Valor potencial influencia a ordem de envio.",
      enabled: mergedSettings.distributionStrategy === "potential_value",
    },
    {
      key: "hybrid",
      label: "Distribuição híbrida",
      description: "Mistura desempenho, região e valor potencial.",
      enabled: mergedSettings.distributionStrategy === "hybrid",
    },
  ];

  const ruleRows = allRules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    distributionMode: rule.distribution_mode,
    prioritizeRegion: Boolean(rule.prioritize_region),
    prioritizeContractValue: Boolean(rule.prioritize_contract_value),
    prioritizeLeadType: Boolean(rule.prioritize_lead_type),
    maxOpenLeadsPerConsultant: Number(rule.max_open_leads_per_consultant || 0),
    reassignAfterMinutes: Number(rule.reassign_after_minutes || 0),
    fairnessFloor: Number(rule.fairness_floor || 0),
    active: Boolean(rule.active),
    config: rule.config || {},
  }));

  const overviewKpis = [
    { key: "addressedLeads", title: "Leads abordados", value: currentStats.addressedLeads, valueLabel: String(currentStats.addressedLeads), delta: metricRows.find((item) => item.key === "responseRate")?.delta ?? null, kind: "number", tone: "cyan" },
    { key: "respondedLeads", title: "Leads que responderam", value: currentStats.respondedLeads, valueLabel: String(currentStats.respondedLeads), delta: metricRows.find((item) => item.key === "responseRate")?.delta ?? null, kind: "number", tone: "teal" },
    { key: "qualifiedLeads", title: "Leads qualificados", value: currentStats.qualifiedLeads, valueLabel: String(currentStats.qualifiedLeads), delta: metricRows.find((item) => item.key === "qualificationRate")?.delta ?? null, kind: "number", tone: "violet" },
    { key: "qualificationRate", title: "Taxa de qualificação", value: currentStats.qualificationRate, valueLabel: formatMetricValue(currentStats.qualificationRate, "percent"), delta: metricRows.find((item) => item.key === "qualificationRate")?.delta ?? null, kind: "percent", tone: "pink" },
    { key: "interactionsPerQualifiedLead", title: "Conversas por lead qualificado", value: currentStats.interactionsPerQualifiedLead, valueLabel: formatMetricValue(currentStats.interactionsPerQualifiedLead, "ratio"), delta: metricRows.find((item) => item.key === "interactionsPerQualifiedLead")?.delta ?? null, kind: "ratio", tone: "cyan" },
    { key: "interactionsPerClosing", title: "Conversas por fechamento", value: currentStats.interactionsPerClosing, valueLabel: formatMetricValue(currentStats.interactionsPerClosing, "ratio"), delta: metricRows.find((item) => item.key === "interactionsPerClosing")?.delta ?? null, kind: "ratio", tone: "amber" },
    { key: "avgTimeToQualification", title: "Tempo médio até qualificação", value: currentStats.avgTimeToQualification, valueLabel: formatMetricValue(currentStats.avgTimeToQualification, "hours"), delta: metricRows.find((item) => item.key === "avgTimeToQualification")?.delta ?? null, kind: "hours", tone: "slate" },
    { key: "avgTimeToClosing", title: "Tempo médio até fechamento", value: currentStats.avgTimeToClosing, valueLabel: formatMetricValue(currentStats.avgTimeToClosing, "hours"), delta: metricRows.find((item) => item.key === "avgTimeToClosing")?.delta ?? null, kind: "hours", tone: "violet" },
    { key: "closings", title: "Fechamentos no período", value: currentStats.closings, valueLabel: String(currentStats.closings), delta: previousStats.closings ? Number((currentStats.closings - previousStats.closings).toFixed(1)) : null, kind: "number", tone: "teal" },
    { key: "revenue", title: "Receita gerada", value: currentStats.revenue, valueLabel: formatMetricValue(currentStats.revenue, "currency"), delta: previousStats.revenue ? Number((currentStats.revenue - previousStats.revenue).toFixed(1)) : null, kind: "currency", tone: "cyan" },
    { key: "finalConversionRate", title: "Taxa de conversão final", value: currentStats.finalConversionRate, valueLabel: formatMetricValue(currentStats.finalConversionRate, "percent"), delta: metricRows.find((item) => item.key === "finalConversionRate")?.delta ?? null, kind: "percent", tone: "pink" },
  ];

  return {
    client,
    generatedAt: new Date().toISOString(),
    filters: {
      applied: filters,
      options: filtersOptions,
    },
    overview: {
      kpis: overviewKpis,
      charts: {
        qualifiedByDay: [...lineQualifiedMap.values()],
        funnel: [
          { stage: "Totais", value: currentStats.totalLeads },
          { stage: "Abordados", value: currentStats.addressedLeads },
          { stage: "Respondidos", value: currentStats.respondedLeads },
          { stage: "Qualificados", value: currentStats.qualifiedLeads },
          { stage: "Fechados", value: currentStats.closings },
        ],
        byCity: cityRanking
          .sort((a, b) => b.volumeLeads - a.volumeLeads)
          .slice(0, 8)
          .map((item) => ({
            name: item.name,
            leads: item.volumeLeads,
            qualificados: Number(((item.volumeLeads * item.qualificationRate) / 100).toFixed(0)),
            receita: item.revenue,
          })),
        byCampaign: campaignPerformance
          .sort((a, b) => b.leadsQualified - a.leadsQualified)
          .slice(0, 8)
          .map((item) => ({
            name: item.name,
            leads: item.leadsImported,
            qualificados: item.leadsQualified,
            receita: item.revenue,
          })),
        statusDonut: [...statusMap.entries()].map(([name, value]) => ({ name, value })),
        consultantComparison: consultantPerformance
          .sort((a, b) => b.conversionRate - a.conversionRate)
          .slice(0, 8)
          .map((item) => ({
            name: item.name,
            conversao: item.conversionRate,
            receita: item.revenue,
            leads: item.leadsReceived,
          })),
      },
      alerts: mergedInsights.slice(0, 4),
      rankingSummary: {
        cities: cityRanking.slice(0, 5),
        campaigns: campaignRanking
          .sort((a, b) => b.qualificationRate - a.qualificationRate)
          .slice(0, 5),
        consultants: consultantPerformance
          .sort((a, b) => b.conversionRate - a.conversionRate)
          .slice(0, 5),
      },
    },
    metrics: {
      cards: metricRows.slice(0, 6),
      items: [
        ...metricRows,
        createMetricRow({ key: "campaignPerformance", name: "Performance por campanha", current: average(campaignPerformance.map((item) => item.qualificationRate)), previous: null, kind: "percent", accent: "teal" }),
        createMetricRow({ key: "cityPerformance", name: "Performance por cidade", current: average(cityRanking.map((item) => item.qualificationRate)), previous: null, kind: "percent", accent: "violet" }),
        createMetricRow({ key: "consultantPerformance", name: "Performance por consultor", current: average(consultantPerformance.map((item) => item.conversionRate)), previous: null, kind: "percent", accent: "amber" }),
      ],
    },
    rankings: {
      cities: cityRanking,
      campaigns: campaignRanking,
      consultants: consultantPerformance.map((item) => ({
        id: item.id,
        name: item.name,
        leadsReceived: item.leadsReceived,
        firstResponseHours: item.responseTimeHours,
        conversionRate: item.conversionRate,
        closings: item.closings,
        revenue: item.revenue,
        regionalFit: item.territoryCities.length + item.territoryStates.length + item.territoryRegions.length,
      })),
    },
    distribution: {
      strategies,
      rules: ruleRows,
      queue: queueRows,
      history: historyRows,
      summary: {
        totalConsultants: consultantPerformance.length,
        availableConsultants: consultantPerformance.filter((item) => item.available).length,
        activeRules: ruleRows.filter((item) => item.active).length,
      },
    },
    consultants: {
      items: consultantPerformance,
    },
    campaigns: {
      summary: {
        total: campaignPerformance.length,
        active: campaignPerformance.filter((item) => item.status === "active").length,
        revenue: campaignPerformance.reduce((sum, item) => sum + item.revenue, 0),
        qualifiedLeads: campaignPerformance.reduce((sum, item) => sum + item.leadsQualified, 0),
      },
      items: campaignPerformance,
    },
    insights: {
      items: mergedInsights,
    },
    settings: mergedSettings,
  };
}
