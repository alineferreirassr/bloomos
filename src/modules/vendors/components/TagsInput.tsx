"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface TagsInputProps {
  id?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

/**
 * Form-only tags editor — unlike Clients' TagsEditor (which persists on
 * every add/remove via a dedicated updateClientTags call), Vendors has no
 * dedicated tags-only repository method; tags are part of the general
 * create/update patch. This only mutates local form state via `onChange`;
 * persistence happens once, on form submit, like every other field.
 */
export function TagsInput({ id, tags, onChange, disabled }: TagsInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    const value = inputValue.trim();
    setInputValue("");
    if (!value || tags.includes(value)) return;
    onChange([...tags, value]);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={`Remove tag ${tag}`}
                className="ml-1.5 text-text-muted hover:text-text"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="mt-2">
        <Input
          id={id}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder="Add a tag and press Enter…"
          aria-label="Add a tag"
          disabled={disabled}
          className="max-w-xs"
        />
      </div>
    </div>
  );
}
