/**
 * Agriqcap — Central Brand Configuration
 *
 * Every screen, component, email, report, and metadata surface should
 * import from this file. No component should hardcode the product name.
 *
 * Rules:
 *  - Always render "Agriqcap" (never "AgriQCap", never "AGRIQCAP").
 *  - The "q" is a brand connector, not an abbreviation.
 */

export const BRAND = {
  name: "Agriqcap",
  shortName: "Agriqcap",
  tagline: "Save. Borrow. Grow Together.",
  description:
    "Agriqcap is a digital finance platform providing wallets, savings, and loans for Nigerian farmers and small businesses.",
  supportEmail: "support@agriqcap.com",
  infoEmail: "info@agriqcap.com",
  careersEmail: "careers@agriqcap.com",
  copyright: `© ${new Date().getFullYear()} Agriqcap. All rights reserved.`,
  legalName: "Agriqcap",
  // Theme
  themeColor: "#1B5E20",
  // Social / Open Graph
  ogTitle: "Agriqcap — Save. Borrow. Grow Together.",
  ogDescription:
    "Digital wallets, savings, and loans for Nigerian farmers and small businesses.",
  // PWA
  pwaName: "Agriqcap",
  pwaShortName: "Agriqcap",
  pwaDescription:
    "Save. Borrow. Grow Together. Digital finance for Nigerian agribusiness.",
} as const;
