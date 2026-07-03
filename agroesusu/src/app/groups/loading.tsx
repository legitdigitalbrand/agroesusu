export default function GroupsLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto animate-pulse">
      <div className="h-7 w-32 bg-brand-900 rounded-lg mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-brand-900 rounded-2xl h-48" />
        <div className="bg-brand-900 rounded-2xl h-48" />
      </div>
    </div>
  );
}
