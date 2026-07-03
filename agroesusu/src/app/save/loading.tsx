export default function SaveLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto animate-pulse">
      <div className="h-7 w-40 bg-brand-900 rounded-lg mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-brand-900 rounded-2xl h-36" />
        <div className="bg-brand-900 rounded-2xl h-36" />
        <div className="bg-brand-900 rounded-2xl h-36" />
        <div className="bg-brand-900 rounded-2xl h-36" />
      </div>
    </div>
  );
}
