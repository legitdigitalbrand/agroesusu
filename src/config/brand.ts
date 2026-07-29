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
    "Agriqcap is an enterprise digital cooperative finance platform providing digital wallets, savings, loans, investments, and cooperative banking for Nigerian farmers, cooperatives, and agribusinesses.",
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
    "Digital wallets, savings, loans, investments, and cooperative banking for Nigerian farmers and agribusinesses.",
  // PWA
  pwaName: "Agriqcap",
  pwaShortName: "Agriqcap",
  pwaDescription:
    "Save. Borrow. Grow Together. Digital cooperative finance for Nigerian agriculture.",
} as const;
