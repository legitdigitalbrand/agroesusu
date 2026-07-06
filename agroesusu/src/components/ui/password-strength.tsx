'use client';

import { CheckIcon } from '@/components/icons';

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

const rules: Rule[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
];

export function getPasswordScore(pw: string) {
  return rules.filter((r) => r.test(pw)).length;
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const score = getPasswordScore(password);
  const levels = [
    { label: 'Weak', color: 'var(--danger)' },
    { label: 'Fair', color: 'var(--color-brand-gold)' },
    { label: 'Good', color: 'var(--color-brand-gold)' },
    { label: 'Strong', color: 'var(--accent)' },
  ];
  const level = levels[score];

  return (
    <div className="mt-2.5">
      <div className="flex gap-1.5 mb-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-200"
            style={{ background: i < score ? level.color : 'var(--border-default)' }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {rules.map((rule) => {
          const passed = rule.test(password);
          return (
            <div key={rule.label} className="flex items-center gap-1">
              <span
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                style={{ background: passed ? 'var(--accent-subtle)' : 'var(--border-subtle)' }}
              >
                {passed && <CheckIcon className="w-2.5 h-2.5" style={{ color: 'var(--accent)' }} strokeWidth={3} />}
              </span>
              <span
                className="text-[11px]"
                style={{ color: passed ? 'var(--text-secondary)' : 'var(--text-faint)' }}
              >
                {rule.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
