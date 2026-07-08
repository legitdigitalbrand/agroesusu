import { CheckIcon } from "@/components/icons";

export const metadata = {
  title: "Offline — AgroEsusu",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface-base)" }}>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "var(--accent-subtle)" }}>
          <span className="font-bold text-2xl" style={{ color: "var(--accent)" }}>A</span>
        </div>

        <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>You&apos;re Offline</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          No internet connection right now. Your savings data will sync once you&apos;re back online.
        </p>

        <div className="rounded-xl p-5 text-left border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>What you can still do:</h2>
          <ul className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <li className="flex items-start gap-2">
              <CheckIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
              View your last loaded balance and pots
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
              Browse cached transaction history
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
              Check your group details
            </li>
          </ul>
          <p className="text-xs mt-4 pt-4 border-t" style={{ color: "var(--text-faint)", borderColor: "var(--border-subtle)" }}>
            Deposits and withdrawals require a connection.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full py-3 rounded-lg font-semibold transition"
          style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
