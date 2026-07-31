# Color Design System Audit Report

**Target Repo:** `/app/agroesusu-repo`  
**Scope:** All `.tsx`, `.ts`, and `.css` files under `src/`  

## Executive Summary

This audit checks the Agriqcap Next.js application codebase for unapproved hardcoded colors, arbitrary Tailwind colors, inline style declarations, and contrast violations according to the designated design system tokens.

### Approved Design Tokens (`tailwind.config.ts`)
| Token Name | Approved Hex Value | Description / Usage |
| --- | --- | --- |
| `indigo` | `#1B5E20` | Primary brand color |
| `indigo-deep` | `#123D15` | Deep green background / heavy emphasis |
| `indigo-light` | `#2E7D32` | Light indigo green tint |
| `ochre` | `#BBDC12` | Accent / highlight yellow-green |
| `ochre-light` | `#EEF6C4` | Very pale ochre chip backgrounds |
| `ochre-dim` | `#9CB810` | Muted ochre |
| `loam` | `#3E8E2F` | Success green |
| `loam-light` | `#DCEEDC` | Pale loam icon backgrounds & success tints |
| `loam-dim` | `#2D6B22` | Muted loam |
| `clay` | `#B23A2E` | Error / alert red |
| `clay-light` | `#F3DCD8` | Pale clay error tint |
| `clay-dim` | `#8A2D24` | Muted clay |
| `parchment` | `#E8F5E9` | Lightest green-tinted page background |
| `paper` | `#FBFDF9` | Near-white surface background |
| `ink` | `#1A2417` | Very dark green-black text |
| `ink-soft` | `#5C6B57` | Mid-tone muted body text |
| `track` | `#D9E9D2` | Progress ring track / subtle dividers |
| `line` | `#D6E8D2` | Border / separator |

> **Rules Note:** White, black, and standard Tailwind palette colors (e.g., `green`, `emerald`, `lime`, `teal`, `gray`, `red`, etc.) are **not approved** as token replacements. Hardcoded hex values are violations—whether they match approved token hexes or unapproved hex values.

### Audit Summary Findings
- **1. Hardcoded Hex Colors:** 49 instances
- **2. Arbitrary Green Shades Not in Token System:** 16 instances
- **3. `text-white` on Light Backgrounds:** 9 instances
- **4. `bg-white` with `text-white` Children:** 6 instances
- **5. Inline Styles with Color Values:** 4 instances

---

## 1. Hardcoded Hex Colors
Hardcoded hex codes found in className strings, style attributes, inline SVG parameters, CSS rules, or TypeScript constants.

| File Path | Line | Offending Value | Approved Token Match? | Context |
| --- | --- | --- | --- | --- |
| `src/app/globals.css` | 9 | `#E8F5E9` | Matches `parchment` | `--background: 120 30% 96%;      /* parchment #E8F5E9 */` |
| `src/app/globals.css` | 10 | `#1A2417` | Matches `ink` | `--foreground: 130 16% 12%;      /* ink #1A2417 */` |
| `src/app/globals.css` | 11 | `#FBFDF9` | Matches `paper` | `--card: 120 40% 99%;            /* paper #FBFDF9 */` |
| `src/app/globals.css` | 15 | `#1B5E20` | Matches `indigo` | `--primary: 123 55% 24%;         /* indigo #1B5E20 */` |
| `src/app/globals.css` | 20 | `#5C6B57` | Matches `ink-soft` | `--muted-foreground: 120 8% 40%; /* ink-soft #5C6B57 */` |
| `src/app/globals.css` | 21 | `#BBDC12` | Matches `ochre` | `--accent: 71 80% 46%;           /* ochre #BBDC12 */` |
| `src/app/globals.css` | 23 | `#B23A2E` | Matches `clay` | `--destructive: 5 57% 44%;       /* clay #B23A2E */` |
| `src/app/globals.css` | 25 | `#D6E8D2` | Matches `line` | `--border: 120 28% 84%;          /* line #D6E8D2 */` |
| `src/app/globals.css` | 149 | `#E5E7E5` | **UNAPPROVED HEX** | `border: 1px solid #E5E7E5;` |
| `src/app/globals.css` | 150 | `#FBFCFB` | **UNAPPROVED HEX** | `background: #FBFCFB;` |
| `src/app/globals.css` | 153 | `#1A2E1A` | **UNAPPROVED HEX** | `color: #1A2E1A;` |
| `src/app/globals.css` | 160 | `#1B5E20` | Matches `indigo` | `border-color: #1B5E20;` |
| `src/app/globals.css` | 164 | `#7B8B7B` | **UNAPPROVED HEX** | `color: #7B8B7B;` |
| `src/app/globals.css` | 178 | `#F4FAF4` | **UNAPPROVED HEX** | `background: #F4FAF4;` |
| `src/app/globals.css` | 179 | `#E0EBDC` | **UNAPPROVED HEX** | `border: 1.5px solid #E0EBDC;` |
| `src/app/globals.css` | 184 | `#1A2417` | Matches `ink` | `color: #1A2417;` |
| `src/app/globals.css` | 191 | `#8A9985` | **UNAPPROVED HEX** | `color: #8A9985;` |
| `src/app/globals.css` | 195 | `#1B5E20` | Matches `indigo` | `border-color: #1B5E20;` |
| `src/app/globals.css` | 196 | `#FFFFFF` | **UNAPPROVED HEX** | `background: #FFFFFF;` |
| `src/app/globals.css` | 200 | `#3E8E2F` | Matches `loam` | `border-color: #3E8E2F;` |
| `src/app/globals.css` | 201 | `#F8FCF7` | **UNAPPROVED HEX** | `background: #F8FCF7;` |
| `src/app/globals.css` | 211 | `#D6E8D2` | Matches `line` | `border-color: #D6E8D2;` |
| `src/components/app/savings-chart.tsx` | 108 | `#1B5E20` | Matches `indigo` | `<stop offset="5%" stopColor="#1B5E20" stopOpacity={0.25} />` |
| `src/components/app/savings-chart.tsx` | 109 | `#1B5E20` | Matches `indigo` | `<stop offset="95%" stopColor="#1B5E20" stopOpacity={0.0} />` |
| `src/components/app/savings-chart.tsx` | 112 | `#E5E7EB` | **UNAPPROVED HEX** | `<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />` |
| `src/components/app/savings-chart.tsx` | 117 | `#6B7280` | **UNAPPROVED HEX** | `tick={{ fontSize: 11, fill: "#6B7280" }}` |
| `src/components/app/savings-chart.tsx` | 122 | `#6B7280` | **UNAPPROVED HEX** | `tick={{ fontSize: 11, fill: "#6B7280" }}` |
| `src/components/app/savings-chart.tsx` | 128 | `#FFFFFF` | **UNAPPROVED HEX** | `backgroundColor: "#FFFFFF",` |
| `src/components/app/savings-chart.tsx` | 130 | `#F3F4F6` | **UNAPPROVED HEX** | `border: "1px solid #F3F4F6",` |
| `src/components/app/savings-chart.tsx` | 134 | `#111827` | **UNAPPROVED HEX** | `labelStyle={{ fontWeight: "600", color: "#111827" }}` |
| `src/components/app/savings-chart.tsx` | 139 | `#1B5E20` | Matches `indigo` | `stroke="#1B5E20"` |
| `src/components/auth/AuthLayout.tsx` | 31 | `#FBFDF9` | Matches `paper` | `style={{ background: "#FBFDF9" }}` |
| `src/components/auth/FloatingCards.tsx` | 130 | `#123D15` | Matches `indigo-deep` | `background: bar.active ? "#123D15" : "rgba(18,61,21,0.25)",` |
| `src/components/auth/PrimaryButton.tsx` | 18 | `#C8E84A` | **UNAPPROVED HEX** | `backgroundColor: "#C8E84A",` |
| `src/components/auth/RightPanel.tsx` | 12 | `#1B5E20` | Matches `indigo` | `background: "linear-gradient(145deg, #1B5E20 0%, #123D15 100%)",` |
| `src/components/auth/RightPanel.tsx` | 12 | `#123D15` | Matches `indigo-deep` | `background: "linear-gradient(145deg, #1B5E20 0%, #123D15 100%)",` |
| `src/components/auth/RightPanel.tsx` | 100 | `#1B5E20` | Matches `indigo` | `background: "linear-gradient(145deg, #1B5E20 0%, #123D15 100%)",` |
| `src/components/auth/RightPanel.tsx` | 100 | `#123D15` | Matches `indigo-deep` | `background: "linear-gradient(145deg, #1B5E20 0%, #123D15 100%)",` |
| `src/components/auth/RightPanel.tsx` | 171 | `#123D15` | Matches `indigo-deep` | `<path d="M7 2v10M4 5h5a1.5 1.5 0 010 3H6" stroke="#123D15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />` |
| `src/components/auth/RightPanel.tsx` | 179 | `#123D15` | Matches `indigo-deep` | `<circle cx="7" cy="7" r="5" stroke="#123D15" strokeWidth="1.5" />` |
| `src/components/auth/RightPanel.tsx` | 180 | `#123D15` | Matches `indigo-deep` | `<path d="M7 4v3l2 1" stroke="#123D15" strokeWidth="1.5" strokeLinecap="round" />` |
| `src/components/auth/RightPanel.tsx` | 188 | `#123D15` | Matches `indigo-deep` | `<path d="M2 10l3-3 2.5 2.5L11 4" stroke="#123D15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />` |
| `src/components/yield/index.tsx` | 15 | `#1B5E20` | Matches `indigo` | `const ringColor = variant === "customer" ? "#1B5E20" : "#F5F1E8";` |
| `src/components/yield/index.tsx` | 15 | `#F5F1E8` | **UNAPPROVED HEX** | `const ringColor = variant === "customer" ? "#1B5E20" : "#F5F1E8";` |
| `src/components/yield/index.tsx` | 16 | `#BBDC12` | Matches `ochre` | `const dotColor = variant === "customer" ? "#BBDC12" : "#3E8E2F";` |
| `src/components/yield/index.tsx` | 16 | `#3E8E2F` | Matches `loam` | `const dotColor = variant === "customer" ? "#BBDC12" : "#3E8E2F";` |
| `src/components/yield/index.tsx` | 102 | `#E8E4D9` | **UNAPPROVED HEX** | `stroke="#E8E4D9"` |
| `src/components/yield/index.tsx` | 111 | `#BBDC12` | Matches `ochre` | `stroke="#BBDC12"` |
| `src/config/brand.ts` | 24 | `#1B5E20` | Matches `indigo` | `themeColor: "#1B5E20",` |

## 2. Arbitrary Green Shades Not in the Token System
Standard Tailwind green/emerald/lime/teal utilities that bypass the custom Agriqcap token system.

| File Path | Line | Offending Value | Context |
| --- | --- | --- | --- |
| `src/app/(marketing)/about/page.tsx` | 34 | `bg-emerald-100` | `color: 'bg-emerald-100 text-emerald-800',` |
| `src/app/(marketing)/about/page.tsx` | 34 | `text-emerald-800` | `color: 'bg-emerald-100 text-emerald-800',` |
| `src/app/(marketing)/blog/page.tsx` | 18 | `bg-emerald-50` | `bg: 'bg-emerald-50 text-emerald-800',` |
| `src/app/(marketing)/blog/page.tsx` | 18 | `text-emerald-800` | `bg: 'bg-emerald-50 text-emerald-800',` |
| `src/app/(marketing)/contact/page.tsx` | 125 | `bg-emerald-100` | `<div className="bg-emerald-100 text-emerald-700 h-16 w-14 rounded-full flex items-center justify-center mx-auto">` |
| `src/app/(marketing)/contact/page.tsx` | 125 | `text-emerald-700` | `<div className="bg-emerald-100 text-emerald-700 h-16 w-14 rounded-full flex items-center justify-center mx-auto">` |
| `src/app/(marketing)/features/page.tsx` | 19 | `bg-emerald-50` | `color: 'bg-emerald-50 text-emerald-800 border-emerald-100',` |
| `src/app/(marketing)/features/page.tsx` | 19 | `text-emerald-800` | `color: 'bg-emerald-50 text-emerald-800 border-emerald-100',` |
| `src/app/(marketing)/features/page.tsx` | 19 | `border-emerald-100` | `color: 'bg-emerald-50 text-emerald-800 border-emerald-100',` |
| `src/app/(marketing)/loan-plans/page.tsx` | 14 | `bg-emerald-100` | `iconBg: 'bg-emerald-100 text-emerald-800',` |
| `src/app/(marketing)/loan-plans/page.tsx` | 14 | `text-emerald-800` | `iconBg: 'bg-emerald-100 text-emerald-800',` |
| `src/app/(marketing)/savings-plans/page.tsx` | 13 | `bg-emerald-50` | `color: 'bg-emerald-50 text-emerald-800 border-emerald-100',` |
| `src/app/(marketing)/savings-plans/page.tsx` | 13 | `text-emerald-800` | `color: 'bg-emerald-50 text-emerald-800 border-emerald-100',` |
| `src/app/(marketing)/savings-plans/page.tsx` | 13 | `border-emerald-100` | `color: 'bg-emerald-50 text-emerald-800 border-emerald-100',` |
| `src/app/(marketing)/savings-plans/page.tsx` | 14 | `bg-emerald-100` | `iconColor: 'bg-emerald-100 text-emerald-700',` |
| `src/app/(marketing)/savings-plans/page.tsx` | 14 | `text-emerald-700` | `iconColor: 'bg-emerald-100 text-emerald-700',` |

## 3. `text-white` on Light Backgrounds
Contrast violations where `text-white` or `text-white/*` is rendered over light backgrounds (e.g., `bg-parchment`, `bg-paper`, light opacity overlays).

| File Path | Line | Offending Value | Context |
| --- | --- | --- | --- |
| `src/app/(app)/notifications/page.tsx` | 117 | `text-white on bg-parchment` | `filter === "all" ? "bg-indigo text-white" : "bg-parchment text-ink-soft"` |
| `src/app/(app)/notifications/page.tsx` | 125 | `text-white on bg-parchment` | `filter === "unread" ? "bg-indigo text-white" : "bg-parchment text-ink-soft"` |
| `src/app/(app)/wallet/withdraw/page.tsx` | 177 | `text-white on bg-parchment` | `<div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${active ? "bg-indigo text-white" : "bg-parchment text-ink-soft"}`}>` |
| `src/app/(auth)/welcome/page.tsx` | 76 | `text-white on bg-paper` | `className="block text-center bg-transparent text-white/90 font-medium text-[15px] py-3 rounded-[14px] border-[1.4px] border-white/40 transition hover:bg-paper/5"` |
| `src/app/dev/layout.tsx` | 101 | `text-white on bg-paper` | `: "text-white/50 hover:text-white hover:bg-paper/5"` |
| `src/app/dev/layout.tsx` | 115 | `text-white on bg-paper` | `className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-paper/5 w-full transition"` |
| `src/app/dev/layout.tsx` | 149 | `text-white on bg-paper` | `className="h-9 w-9 rounded-lg bg-paper/10 flex items-center justify-center text-white/70 hover:text-white"` |
| `src/app/dev/layout.tsx` | 169 | `text-white on bg-paper` | `: "text-white/50 hover:text-white hover:bg-paper/5"` |
| `src/app/dev/layout.tsx` | 183 | `text-white on bg-paper` | `className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-paper/5 w-full transition min-h-[44px]"` |

## 4. `bg-white` with `text-white` Children
Parent containers using `bg-white` (or `bg-white/*`) that encompass child/descendant elements styled with `text-white`.

| File Path | Parent Line / Child Line | Offending Value | Context |
| --- | --- | --- | --- |
| `src/components/auth/FloatingCards.tsx` | Parent L46 -> Child L56 | `bg-white container with text-white child` | `Parent L46: className="rounded-2xl p-5 backdrop-blur-xl bg-white/10 border border-white/20 w-full max-w-[210px] relative" \| Child L56: <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/55 mb-1 relative">` |
| `src/components/auth/FloatingCards.tsx` | Parent L46 -> Child L59 | `bg-white container with text-white child` | `Parent L46: className="rounded-2xl p-5 backdrop-blur-xl bg-white/10 border border-white/20 w-full max-w-[210px] relative" \| Child L59: <div className="font-mono text-[22px] font-semibold text-white mb-3 relative">` |
| `src/components/auth/FloatingCards.tsx` | Parent L178 -> Child L180 | `bg-white container with text-white child` | `Parent L178: className="rounded-xl p-3.5 backdrop-blur-xl bg-white/10 border border-white/15 w-full max-w-[200px] relative" \| Child L180: <p className="text-[11px] text-white/80 leading-relaxed italic mb-2">` |
| `src/components/auth/FloatingCards.tsx` | Parent L178 -> Child L183 | `bg-white container with text-white child` | `Parent L178: className="rounded-xl p-3.5 backdrop-blur-xl bg-white/10 border border-white/15 w-full max-w-[200px] relative" \| Child L183: <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/50">` |
| `src/components/auth/FloatingCards.tsx` | Parent L207 -> Child L213 | `bg-white container with text-white child` | `Parent L207: className="flex items-center gap-3 rounded-xl p-3 bg-white/8 border border-white/12 w-full max-w-[220px]" \| Child L213: <div className="font-display text-[12px] font-bold text-white">{title}</div>` |
| `src/components/auth/FloatingCards.tsx` | Parent L207 -> Child L214 | `bg-white container with text-white child` | `Parent L207: className="flex items-center gap-3 rounded-xl p-3 bg-white/8 border border-white/12 w-full max-w-[220px]" \| Child L214: <div className="text-[10px] text-white/50">{subtitle}</div>` |

## 5. Inline Styles with Color Values
Inline JSX `style={{ ... }}` attributes setting color, background, or border properties directly instead of using Tailwind design token utility classes.

| File Path | Line | Offending Value | Context |
| --- | --- | --- | --- |
| `src/app/(auth)/login/page.tsx` | 206 | `inline style with color property` | `<div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--color-parchment) / 1)" }}>` |
| `src/app/(auth)/login/page.tsx` | 348 | `inline style with color property` | `<div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--color-parchment) / 1)" }}>` |
| `src/app/(auth)/verify-email/page.tsx` | 71 | `inline style with color property` | `<div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--color-parchment) / 1)" }}>` |
| `src/components/auth/AuthLayout.tsx` | 31 | `inline style with color property` | `style={{ background: "#FBFDF9" }}` |

