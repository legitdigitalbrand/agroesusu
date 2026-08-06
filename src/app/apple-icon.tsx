import { ImageResponse } from 'next/og';

// Apple touch icon — 180x180, same LogoMark design on green background.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          borderRadius: '42px',
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: '16px solid #BBDC12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Inner dot */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#BBDC12',
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
