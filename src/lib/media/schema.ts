import { z } from "zod";
import { LIVE_MEDIA_ASSET_OWNER_TYPES } from "@/lib/media/ownerTypes";

/**
 * Validates the metadata surrounding an upload — the file itself (a Blob)
 * isn't a zod concern; its MIME type/extension/size are validated via
 * src/lib/media/mediaFile.ts, matching the codebase's "validate everything
 * first, write nothing on failure" convention.
 */
export const uploadMediaAssetInputSchema = z.object({
  ownerType: z.enum(LIVE_MEDIA_ASSET_OWNER_TYPES),
  ownerId: z.string().trim().min(1, "An owner is required."),
  originalFilename: z.string().trim().min(1, "A file name is required."),
});

export type UploadMediaAssetMetadataInput = z.infer<typeof uploadMediaAssetInputSchema>;

export const replaceMediaAssetVersionInputSchema = z.object({
  originalFilename: z.string().trim().min(1, "A file name is required."),
});

export type ReplaceMediaAssetVersionMetadataInput = z.infer<typeof replaceMediaAssetVersionInputSchema>;
