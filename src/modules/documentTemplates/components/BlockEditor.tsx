"use client";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { AUTOMATION_CONDITION_OPERATORS } from "@/types/automation";
import type { DocumentBlock, DocumentBlockType, TextRun } from "@/types/documentPlatform";

function newBlockId(): string {
  return `block_${crypto.randomUUID()}`;
}

function makeBlock(type: DocumentBlockType): DocumentBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type: "heading", level: 2, runs: [{ text: "" }] };
    case "paragraph":
      return { id, type: "paragraph", runs: [{ text: "" }] };
    case "table":
      return { id, type: "table", rows: [[[{ text: "" }], [{ text: "" }]]] };
    case "image":
      return { id, type: "image", src: "", alt: "" };
    case "pageBreak":
      return { id, type: "pageBreak" };
    case "divider":
      return { id, type: "divider" };
    case "conditional":
      return { id, type: "conditional", field: "", operator: "eq", value: "", blocks: [] };
    case "loop":
      return { id, type: "loop", source: "", itemBlocks: [] };
  }
}

const BLOCK_TYPE_LABELS: Record<DocumentBlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  table: "Table",
  image: "Image",
  pageBreak: "Page Break",
  divider: "Divider",
  conditional: "Conditional Section",
  loop: "Loop",
};

interface AddBlockToolbarProps {
  onAdd: (type: DocumentBlockType) => void;
}

function AddBlockToolbar({ onAdd }: AddBlockToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(BLOCK_TYPE_LABELS) as DocumentBlockType[]).map((type) => (
        <Button key={type} type="button" variant="secondary" onClick={() => onAdd(type)}>
          + {BLOCK_TYPE_LABELS[type]}
        </Button>
      ))}
    </div>
  );
}

interface BlockEditorProps {
  blocks: DocumentBlock[];
  onChange: (blocks: DocumentBlock[]) => void;
}

/**
 * Step 9's own Template Editor block editing surface — one recursive
 * component handles every `DocumentBlockType` generically (never hardcodes
 * a document type), and recurses into itself for a `conditional`'s own
 * `blocks` / a `loop`'s own `itemBlocks` — the same tree shape the
 * Template Engine (`renderBlocks`) and Compiler (`extractTemplateFields`)
 * already walk. Reordering is move-up/move-down rather than HTML5
 * drag-and-drop — a deliberate, simpler affordance that reaches the same
 * "drag sections" outcome the spec calls for without a new drag library.
 */
export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  function updateBlock(index: number, next: DocumentBlock) {
    onChange(blocks.map((block, i) => (i === index ? next : block)));
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addBlock(type: DocumentBlockType) {
    onChange([...blocks, makeBlock(type)]);
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text/55">{BLOCK_TYPE_LABELS[block.type]}</span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                ↑
              </Button>
              <Button type="button" variant="ghost" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>
                ↓
              </Button>
              <Button type="button" variant="ghost" onClick={() => removeBlock(index)}>
                Remove
              </Button>
            </div>
          </div>
          <BlockFields block={block} onChange={(next) => updateBlock(index, next)} />
        </div>
      ))}
      <AddBlockToolbar onAdd={addBlock} />
    </div>
  );
}

function singleRunText(runs: TextRun[]): string {
  return runs[0]?.text ?? "";
}

function withSingleRunText(runs: TextRun[], text: string): TextRun[] {
  const base = runs[0] ?? { text: "" };
  return [{ ...base, text }];
}

interface BlockFieldsProps {
  block: DocumentBlock;
  onChange: (block: DocumentBlock) => void;
}

function BlockFields({ block, onChange }: BlockFieldsProps) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text/55" htmlFor={`${block.id}-level`}>
              Level
            </label>
            <Select
              id={`${block.id}-level`}
              className="w-20"
              value={String(block.level)}
              onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 1 | 2 | 3 })}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </Select>
          </div>
          <RunFormattingControls runs={block.runs} onChange={(runs) => onChange({ ...block, runs })} />
          <Input value={singleRunText(block.runs)} placeholder="Heading text — use {{merge_field}} for a dynamic value" onChange={(event) => onChange({ ...block, runs: withSingleRunText(block.runs, event.target.value) })} />
        </div>
      );
    case "paragraph":
      return (
        <div className="flex flex-col gap-2">
          <RunFormattingControls runs={block.runs} onChange={(runs) => onChange({ ...block, runs })} />
          <Textarea
            value={singleRunText(block.runs)}
            placeholder="Paragraph text — use {{merge_field}} for a dynamic value"
            onChange={(event) => onChange({ ...block, runs: withSingleRunText(block.runs, event.target.value) })}
          />
        </div>
      );
    case "table":
      return <TableFields block={block} onChange={onChange} />;
    case "image":
      return (
        <div className="flex flex-col gap-2">
          <Input value={block.src} placeholder="Image URL — or {{merge_field}}" onChange={(event) => onChange({ ...block, src: event.target.value })} />
          <Input value={block.alt} placeholder="Alt text" onChange={(event) => onChange({ ...block, alt: event.target.value })} />
        </div>
      );
    case "pageBreak":
    case "divider":
      return <p className="text-xs text-text/45">No configuration — this block always renders the same way.</p>;
    case "conditional":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Input className="w-40" value={block.field} placeholder="Merge Field key" onChange={(event) => onChange({ ...block, field: event.target.value })} />
            <Select className="w-24" value={block.operator} onChange={(event) => onChange({ ...block, operator: event.target.value as (typeof AUTOMATION_CONDITION_OPERATORS)[number] })}>
              {AUTOMATION_CONDITION_OPERATORS.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </Select>
            <Input
              className="w-32"
              value={typeof block.value === "string" || typeof block.value === "number" ? String(block.value) : ""}
              placeholder="Value"
              onChange={(event) => onChange({ ...block, value: event.target.value })}
            />
          </div>
          <div className="border-l-2 border-accent/30 pl-3">
            <BlockEditor blocks={block.blocks} onChange={(nested) => onChange({ ...block, blocks: nested })} />
          </div>
        </div>
      );
    case "loop":
      return (
        <div className="flex flex-col gap-2">
          <Input value={block.source} placeholder="Merge Field key resolving to a list" onChange={(event) => onChange({ ...block, source: event.target.value })} />
          <p className="text-xs text-text/45">Reference the current item as {"{{item}}"} or {"{{item.field}}"} below.</p>
          <div className="border-l-2 border-accent/30 pl-3">
            <BlockEditor blocks={block.itemBlocks} onChange={(nested) => onChange({ ...block, itemBlocks: nested })} />
          </div>
        </div>
      );
  }
}

function RunFormattingControls({ runs, onChange }: { runs: TextRun[]; onChange: (runs: TextRun[]) => void }) {
  const run = runs[0] ?? { text: "" };
  function toggle(key: "bold" | "italic" | "underline") {
    onChange([{ ...run, [key]: !run[key] }]);
  }
  return (
    <div className="flex items-center gap-3 text-xs text-text/70">
      <label className="flex items-center gap-1">
        <Checkbox checked={Boolean(run.bold)} onChange={() => toggle("bold")} /> Bold
      </label>
      <label className="flex items-center gap-1">
        <Checkbox checked={Boolean(run.italic)} onChange={() => toggle("italic")} /> Italic
      </label>
      <label className="flex items-center gap-1">
        <Checkbox checked={Boolean(run.underline)} onChange={() => toggle("underline")} /> Underline
      </label>
    </div>
  );
}

function TableFields({ block, onChange }: { block: Extract<DocumentBlock, { type: "table" }>; onChange: (block: DocumentBlock) => void }) {
  function updateCell(rowIndex: number, cellIndex: number, text: string) {
    const rows = block.rows.map((row, r) => (r === rowIndex ? row.map((cell, c) => (c === cellIndex ? [{ text }] : cell)) : row));
    onChange({ ...block, rows });
  }

  function addRow() {
    const columnCount = block.rows[0]?.length ?? 1;
    onChange({ ...block, rows: [...block.rows, Array.from({ length: columnCount }, () => [{ text: "" }])] });
  }

  function addColumn() {
    onChange({ ...block, rows: block.rows.map((row) => [...row, [{ text: "" }]]) });
  }

  function removeRow(rowIndex: number) {
    onChange({ ...block, rows: block.rows.filter((_, r) => r !== rowIndex) });
  }

  function removeColumn(cellIndex: number) {
    onChange({ ...block, rows: block.rows.map((row) => row.filter((_, c) => c !== cellIndex)) });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-border p-1">
                    <Input className="w-32" value={cell[0]?.text ?? ""} onChange={(event) => updateCell(rowIndex, cellIndex, event.target.value)} />
                  </td>
                ))}
                <td className="p-1">
                  <Button type="button" variant="ghost" onClick={() => removeRow(rowIndex)}>
                    Remove row
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-1.5">
        <Button type="button" variant="secondary" onClick={addRow}>
          + Row
        </Button>
        <Button type="button" variant="secondary" onClick={addColumn}>
          + Column
        </Button>
        <Button type="button" variant="ghost" onClick={() => removeColumn((block.rows[0]?.length ?? 1) - 1)} disabled={(block.rows[0]?.length ?? 0) <= 1}>
          − Column
        </Button>
      </div>
    </div>
  );
}
