import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentTypeBadge } from "@/modules/finance/components/PaymentTypeBadge";

describe("PaymentTypeBadge", () => {
  it("renders a genuine Cash refund as 'Refund' with the danger tone unchanged (regression guard)", () => {
    render(<PaymentTypeBadge type="refund" reference={null} />);
    const badge = screen.getByText("Refund");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/danger/);
  });

  it("renders a Deposit Application Reversal row as 'Deposit Reversal' with a neutral tone", () => {
    render(<PaymentTypeBadge type="refund" reference="deposit_application_reversal_of:payment_app_1" />);
    const badge = screen.getByText("Deposit Reversal");
    expect(badge).toBeInTheDocument();
    expect(badge.className).not.toMatch(/danger/);
    expect(screen.queryByText("Refund")).not.toBeInTheDocument();
  });

  it("renders an ordinary Deposit Application as 'Adjustment', unaffected by the reversal override", () => {
    render(<PaymentTypeBadge type="adjustment" reference="deposit_application_of:payment_deposit_1" />);
    expect(screen.getByText("Adjustment")).toBeInTheDocument();
  });

  it("does not misfire the override for an unrelated refund reference", () => {
    render(<PaymentTypeBadge type="refund" reference="refund_of:payment_1" />);
    expect(screen.getByText("Refund")).toBeInTheDocument();
    expect(screen.queryByText("Deposit Reversal")).not.toBeInTheDocument();
  });

  it("does not misfire the override for a reversal-looking reference on a non-refund type", () => {
    render(<PaymentTypeBadge type="adjustment" reference="deposit_application_reversal_of:payment_app_1" />);
    expect(screen.getByText("Adjustment")).toBeInTheDocument();
    expect(screen.queryByText("Deposit Reversal")).not.toBeInTheDocument();
  });

  it("does not misfire the override for a near-miss reference that doesn't match the exact prefix", () => {
    render(<PaymentTypeBadge type="refund" reference="not_deposit_application_reversal_of:payment_app_1" />);
    expect(screen.getByText("Refund")).toBeInTheDocument();
    expect(screen.queryByText("Deposit Reversal")).not.toBeInTheDocument();
  });
});
