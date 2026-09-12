/**
 * Country dialing codes for signup — defaults to Nigeria (+234).
 * Stored phone format is E.164 (e.g. +2348012345678) so SMS/OTP providers
 * can be used without reformatting later.
 */

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string; // with leading +
}

export const COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "CM", name: "Cameroon", dial: "+237" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225" },
  { code: "BJ", name: "Benin", dial: "+229" },
  { code: "TG", name: "Togo", dial: "+228" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Nigeria

/**
 * Normalise a typed local phone number to E.164 for the given country.
 * Nigeria: "08031234567" or "8031234567" → "+2348031234567".
 * Already-international input (starts with the dial code) is kept as-is.
 */
export function toE164(raw: string, country: Country): string {
  const digits = raw.replace(/\D/g, "");
  const cc = country.dial.replace("+", "");
  if (digits.startsWith(cc)) return `+${digits}`;
  if (country.code === "NG") {
    const national = digits.startsWith("0") ? digits.slice(1) : digits;
    return `+${cc}${national}`;
  }
  return `+${cc}${digits}`;
}

/**
 * Validate a typed local phone number for the given country.
 * Nigeria: 10 digits after the leading 0 (or 11 including it).
 */
export function isValidLocalPhone(raw: string, country: Country): boolean {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return false;
  if (country.code === "NG") {
    return /^(0?\d{10})$/.test(digits) && digits.replace(/^0/, "").length === 10;
  }
  return digits.length >= 6 && digits.length <= 15;
}
