import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageSequenceStep } from "../pages/LeadImports/MessageSequenceStep";

describe("MessageSequenceStep — Gerenciamento e Limpeza de Variações Humanizadas", () => {
  const defaultProps = {
    sequenceImageInputRef: { current: null },
    onSequenceImageChange: vi.fn(),
    campaignSequence: [],
    updateCampaignStep: vi.fn(),
    moveCampaignStep: vi.fn(),
    removeCampaignStep: vi.fn(),
    addCampaignStep: vi.fn(),
    onSelectImageStep: vi.fn(),
    isGeneratingVariants: false,
    onGenerateVariants: vi.fn(),
    variantCount: 3,
    onVariantCountChange: vi.fn(),
    suggestedVariantCount: 3,
    dailyQuota: 60,
    minVariantCount: 1,
    maxVariantCount: 12,
    onAddStepButton: vi.fn(),
    onRemoveStepButton: vi.fn(),
    onUpdateStepButton: vi.fn(),
  };

  it("exibe orientação para etapas com gatilho 'after_reply'", () => {
    const sequence = [
      {
        id: "step-1",
        order: 1,
        type: "text" as const,
        text: "Olá {{nome}}, tudo bem?",
        triggerMode: "after_reply" as const,
      },
    ];

    render(<MessageSequenceStep {...defaultProps} campaignSequence={sequence} />);

    expect(
      screen.getByText(/Variações têm pouco efeito aqui: esta etapa sai uma por vez/i)
    ).toBeInTheDocument();
  });

  it("NÃO exibe orientação de pouca utilidade no disparo inicial (triggerMode 'immediate')", () => {
    const sequence = [
      {
        id: "step-1",
        order: 1,
        type: "text" as const,
        text: "Olá {{nome}}, tudo bem?",
        triggerMode: "immediate" as const,
      },
    ];

    render(<MessageSequenceStep {...defaultProps} campaignSequence={sequence} />);

    expect(
      screen.queryByText(/Variações têm pouco efeito aqui: esta etapa sai uma por vez/i)
    ).not.toBeInTheDocument();
  });

  it("permite limpar todas as variações após confirmação", () => {
    const updateMock = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const sequence = [
      {
        id: "step-1",
        order: 1,
        type: "text" as const,
        text: "Mensagem base",
        triggerMode: "immediate" as const,
        textVariants: ["Variação 1", "Variação 2", "Variação 3"],
      },
    ];

    render(
      <MessageSequenceStep
        {...defaultProps}
        campaignSequence={sequence}
        updateCampaignStep={updateMock}
      />
    );

    // Encontra os botões de limpar todas
    const clearAllButtons = screen.getAllByRole("button", { name: /Limpar todas/i });
    expect(clearAllButtons.length).toBeGreaterThan(0);

    fireEvent.click(clearAllButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith("Remover as 3 variações?");
    expect(updateMock).toHaveBeenCalledWith("step-1", { textVariants: [] });

    confirmSpy.mockRestore();
  });

  it("permite remover uma variação individual através do botão de lixeira da linha", () => {
    const updateMock = vi.fn();

    const sequence = [
      {
        id: "step-1",
        order: 1,
        type: "text" as const,
        text: "Mensagem base",
        triggerMode: "immediate" as const,
        textVariants: ["Variação A", "Variação B", "Variação C"],
      },
    ];

    render(
      <MessageSequenceStep
        {...defaultProps}
        campaignSequence={sequence}
        updateCampaignStep={updateMock}
      />
    );

    const removeButton2 = screen.getByRole("button", { name: "Remover variação 2" });
    fireEvent.click(removeButton2);

    expect(updateMock).toHaveBeenCalledWith("step-1", {
      textVariants: ["Variação A", "Variação C"],
    });
  });
});
