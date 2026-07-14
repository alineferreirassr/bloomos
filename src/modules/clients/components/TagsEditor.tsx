"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { updateClientTags } from "@/lib/data";

interface TagsEditorProps {
  clientId: string;
  tags: string[];
  onChanged: (tags: string[]) => void;
}

export function TagsEditor({ clientId, tags, onChanged }: TagsEditorProps) {
  const [optimisticTags, setOptimisticTags] = useState(tags);
  const [inputValue, setInputValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = async (next: string[]) => {
    const previous = optimisticTags;
    setOptimisticTags(next);
    setPending(true);
    setError(null);
    const result = await updateClientTags(clientId, next);
    setPending(false);
    if (!result.success) {
      setOptimisticTags(previous);
      setError(result.error);
      return;
    }
    onChanged(next);
  };

  const addTag = () => {
    const value = inputValue.trim();
    setInputValue("");
    if (!value || optimisticTags.includes(value)) return;
    commit([...optimisticTags, value]);
  };

  const removeTag = (tag: string) => {
    commit(optimisticTags.filter((t) => t !== tag));
  };

  return (
    <div>
      {optimisticTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {optimisticTags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={pending}
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
          disabled={pending}
          className="max-w-xs"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
