"use client";

import { useRef, useState, useEffect } from "react";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
  length?: number;
}

export function PinInput({ value, onChange, autoFocus = true, disabled, error, length = 4 }: PinInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [localValues, setLocalValues] = useState<string[]>(Array(length).fill(""));

  useEffect(() => {
    const chars = value.split("");
    setLocalValues(Array.from({ length }, (_, i) => chars[i] || ""));
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputs.current[0]) {
      inputs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, char: string) => {
    char = char.replace(/\D/g, "").slice(-1);
    if (!char) return;

    const newValues = [...localValues];
    newValues[index] = char;
    setLocalValues(newValues);
    onChange(newValues.join(""));

    if (index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (localValues[index]) {
        const newValues = [...localValues];
        newValues[index] = "";
        setLocalValues(newValues);
        onChange(newValues.join(""));
      } else if (index > 0) {
        inputs.current[index - 1]?.focus();
        const newValues = [...localValues];
        newValues[index - 1] = "";
        setLocalValues(newValues);
        onChange(newValues.join(""));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    const newValues = Array.from({ length }, (_, i) => pasted[i] || "");
    setLocalValues(newValues);
    onChange(newValues.join(""));
    const lastFilled = Math.min(pasted.length, length) - 1;
    inputs.current[lastFilled]?.focus();
  };

  return (
    <div className="flex gap-3 sm:gap-4 justify-center" onPaste={handlePaste}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          data-lpignore="1"
          data-1p-ignore
          pattern="[0-9]*"
          maxLength={1}
          value={localValues[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className={`w-16 h-20 text-center text-[28px] font-mono font-bold rounded-[14px] border-2 transition-all outline-none
            ${error
              ? "border-clay bg-clay/5 text-clay animate-shake"
              : localValues[i]
                ? "border-ochre bg-ochre/5 text-ink"
                : "border-ink/10 bg-white text-ink"
            }
            focus:border-ochre focus:ring-2 focus:ring-ochre/20
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />
      ))}
    </div>
  );
}
