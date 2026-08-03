import { ImageResponse } from 'next/og';

// App Router favicon — generates /icon at build time.
// Replaces the missing /favicon.ico that was 404'ing in console.
// Uses the same design as public/favicon.svg: green rounded square + ochre "A".

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1B5E20',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: 700,
          color: '#BBDC12',
          fontFamily: 'Georgia, serif',
        }}
      >
        A
      </div>
    ),
    { ...size }
  );
}
