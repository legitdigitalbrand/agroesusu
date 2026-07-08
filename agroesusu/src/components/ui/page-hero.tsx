import { ReactNode } from "react";

/**
 * Shared dark-green "hero" header used at the top of every main page
 * (Dashboard, Save, Groups, Transactions, Profile) so the app reads as
 * one consistent product instead of a single colorful page + plain white
 * everywhere else. Pair with <PageBody> for the canvas-colored content
 * section directly below it.
 *
 * The gradient blends the SAME two brand greens used by the nav/sidebar
 * (anchor-light -> anchor, see globals.css --hero-gradient) — no third
 * off-hue shade — so the hero, chrome and background all read as one
 * continuous palette instead of clashing.
 *
 * IMPORTANT: PageHero and PageBody are two clean, full-width, stacked
 * sections in normal document flow. Neither overlaps the other — no
 * negative margin, no rounded corner cutting into the section above.
 * Do not reintroduce that pattern.
 */
export function PageHero({ children, maxWidth = "max-w-5xl" }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div className="pt-12 lg:pt-10 pb-8 px-5 lg:px-8" style={{ background: "var(--hero-gradient)" }}>
      <div className={`${maxWidth} mx-auto`}>{children}</div>
    </div>
  );
}

export function PageBody({ children, maxWidth = "max-w-5xl" }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div className="pt-7 px-4 lg:px-8 pb-8" style={{ background: "var(--surface-base)" }}>
      <div className={`${maxWidth} mx-auto`}>{children}</div>
    </div>
  );
}
