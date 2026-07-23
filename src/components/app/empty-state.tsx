import Link from 'next/link';

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 bg-cream rounded-full flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9h6v6H9z" />
        </svg>
      </div>
      <p className="font-medium text-gray-700">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-4 px-4 py-2 bg-forest-green text-white text-sm rounded-lg font-medium hover:bg-forest-green-dark transition">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
