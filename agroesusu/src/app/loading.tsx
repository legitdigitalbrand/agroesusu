export default function DashboardLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-48 rounded-lg" style={{ background: "var(--surface-card)" }} />
        <div className="h-4 w-32 rounded mt-2" style={{ background: "var(--surface-card)" }} />
      </div>
      <div className="rounded-2xl h-32" style={{ background: "var(--surface-card)" }} />
      <div className="grid grid-cols-3 gap-3 mt-6">
        <div className="rounded-xl h-20" style={{ background: "var(--surface-card)" }} />
        <div className="rounded-xl h-20" style={{ background: "var(--surface-card)" }} />
        <div className="rounded-xl h-20" style={{ background: "var(--surface-card)" }} />
      </div>
      <div className="mt-8">
        <div className="h-5 w-24 rounded mb-4" style={{ background: "var(--surface-card)" }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl h-32" style={{ background: "var(--surface-card)" }} />
          <div className="rounded-2xl h-32" style={{ background: "var(--surface-card)" }} />
        </div>
      </div>
      <div className="mt-8">
        <div className="h-5 w-28 rounded mb-4" style={{ background: "var(--surface-card)" }} />
        <div className="rounded-xl h-40" style={{ background: "var(--surface-card)" }} />
      </div>
    </div>
  );
}
