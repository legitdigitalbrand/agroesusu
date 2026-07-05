'use client';

import { useState } from 'react';
import { WhatsAppIcon, CopyIcon, CheckIcon, ShareIcon } from '@/components/icons';

export default function ShareGroupButton({
  groupName,
  contributionAmount,
  frequency,
  inviteToken,
  groupId,
}: {
  groupName: string;
  contributionAmount: number;
  frequency: string;
  inviteToken: string;
  groupId: string;
}) {
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://agroesusu.vercel.app';
  const inviteUrl = `${baseUrl}/groups/${groupId}?invite=${inviteToken}`;

  const whatsappMessage = `I've created an AgroEsusu savings group: ${groupName}. We contribute ₦${contributionAmount.toLocaleString()} ${frequency}. Join here: ${inviteUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName} on AgroEsusu`,
          text: whatsappMessage,
          url: inviteUrl,
        });
      } catch {
        // User cancelled — no action needed
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition"
        style={{ background: "#25D366", color: "#fff" }}
      >
        <WhatsAppIcon className="w-4 h-4" />
        Share to WhatsApp
      </a>

      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition"
        style={{ background: "var(--surface-card)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
      >
        {copied ? <CheckIcon className="w-4 h-4" style={{ color: "var(--accent)" }} /> : <CopyIcon className="w-4 h-4" />}
        {copied ? 'Copied!' : 'Copy Link'}
      </button>

      {typeof navigator !== 'undefined' && navigator.share && (
        <button
          onClick={handleNativeShare}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg border transition"
          style={{ background: "var(--surface-card)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          aria-label="Share"
        >
          <ShareIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
