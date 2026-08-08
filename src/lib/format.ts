/**
 * formatNaira — formats a number as a Naira currency string.
 *
 * NOTE: We deliberately do NOT use Intl.NumberFormat with style: "currency"
 * because that produces the ₦ symbol inline with the digits. IBM Plex Mono
 * (our brand mono font, loaded via Google Fonts) does not include the ₦ glyph
 * (U+20A6) in its latin/latin-ext subsets, causing the browser to fall back
 * to a system font for just that character and creating visual overlap.
 *
 * Instead, we format the number separately and prepend "₦" as a string.
 * The CSS `.naira-symbol` class (applied via MoneyText component) ensures the
 * ₦ glyph uses a fallback font with proper metrics.
 *
 * For JSX/React usage, prefer the <MoneyText> component which handles this
 * with proper spans. Use formatNaira for non-JSX contexts (API responses,
 * chart formatters, tooltips, etc.).
 */
export function formatNaira(amount: number): string {
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return `${amount < 0 ? "-₦" : "₦"}${formatted}`;
}

export function formatNumber(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return "—";
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(parsed);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function calculateProgress(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
