import { ReactNode } from "react";

/**
 * Shared dark-green "hero" header used at the top of every main page
 * (Dashboard, Save, Groups, Transactions, Profile) so the app reads as
 * one consistent product instead of a single colorful page + plain white
 * everywhere else. Pair with <PageBody> for the overlapping white content
 * area below it.
 *
 * The gradient blends the SAME two brand greens used by the nav/sidebar
 * (#014D15 -> #001907) — no third off-hue shade — so the hero, chrome and
 * background all read as one continuous palette instead of clashing.
 */
export function PageHero({ children, maxWidth = "max-w-5xl" }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div className="pt-12 lg:pt-10 pb-10 px-5 lg:px-8" style={{ background: "var(--hero-gradient)" }}>
      <div className={`${maxWidth} mx-auto`}>{children}</div>
    </div>
  );
}

export function PageBody({ children, maxWidth = "max-w-5xl" }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div className="relative -mt-8 rounded-t-[2.5rem] lg:rounded-t-3xl pt-7 px-4 lg:px-8 pb-8" style={{ background: "var(--surface-base)" }}>
      <div className={`${maxWidth} mx-auto`}>{children}</div>
    </div>
  );
}
