export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <p className="text-sm text-ink/70">Loading event information…</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-ink/10" />
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="h-28 rounded-2xl bg-ink/5" />
          <div className="h-28 rounded-2xl bg-ink/5" />
        </div>
        <div className="mt-6 h-48 rounded-2xl bg-ink/5" />
      </div>
    </div>
  );
}
