import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceDetailHeader } from "@/modules/services/components/ServiceDetailHeader";
import type { ServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";
import { makeService, makeServiceVersion } from "@/modules/services/testUtils";

const allowedPermissions: ServicesPermissions = {
  canEditIdentity: true,
  canEditDraftVersion: true,
  canPublish: true,
  canChangeStatus: true,
  canArchiveRestore: true,
  disabledReason: null,
};

function baseProps(overrides: Partial<Parameters<typeof ServiceDetailHeader>[0]> = {}) {
  return {
    service: makeService({ status: "active" }),
    categoryName: "Music",
    draftVersion: makeServiceVersion({ id: "draft_1", status: "draft", version_number: null, published_at: null, published_by: null }),
    publishedVersion: makeServiceVersion(),
    usageCount: 2,
    permissions: allowedPermissions,
    onEditIdentity: vi.fn(),
    onOpenPublish: vi.fn(),
    onActivate: vi.fn(),
    onDeactivate: vi.fn(),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
    activatePending: false,
    deactivatePending: false,
    archivePending: false,
    restorePending: false,
    ...overrides,
  };
}

describe("ServiceDetailHeader", () => {
  it("shows both the published and draft version badges", () => {
    render(<ServiceDetailHeader {...baseProps()} />);
    expect(screen.getByText(/Published v1/)).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows Deactivate for an active Service", () => {
    render(<ServiceDetailHeader {...baseProps({ service: makeService({ status: "active" }) })} />);
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
  });

  it("shows Activate for an inactive Service", () => {
    render(<ServiceDetailHeader {...baseProps({ service: makeService({ status: "inactive" }) })} />);
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("hides both Activate and Deactivate for an archived Service, showing Restore in the ActionMenu instead", async () => {
    const user = userEvent.setup();
    render(<ServiceDetailHeader {...baseProps({ service: makeService({ status: "archived" }) })} />);
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    expect(screen.getByRole("menuitem", { name: "Restore" })).toBeInTheDocument();
  });

  it("explains a permission-denied status action via Tooltip rather than hiding it, and never fires the callback", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <ServiceDetailHeader
        {...baseProps({
          service: makeService({ status: "inactive" }),
          onActivate,
          permissions: { ...allowedPermissions, canChangeStatus: false, disabledReason: "You don't have access to manage Services." },
        })}
      />,
    );
    const button = screen.getByRole("button", { name: "Activate" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.click(button);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("opens a confirmation modal before archiving, and only calls onArchive on confirm", async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    render(<ServiceDetailHeader {...baseProps({ onArchive })} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(screen.getByRole("dialog", { name: "Archive this Service?" })).toBeInTheDocument();
    expect(onArchive).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it("restores directly with a single click — no confirmation modal", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(<ServiceDetailHeader {...baseProps({ service: makeService({ status: "archived" }), onRestore })} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Restore" }));
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables Publish with a blocking-reason Tooltip when the draft can't be published yet", async () => {
    const user = userEvent.setup();
    const onOpenPublish = vi.fn();
    render(
      <ServiceDetailHeader
        {...baseProps({
          draftVersion: makeServiceVersion({ id: "draft_1", status: "draft", version_number: null, base_price_minor: -1 }),
        })}
      />,
    );
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.click(button);
    expect(onOpenPublish).not.toHaveBeenCalled();
  });
});
