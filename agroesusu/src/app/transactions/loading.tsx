export default function TransactionsLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto animate-pulse">
      <div className="h-7 w-40 bg-brand-900 rounded-lg mb-6" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-brand-900 rounded-xl p-4 h-16" />
        ))}
      </div>
    </div>
  );
}
