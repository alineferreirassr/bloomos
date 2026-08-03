import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

describe("Table", () => {
  it("renders real semantic table markup", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Photography</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Photography" })).toBeInTheDocument();
  });

  it("renders a non-sortable header as plain text with no aria-sort", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody />
      </Table>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).not.toHaveAttribute("aria-sort");
  });

  it("renders a sortable header as a real button and reflects the CURRENT sort state via aria-sort", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const { rerender } = render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell onSort={onSort} sortDirection={null}>
              Usage
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody />
      </Table>,
    );

    const header = screen.getByRole("columnheader", { name: "Usage" });
    expect(header).toHaveAttribute("aria-sort", "none");
    await user.click(screen.getByRole("button", { name: "Usage" }));
    expect(onSort).toHaveBeenCalledTimes(1);

    rerender(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell onSort={onSort} sortDirection="asc">
              Usage
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody />
      </Table>,
    );
    expect(screen.getByRole("columnheader", { name: "Usage" })).toHaveAttribute("aria-sort", "ascending");
  });

  it("marks a selectable row with aria-selected", () => {
    render(
      <Table>
        <TableBody>
          <TableRow selected>
            <TableCell>Selected row</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Unselected row</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByText("Selected row").closest("tr")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Unselected row").closest("tr")).not.toHaveAttribute("aria-selected");
  });
});
