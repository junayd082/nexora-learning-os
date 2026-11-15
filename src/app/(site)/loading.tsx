export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
      <div className="h-7 w-48 animate-pulse rounded bg-sunk" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-sunk" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-md bg-sunk" />)}
      </div>
    </div>
  );
}
