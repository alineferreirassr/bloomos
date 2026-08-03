import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/Tabs";

function ThreeTabs(props: { onValueChange?: (value: string) => void; defaultValue?: string }) {
  return (
    <Tabs defaultValue={props.defaultValue ?? "one"} onValueChange={props.onValueChange}>
      <TabList aria-label="Sections">
        <Tab value="one">One</Tab>
        <Tab value="two">Two</Tab>
        <Tab value="three" disabled>
          Three
        </Tab>
      </TabList>
      <TabPanel value="one">Panel one</TabPanel>
      <TabPanel value="two">Panel two</TabPanel>
      <TabPanel value="three">Panel three</TabPanel>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders tablist/tab/tabpanel roles with correct aria-selected and only the active panel mounted", () => {
    render(<ThreeTabs />);

    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Panel one")).toBeInTheDocument();
    expect(screen.queryByText("Panel two")).not.toBeInTheDocument();
  });

  it("switches panels on click and calls onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ThreeTabs onValueChange={onValueChange} />);

    await user.click(screen.getByRole("tab", { name: "Two" }));

    expect(onValueChange).toHaveBeenCalledWith("two");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Panel two")).toBeInTheDocument();
    expect(screen.queryByText("Panel one")).not.toBeInTheDocument();
  });

  it("uses roving tabindex — only the selected tab is in the page Tab order", () => {
    render(<ThreeTabs />);

    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus and selection with ArrowRight/ArrowLeft, skipping the disabled tab", async () => {
    const user = userEvent.setup();
    render(<ThreeTabs />);

    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
  });

  it("moves focus to the last tab on End and the first on Home", async () => {
    const user = userEvent.setup();
    render(<ThreeTabs />);

    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{End}");
    // "Three" is disabled and excluded from the queried focusable set, so End lands on "Two".
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
  });

  it("supports fully controlled usage via value/onValueChange", async () => {
    const user = userEvent.setup();
    function ControlledTabs() {
      const [value, setValue] = useState("one");
      return (
        <Tabs value={value} onValueChange={setValue}>
          <TabList aria-label="Sections">
            <Tab value="one">One</Tab>
            <Tab value="two">Two</Tab>
          </TabList>
          <TabPanel value="one">Panel one</TabPanel>
          <TabPanel value="two">Panel two</TabPanel>
        </Tabs>
      );
    }
    render(<ControlledTabs />);

    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("Panel two")).toBeInTheDocument();
  });
});
