import type { DocumentBlock, TextRun } from "@/types/documentPlatform";

function RunText({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((run, index) => {
        let node: React.ReactNode = run.text || " ";
        if (run.bold) node = <strong>{node}</strong>;
        if (run.italic) node = <em>{node}</em>;
        if (run.underline) node = <span className="underline">{node}</span>;
        return <span key={index}>{node}</span>;
      })}
    </>
  );
}

/**
 * A generic, read-only renderer for a `DocumentBlock[]` tree — used both by
 * the Template Editor's own live Preview panel (rendering a Template's raw,
 * possibly-still-conditional/looped `content`) and the Document viewer
 * (rendering an already-flattened compiled `content`, where `conditional`/
 * `loop` blocks never actually appear). Never hardcodes a document type —
 * it only ever switches on `DocumentBlock.type` (Step 3's own "Never
 * hardcode templates" extended to the render side).
 */
export function BlockPreview({ blocks }: { blocks: DocumentBlock[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => (
        <BlockPreviewNode key={block.id} block={block} />
      ))}
    </div>
  );
}

function BlockPreviewNode({ block }: { block: DocumentBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = (`h${block.level}` as const) satisfies "h1" | "h2" | "h3";
      return (
        <Tag className={block.level === 1 ? "font-serif text-xl font-semibold text-text" : block.level === 2 ? "font-serif text-lg font-semibold text-text" : "font-serif text-base font-semibold text-text"}>
          <RunText runs={block.runs} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="text-sm leading-relaxed text-text/85">
          <RunText runs={block.runs} />
        </p>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-border px-2.5 py-1.5 align-top">
                      <RunText runs={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "image":
      // eslint-disable-next-line @next/next/no-img-element -- a compiled block's own src may be an arbitrary resolved URL; the Next.js Image component's own domain allowlist doesn't apply to authored template content.
      return block.src ? <img src={block.src} alt={block.alt} className="max-w-full rounded-md border border-border" /> : <p className="text-xs italic text-text/45">[Image: {block.alt || "untitled"}]</p>;
    case "pageBreak":
      return <div className="border-t-2 border-dashed border-border/70 py-1 text-center text-[10px] uppercase tracking-wide text-text/40">Page Break</div>;
    case "divider":
      return <hr className="border-border" />;
    case "conditional":
      return (
        <div className="rounded-md border border-dashed border-accent/40 p-2.5">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-accent/70">
            If {block.field} {block.operator} {JSON.stringify(block.value)}
          </p>
          <BlockPreview blocks={block.blocks} />
        </div>
      );
    case "loop":
      return (
        <div className="rounded-md border border-dashed border-accent/40 p-2.5">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-accent/70">For each item in {block.source}</p>
          <BlockPreview blocks={block.itemBlocks} />
        </div>
      );
  }
}
