/** MEDIAKIT-04 — rendered for an unknown slug, an unpublished/draft-only Media Kit, or an archived one. `getPublishedMediaKitContent` returns `null` for all three; this page never distinguishes them further, so a visitor never learns whether a slug exists at all. */
export function PublicMediaKitUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-text">
      <div>
        <p className="text-[11px] tracking-[0.25em] text-accent-2 uppercase">Amoré Bloom</p>
        <h1 className="mt-4 font-serif text-2xl text-text">This Media Kit isn&apos;t available.</h1>
        <p className="mt-2 text-sm text-text-muted">It may not be published yet, or the link may be out of date.</p>
      </div>
    </div>
  );
}
