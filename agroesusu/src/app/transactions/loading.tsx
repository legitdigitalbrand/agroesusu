export default function TransactionsLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto animate-pulse">
      <div className="h-7 w-40 rounded-lg mb-6" style={{ background: "var(--surface-card)" }} />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-4 h-16" style={{ background: "var(--surface-card)" }} />
        ))}
      </div>
    </div>
  );
}
