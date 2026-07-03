export default function DashboardLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-7 w-48 bg-stone-200 rounded-lg" />
        <div className="h-4 w-32 bg-stone-100 rounded mt-2" />
      </div>

      {/* Balance card skeleton */}
      <div className="bg-stone-200 rounded-2xl h-32" />

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        <div className="bg-stone-100 rounded-xl h-20" />
        <div className="bg-stone-100 rounded-xl h-20" />
        <div className="bg-stone-100 rounded-xl h-20" />
      </div>

      {/* Pots skeleton */}
      <div className="mt-8">
        <div className="h-5 w-24 bg-stone-200 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-stone-100 rounded-2xl h-32" />
          <div className="bg-stone-100 rounded-2xl h-32" />
        </div>
      </div>

      {/* Activity skeleton */}
      <div className="mt-8">
        <div className="h-5 w-28 bg-stone-200 rounded mb-4" />
        <div className="bg-stone-100 rounded-xl h-40" />
      </div>
    </div>
  );
}
