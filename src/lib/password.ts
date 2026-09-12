/**
 * AgroPocket password policy — shared between signup and any future
 * change-password flows. Single source of truth for the 5 rules shown
 * live in the signup strength checker.
 */

export interface PasswordRule {
  id: keyof typeof ruleLabels;
  label: string;
  test: (pwd: string) => boolean;
}

export const ruleLabels = {
  length: "8 characters or more",
  upper: "An uppercase letter (A–Z)",
  lower: "A lowercase letter (a–z)",
  number: "A number (0–9)",
  special: "A special character (e.g. !@#$%)",
};

export const passwordRules: PasswordRule[] = [
  { id: "length", label: ruleLabels.length, test: (p) => p.length >= 8 },
  { id: "upper", label: ruleLabels.upper, test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: ruleLabels.lower, test: (p) => /[a-z]/.test(p) },
  { id: "number", label: ruleLabels.number, test: (p) => /[0-9]/.test(p) },
  { id: "special", label: ruleLabels.special, test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Returns the label of the first failing rule, or null when the password is valid. */
export function validatePassword(pwd: string): string | null {
  const failing = passwordRules.find((rule) => !rule.test(pwd));
  return failing ? `Password must contain ${failing.label.toLowerCase()}` : null;
}

/** Number of satisfied rules (0–5) for the strength meter. */
export function passwordStrength(pwd: string): number {
  return passwordRules.reduce((n, rule) => (rule.test(pwd) ? n + 1 : n), 0);
}
