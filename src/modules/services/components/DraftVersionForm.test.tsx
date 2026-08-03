import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftVersionForm } from "@/modules/services/components/DraftVersionForm";
import { ServiceMutationError } from "@/modules/services/hooks/errorContract";
import { makeServiceVersion } from "@/modules/services/testUtils";

const draftVersion = makeServiceVersion({
  id: "draft_1",
  status: "draft",
  version_number: null,
  base_price_minor: 50000,
  currency: "USD",
  setup_duration_minutes: 30,
  breakdown_duration_minutes: 15,
  difficulty_score: 3,
  experience_level_required: "intermediate",
  weather_sensitivity: "medium",
  surprise_friendly: true,
  estimated_profit_minor: 10000,
});

function renderForm(overrides: Partial<Parameters<typeof DraftVersionForm>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(draftVersion);
  const utils = render(<DraftVersionForm draftVersion={draftVersion} onSave={onSave} readOnly={false} {...overrides} />);
  return { onSave, ...utils };
}

describe("DraftVersionForm", () => {
  it("renders the correct domain fields in view mode", () => {
    renderForm();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("15 min")).toBeInTheDocument();
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    expect(screen.getByText("Medium Sensitivity")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("requires an explicit Save — editing the price does not call onSave until Save is clicked", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Base price", { exact: false }));
    await user.type(screen.getByLabelText("Base price", { exact: false }), "125");
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("converts the major-unit price input back to the minor-unit integer contract on save", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Base price", { exact: false }));
    await user.type(screen.getByLabelText("Base price", { exact: false }), "125.50");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ base_price_minor: 12550, currency: "USD" });
  });

  it("preserves every other draft field unchanged when only the price is edited", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Base price", { exact: false }));
    await user.type(screen.getByLabelText("Base price", { exact: false }), "200");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      setup_duration_minutes: 30,
      breakdown_duration_minutes: 15,
      difficulty_score: 3,
      experience_level_required: "intermediate",
      weather_sensitivity: "medium",
      surprise_friendly: true,
      estimated_profit_minor: 10000,
    });
  });

  it("shows a field error mapped from the server's minor-unit field name back to the major-unit input", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(
      new ServiceMutationError("Please fix the highlighted fields.", { base_price_minor: "Base price must be a non-negative whole number of minor units." }),
    );
    renderForm({ onSave });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Base price must be a non-negative whole number of minor units.")).toBeInTheDocument();
  });

  it("shows a disabled Edit button when the version is published (not the editable draft)", () => {
    renderForm({ readOnly: true, readOnlyReason: "This version is no longer editable." });
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows a disabled Edit button when the Service is archived", () => {
    renderForm({ readOnly: true, readOnlyReason: "Archived Services are read-only. Restore it first." });
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows a disabled Edit button when permission is denied", () => {
    renderForm({ readOnly: true, readOnlyReason: "You don't have access to manage Services." });
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute("aria-disabled", "true");
  });
});
