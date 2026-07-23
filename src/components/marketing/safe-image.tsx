'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * Image component with graceful fallback.
 * If the external image fails to load (404, expired URL, etc.),
 * it hides the broken img and shows a branded gradient block instead.
 */
export default function SafeImage({
  src,
  alt,
  className,
  fill,
  sizes,
  priority,
  gradient = 'from-forest-green to-forest-green-dark',
}: {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  gradient?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}
        aria-label={alt}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeOpacity="0.4" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      sizes={sizes}
      priority={priority}
      onError={() => setErrored(true)}
    />
  );
}
