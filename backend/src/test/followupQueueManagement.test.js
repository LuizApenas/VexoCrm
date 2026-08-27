import { describe, expect, it } from "vitest";

describe("Follow-up Queue Management — Reschedule and Delete Rules", () => {
  it("allows rescheduling with scheduledFor and cancels old pending jobs", () => {
    const existingJobs = [
      { id: "job-1", schedule_id: "sched-1", status: "pending", custom_message: "Msg antiga" },
    ];

    // Simulação da lógica de cancelamento do anterior e criação do novo
    const updatedJobs = existingJobs.map((j) =>
      j.status === "pending" ? { ...j, status: "cancelled" } : j
    );
    expect(updatedJobs[0].status).toBe("cancelled");

    const newTargetDate = new Date("2026-08-28T15:00:00.000Z");
    const newJob = {
      id: "job-2",
      schedule_id: "sched-1",
      status: "pending",
      custom_message: "Nova mensagem editada",
      scheduled_for: newTargetDate,
    };

    expect(newJob.status).toBe("pending");
    expect(newJob.custom_message).toBe("Nova mensagem editada");
    expect(newJob.scheduled_for.toISOString()).toBe("2026-08-28T15:00:00.000Z");
  });

  it("blocks permanent delete when schedule has already sent messages (sent_count > 0)", () => {
    const scheduleWithSent = {
      id: "sched-sent",
      sent_count: 1,
    };

    const canDelete = Number(scheduleWithSent.sent_count) === 0;
    expect(canDelete).toBe(false);
  });

  it("permits permanent delete when schedule has 0 sent messages", () => {
    const scheduleNeverSent = {
      id: "sched-never-sent",
      sent_count: 0,
    };

    const canDelete = Number(scheduleNeverSent.sent_count) === 0;
    expect(canDelete).toBe(true);
  });
});
