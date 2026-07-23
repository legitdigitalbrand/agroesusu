'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="p-4 bg-forest-green text-white rounded-lg hover:bg-forest-green-dark transition"
      title="Copy referral code"
    >
      {copied ? <Check size={20} /> : <Copy size={20} />}
    </button>
  );
}
