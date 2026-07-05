export default function GroupsLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto animate-pulse">
      <div className="h-7 w-32 rounded-lg mb-6" style={{ background: "var(--surface-card)" }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl h-48" style={{ background: "var(--surface-card)" }} />
        <div className="rounded-2xl h-48" style={{ background: "var(--surface-card)" }} />
      </div>
    </div>
  );
}
