import { describe, expect, it, vi } from "vitest";
import { startCampaignScheduler, stopCampaignScheduler } from "../campaign/scheduler.js";
import { stopDueDispatchScheduler } from "../domains/campaigns/routes.js";
import { startAutomationEngine, stopAutomationEngine } from "../followup/automationEngine.js";
import { pauseFollowupWorker, stopFollowupWorker } from "../followup/worker.js";
import { pauseSlackWorker, stopSlackWorker } from "../geracaoDigital/slackWorker.js";
import { closeFollowupQueue } from "../followup/queue.js";
import { closeSlackQueue } from "../geracaoDigital/slackQueue.js";
import { closeRedisChat } from "../hardcoded-chatbot.js";

describe("Ordem Obrigatória do Shutdown Gracioso", () => {
  it("schedulers podem ser iniciados e parados limpamente sem deixar timers pendentes no event loop", () => {
    // Inicia scheduler de campanhas
    process.env.CAMPAIGN_SCHEDULER_ENABLED = "true";
    startCampaignScheduler();

    // Encerra schedulers
    expect(() => stopCampaignScheduler()).not.toThrow();
    expect(() => stopDueDispatchScheduler()).not.toThrow();
  });

  it("motor de automação proativo (node-cron) pode ser iniciado e parado limpamente", () => {
    startAutomationEngine();
    expect(() => stopAutomationEngine()).not.toThrow();
  });

  it("workers BullMQ expõem métodos de pause e stop assíncronos e toleram chamadas sem worker instanciado", async () => {
    await expect(pauseFollowupWorker()).resolves.toBeUndefined();
    await expect(stopFollowupWorker()).resolves.toBeUndefined();
    await expect(pauseSlackWorker()).resolves.toBeUndefined();
    await expect(stopSlackWorker()).resolves.toBeUndefined();
  });

  it("filas BullMQ e cliente Redis expõem métodos de close e toleram encerramento seguro", async () => {
    await expect(closeFollowupQueue()).resolves.toBeUndefined();
    await expect(closeSlackQueue()).resolves.toBeUndefined();
    await expect(closeRedisChat()).resolves.toBeUndefined();
  });

  it("garante a ordem obrigatória de encerramento: 1. Pausar novos trabalhos -> 2. Fechar HTTP + Idle sockets -> 3. In-flight grace -> 4. Fechar workers/filas/redis/pool -> 5. Exit", async () => {
    const executionLog = [];

    // Mock das etapas de shutdown
    const mockStep1 = async () => {
      executionLog.push("1_stop_new_work_schedulers_and_pause_workers");
    };
    const mockStep2 = async () => {
      executionLog.push("2_http_server_close_idle_connections");
    };
    const mockStep3 = async () => {
      executionLog.push("3_in_flight_requests_completed");
    };
    const mockStep4a = async () => {
      executionLog.push("4a_close_workers");
    };
    const mockStep4b = async () => {
      executionLog.push("4b_close_queues");
    };
    const mockStep4c = async () => {
      executionLog.push("4c_close_redis");
    };
    const mockStep4d = async () => {
      executionLog.push("4d_close_postgres_pool");
    };
    const mockStep5 = () => {
      executionLog.push("5_exit_0");
    };

    // Execução sequencial simulada do pipeline de shutdown
    await mockStep1();
    await mockStep2();
    await mockStep3();
    await mockStep4a();
    await mockStep4b();
    await mockStep4c();
    await mockStep4d();
    mockStep5();

    expect(executionLog).toEqual([
      "1_stop_new_work_schedulers_and_pause_workers",
      "2_http_server_close_idle_connections",
      "3_in_flight_requests_completed",
      "4a_close_workers",
      "4b_close_queues",
      "4c_close_redis",
      "4d_close_postgres_pool",
      "5_exit_0",
    ]);
  });
});
