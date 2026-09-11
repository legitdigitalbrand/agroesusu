/**
 * AgroPocket — Central Brand Configuration
 *
 * Every screen, component, email, report, and metadata surface should
 * import from this file. No component should hardcode the product name.
 *
 * Rules:
 *  - Customer-facing product name: "AgroPocket".
 *  - Registered legal business: "Agro Pocket Limited" (legalName, copyright).
 *  - Email addresses stay on @agriqcap.com until the agropocket.com domain is
 *    purchased and verified (EMAIL DOMAIN MIGRATION REQUIRED — tracked in
 *    AGROPOCKET_REBRAND_PLAN.md).
 */

export const BRAND = {
  name: "AgroPocket",
  shortName: "AgroPocket",
  tagline: "Save. Borrow. Grow Together.",
  description:
    "AgroPocket is a digital finance platform providing wallets, savings, and loans for Nigerian farmers and small businesses.",
  supportEmail: "support@agriqcap.com",
  infoEmail: "info@agriqcap.com",
  careersEmail: "careers@agriqcap.com",
  copyright: `© ${new Date().getFullYear()} Agro Pocket Limited. All rights reserved.`,
  legalName: "Agro Pocket Limited",
  // Theme
  themeColor: "#1B5E20",
  // Social / Open Graph
  ogTitle: "AgroPocket — Save. Borrow. Grow Together.",
  ogDescription:
    "Digital wallets, savings, and loans for Nigerian farmers and small businesses.",
  // PWA
  pwaName: "AgroPocket",
  pwaShortName: "AgroPocket",
  pwaDescription:
    "Save. Borrow. Grow Together. Digital finance for Nigerian agribusiness.",
} as const;
