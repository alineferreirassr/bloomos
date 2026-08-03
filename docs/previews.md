# Asset Previews

`core/digitalAssets/previewEngine.ts` — a pure classification function. Per the checkpoint's own Step 6 instruction, **"Never render actual files. Only determine preview behavior."** This engine never renders a thumbnail, embeds a viewer, or touches file bytes — it answers exactly one question: what kind of preview *would* make sense for this file, and can a browser render it inline.

## Reuses `assetCategory.ts`, doesn't re-derive it

`resolvePreviewType` calls the real `categorizeAsset()` (Checkpoint 25's own mime/extension categorization) as the one source of truth for "what kind of file is this," then regroups those categories into this checkpoint's own 9 named preview types — never a second mime/extension classifier.

| `AssetCategory` | `PreviewType` |
|---|---|
| image | image |
| video | video |
| audio | audio |
| pdf | pdf |
| spreadsheet | spreadsheet |
| presentation | presentation |
| document | document, or **text** when the extension/mime indicates plain text (`.txt`/`.md`/`.csv`/`.json`/`.log`/`text/plain`) |
| archive, 3d, other | unknown |

## Inline-renderability

`canRenderInline` is `true` for image/PDF/video/audio/text — every format a browser can render natively without a plugin. The document/spreadsheet/presentation formats this app actually stores (docx/xlsx/pptx) are `false`, since no in-browser viewer for those formats exists or is in scope.

## Thumbnails: disclosed, not fabricated

`thumbnailAvailable` is always `false`. No thumbnail-generation pipeline exists — the checkpoint's own stop condition explicitly forbids image processing. This is a disclosed limitation, not a capability this engine pretends to have.

## Named functions

| Function | Purpose |
|---|---|
| `resolvePreviewType(asset)` | `PreviewType` from mime/extension |
| `buildAssetPreview(asset)` | Full `AssetPreview` — type, inline-renderability, thumbnail availability |
