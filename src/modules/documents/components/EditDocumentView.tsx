"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDocumentById } from "@/lib/data";
import { updateDocumentMetadataAction as updateDocumentMetadata } from "@/modules/documents/documentActions";
import type { Document } from "@/types/document";
import { NotFoundError } from "@/core/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EditDocumentMetadataForm } from "@/modules/documents/components/EditDocumentMetadataForm";
import { documentEditMetadataFormToInput } from "@/modules/documents/schema";
import { documentToEditMetadataFormInput } from "@/modules/documents/mappers";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; document: Document };

export function EditDocumentView({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getDocumentById(documentId)
      .then((document) => {
        if (!cancelled) setState({ status: "ready", document });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This document could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this document." />;
  }

  const { document } = state;

  if (document.status === "deleted") {
    return (
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Edit {document.title}</h2>
        <p className="mt-4 text-sm text-text-muted">This document has been deleted and can&apos;t be edited.</p>
        <Link href={`/documents/${documentId}`} className="mt-4 inline-block text-sm text-accent hover:underline">
          ← Back to document
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">Edit {document.title}</h2>
      <div className="mt-6 max-w-2xl">
        <EditDocumentMetadataForm
          defaultValues={documentToEditMetadataFormInput(document)}
          cancelHref={`/documents/${documentId}`}
          onSubmit={async (input) => {
            const result = await updateDocumentMetadata(documentId, documentEditMetadataFormToInput(input));
            if (result.success) {
              router.push(`/documents/${documentId}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
