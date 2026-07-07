import { ReactNode } from "react";

/**
 * Shared dark-green "hero" header used at the top of every main page
 * (Dashboard, Save, Groups, Transactions, Profile) so the app reads as
 * one consistent product instead of a single colorful page + plain white
 * everywhere else. Pair with <PageBody> for the overlapping white content
 * area below it.
 */
export function PageHero({ children, maxWidth = "max-w-5xl" }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div className="pt-12 lg:pt-10 pb-8 px-5 lg:px-8" style={{ background: "var(--hero-bg)" }}>
      <div className={`${maxWidth} mx-auto`}>{children}</div>
    </div>
  );
}

export function PageBody({ children, maxWidth = "max-w-5xl" }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div className="relative -mt-5 rounded-t-3xl pt-6 px-4 lg:px-8 pb-8" style={{ background: "var(--surface-base)" }}>
      <div className={`${maxWidth} mx-auto`}>{children}</div>
    </div>
  );
}
