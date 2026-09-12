import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SocialAnalyticsTrendChart } from "@/modules/socialPosts/components/SocialAnalyticsTrendChart";

describe("SocialAnalyticsTrendChart", () => {
  it("renders one point per real data point, with an accessible chart title", () => {
    const { container } = render(
      <SocialAnalyticsTrendChart
        points={[
          { date: "2026-09-15", value: 100 },
          { date: "2026-09-16", value: 250 },
          { date: "2026-09-17", value: 180 },
        ]}
        label="reach"
      />,
    );
    expect(screen.getByRole("img", { name: "reach trend" })).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });

  it("renders a text-equivalent tooltip per point — never color-only", () => {
    const { container } = render(<SocialAnalyticsTrendChart points={[{ date: "2026-09-17", value: 500 }]} label="reach" />);
    const title = container.querySelector("title");
    expect(title?.textContent).toContain("500");
    expect(title?.textContent).toContain("reach");
  });

  it("renders no points for an empty series without throwing", () => {
    const { container } = render(<SocialAnalyticsTrendChart points={[]} label="reach" />);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(screen.getByRole("img", { name: "reach trend" })).toBeInTheDocument();
  });

  it("renders a single point without drawing a connecting line", () => {
    const { container } = render(<SocialAnalyticsTrendChart points={[{ date: "2026-09-17", value: 42 }]} label="profile views" />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    expect(container.querySelectorAll("path")).toHaveLength(0);
  });
});
