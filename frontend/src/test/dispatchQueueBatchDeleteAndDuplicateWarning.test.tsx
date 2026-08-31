import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DuplicateDispatchWarningDialog } from "../pages/LeadImports/DuplicateDispatchWarningDialog";
import { DispatchQueueTable } from "../pages/LeadImports/DispatchQueueTable";
import type { CampaignDispatch } from "../hooks/useCampanhas";

describe("Aviso de Duplicidade e Exclusão em Massa de Disparos", () => {
  it("1. DuplicateDispatchWarningDialog exibe contadores de lotes/destinatários e oferece duas escolhas explícitas", () => {
    const onCancelPreviousAndCreate = vi.fn();
    const onCreateAnyway = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <DuplicateDispatchWarningDialog
        open={true}
        onOpenChange={onOpenChange}
        campaignName="Primeira campanha"
        pendingDispatchesCount={57}
        pendingRecipientsCount={1140}
        onCancelPreviousAndCreate={onCancelPreviousAndCreate}
        onCreateAnyway={onCreateAnyway}
      />
    );

    // Mensagem de alerta visível
    expect(screen.getByText(/Disparos em Aberto Detectados/i)).toBeInTheDocument();
    expect(screen.getByText(/57 lotes pendentes/i)).toBeInTheDocument();
    expect(screen.getByText(/1140 destinatários/i)).toBeInTheDocument();

    // Botão 1: Cancelar lotes anteriores e criar este
    const btnCancelAndCreate = screen.getByRole("button", {
      name: /Cancelar os lotes anteriores e criar este/i,
    });
    fireEvent.click(btnCancelAndCreate);
    expect(onCancelPreviousAndCreate).toHaveBeenCalledTimes(1);

    // Botão 2: Criar mesmo assim
    const btnCreateAnyway = screen.getByRole("button", {
      name: /Criar mesmo assim/i,
    });
    fireEvent.click(btnCreateAnyway);
    expect(onCreateAnyway).toHaveBeenCalledTimes(1);
  });

  it("2. DispatchQueueTable impede exclusão de lote 'running' (TRAVA)", () => {
    const mockDispatches: CampaignDispatch[] = [
      {
        id: "disp-running-1",
        campaign_id: "camp-1",
        client_id: "sonhare",
        name: "Lote 1/12 em andamento",
        status: "running",
        target_count: 100,
        sent_count: 45,
        failed_count: 0,
        trigger_type: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: "disp-scheduled-2",
        campaign_id: "camp-1",
        client_id: "sonhare",
        name: "Lote 2/12 agendado",
        status: "scheduled",
        target_count: 100,
        sent_count: 0,
        failed_count: 0,
        trigger_type: "scheduled",
        created_at: new Date().toISOString(),
      },
    ] as any;

    const onDeleteBatch = vi.fn();
    const onDeleteMultiple = vi.fn();

    render(
      <DispatchQueueTable
        dispatches={mockDispatches as any}
        loadingDispatches={false}
        refetchDispatches={vi.fn()}
        onTriggerDispatchBatch={vi.fn()}
        onPauseDispatchBatch={vi.fn()}
        onDownloadFailedCsv={vi.fn()}
        onDeleteDispatchBatch={onDeleteBatch}
        onDeleteMultipleDispatches={onDeleteMultiple}
        onPreviewDispatch={vi.fn()}
        onEditDispatchPrompt={vi.fn()}
      />
    );

    // Checkbox do lote running deve estar disabled
    const checkboxes = screen.getAllByRole("checkbox");
    // [0]: Header "selecionar todos", [1]: disp-running-1, [2]: disp-scheduled-2
    expect(checkboxes[1]).toBeDisabled();
    expect(checkboxes[2]).not.toBeDisabled();

    // Botão de exclusão individual: NÃO deve existir para o lote running, mas DEVE existir para o scheduled
    const deleteButtons = screen.getAllByTitle("Excluir Lote");
    expect(deleteButtons).toHaveLength(1);
  });

  it("3. DispatchQueueTable permite selecionar todos os visíveis (exceto running) e acionar exclusão em massa", () => {
    const mockDispatches: CampaignDispatch[] = [
      {
        id: "disp-1",
        campaign_id: "camp-1",
        client_id: "sonhare",
        name: "Primeira Campanha — Lote 1/3",
        status: "scheduled",
        target_count: 20,
        sent_count: 0,
        failed_count: 0,
        trigger_type: "scheduled",
        created_at: new Date().toISOString(),
      },
      {
        id: "disp-2",
        campaign_id: "camp-1",
        client_id: "sonhare",
        name: "Primeira Campanha — Lote 2/3",
        status: "paused",
        target_count: 20,
        sent_count: 5,
        failed_count: 0,
        trigger_type: "scheduled",
        created_at: new Date().toISOString(),
      },
    ] as any;

    const onDeleteMultiple = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <DispatchQueueTable
        dispatches={mockDispatches as any}
        loadingDispatches={false}
        refetchDispatches={vi.fn()}
        onTriggerDispatchBatch={vi.fn()}
        onPauseDispatchBatch={vi.fn()}
        onDownloadFailedCsv={vi.fn()}
        onDeleteDispatchBatch={vi.fn()}
        onDeleteMultipleDispatches={onDeleteMultiple}
        onPreviewDispatch={vi.fn()}
        onEditDispatchPrompt={vi.fn()}
      />
    );

    // Clica no checkbox do cabeçalho "selecionar todos"
    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(selectAllCheckbox);

    // Barra de ação em lote surge
    expect(screen.getByText(/2 lotes selecionados/i)).toBeInTheDocument();

    const btnDeleteBatch = screen.getByRole("button", {
      name: /Excluir selecionados \(2\)/i,
    });
    fireEvent.click(btnDeleteBatch);

    expect(window.confirm).toHaveBeenCalled();
    expect(onDeleteMultiple).toHaveBeenCalledWith(["disp-1", "disp-2"]);
  });
});
