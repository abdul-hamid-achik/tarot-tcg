import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Tarot TCG - Strategic Card Game'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b0618 0%, #1a0a2e 40%, #0d1a2e 70%, #0b0618 100%)',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Decorative corner symbols */}
        {[
          { top: 40, left: 60, sym: '☽', size: 56, opacity: 0.15 },
          { top: 40, right: 60, sym: '☆', size: 56, opacity: 0.15 },
          { bottom: 40, left: 60, sym: '♦', size: 48, opacity: 0.12 },
          { bottom: 40, right: 60, sym: '◇', size: 48, opacity: 0.12 },
          { top: 160, left: 120, sym: '△', size: 36, opacity: 0.08 },
          { top: 160, right: 120, sym: '○', size: 36, opacity: 0.08 },
          { bottom: 160, left: 120, sym: '✦', size: 32, opacity: 0.08 },
          { bottom: 160, right: 120, sym: '✧', size: 32, opacity: 0.08 },
        ].map((el, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: el.top,
              left: el.left,
              bottom: el.bottom,
              right: el.right,
              fontSize: el.size,
              opacity: el.opacity,
              color: '#c8a8e8',
              display: 'flex',
            }}
          >
            {el.sym}
          </div>
        ))}

        {/* Glowing orb background effect */}
        <div
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(120,60,200,0.15) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0px',
            zIndex: 1,
          }}
        >
          {/* Icon */}
          <div
            style={{
              fontSize: '80px',
              marginBottom: '12px',
              display: 'flex',
              filter: 'drop-shadow(0 0 20px rgba(180,120,255,0.6))',
            }}
          >
            ⚡
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '88px',
              fontWeight: 'bold',
              color: '#e8c97e',
              letterSpacing: '-2px',
              lineHeight: 1,
              display: 'flex',
              textShadow: '0 0 40px rgba(232,201,126,0.4)',
            }}
          >
            Tarot TCG
          </div>

          {/* Divider line */}
          <div
            style={{
              width: '320px',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(180,120,255,0.6), transparent)',
              margin: '20px 0',
              display: 'flex',
            }}
          />

          {/* Subtitle */}
          <div
            style={{
              fontSize: '30px',
              color: '#b89cd8',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Strategic Card Game
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '40px',
              marginTop: '28px',
            }}
          >
            {[
              { label: '78 Cards', sym: '◈' },
              { label: '12 Zodiac Classes', sym: '✦' },
              { label: 'Ancient Wisdom', sym: '☽' },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#7a6a9a',
                  fontSize: '20px',
                }}
              >
                <span style={{ color: '#9d7ac8', display: 'flex' }}>{item.sym}</span>
                <span style={{ display: 'flex' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            fontSize: '18px',
            color: '#4a3a6a',
            letterSpacing: '2px',
            display: 'flex',
          }}
        >
          tarot-tcg.com
        </div>
      </div>
    ),
    { ...size },
  )
}
