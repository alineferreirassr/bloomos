/**
 * Core's "Attachments"/"Files" concept — this file exists so a future
 * module imports one obvious path (`@/core/files`) instead of having to
 * already know that generic, provider-agnostic file attachment was solved
 * during the Shared Media Library phase as `MediaAsset`.
 *
 * There is deliberately no separate `Attachment`/`File` type here: MediaAsset
 * already IS the generic Attachments/Files concept (pure storage-object
 * metadata, polymorphic `owner_type`/`owner_id`, no business fields — see
 * its own doc comment in `types/mediaAsset.ts`). A second parallel type
 * would just be the exact duplication this Core phase exists to avoid.
 *
 * `Note.attachments` (`types/note.ts`) is the one pre-existing loose end —
 * a separate, metadata-only `NoteAttachment[]` placeholder with no real
 * storage behind it. Reconciling it to reference real `MediaAsset` rows by
 * id is a real follow-up, not done here: it would mean changing `Note`'s
 * shape and every module that renders `NoteAttachment`, which is
 * modification of shipped modules and out of scope for this foundation
 * phase.
 */
export type {
  MediaAsset,
} from "@/types/mediaAsset";
export type {
  MediaAssetsRepository,
  MediaAssetFilters,
  UploadMediaAssetInput,
  ReplaceMediaAssetVersionInput,
  MediaAssetDownload,
  MediaAssetDownloadUrl,
  MediaAssetChecksumVerification,
} from "@/lib/data/media/repository";
export {
  MEDIA_ASSET_OWNER_TYPES,
  LIVE_MEDIA_ASSET_OWNER_TYPES,
} from "@/lib/media/ownerTypes";
