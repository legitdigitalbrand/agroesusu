export const metadata = {
  title: "Offline — AgroEsusu",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-brand-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/15 flex items-center justify-center mx-auto mb-6">
          <span className="text-brand-400 font-bold text-2xl">A</span>
        </div>

        <h1 className="text-xl font-bold text-brand-50 mb-2">You're Offline</h1>
        <p className="text-sm text-brand-300/60 mb-6">
          No internet connection right now. Your savings data will sync once you're back online.
        </p>

        <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-5 text-left">
          <h2 className="text-sm font-semibold text-brand-200 mb-3">What you can still do:</h2>
          <ul className="space-y-2 text-xs text-brand-300/60">
            <li className="flex items-start gap-2">
              <span className="text-brand-500">✓</span>
              View your last loaded balance and pots
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500">✓</span>
              Browse cached transaction history
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500">✓</span>
              Check your group details
            </li>
          </ul>
          <p className="text-xs text-brand-300/40 mt-4 pt-4 border-t border-brand-500/10">
            Deposits and withdrawals require a connection.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full bg-brand-500 text-brand-950 py-3 rounded-lg font-semibold hover:bg-brand-400 transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
