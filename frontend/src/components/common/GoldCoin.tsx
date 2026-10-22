import React, { useId } from 'react'

export interface GoldCoinProps {
  size?: number | string
  className?: string
  style?: React.CSSProperties
  animate?: boolean
}

export default function GoldCoin({
  size = 20,
  className = '',
  style = {},
  animate = false,
}: GoldCoinProps) {
  const rawId = useId()
  const id = 'gold_coin_' + rawId.replace(/[^a-zA-Z0-9]/g, '')

  const pixelSize = typeof size === 'number' ? `${size}px` : size

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`gold-coin-svg ${animate ? 'animate-coin-flip' : ''} ${className}`.trim()}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      aria-label="Gold Coin"
      role="img"
    >
      <defs>
        {/* Top face metallic gold radial reflection */}
        <radialGradient id={`${id}_top`} cx="42%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFDE0" />
          <stop offset="25%" stopColor="#FEE56C" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="85%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </radialGradient>

        {/* 3D Cylinder side edge metallic gradient */}
        <linearGradient id={`${id}_side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#B45309" />
          <stop offset="20%" stopColor="#F59E0B" />
          <stop offset="45%" stopColor="#FEF08A" />
          <stop offset="70%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>

        {/* Outer rim chamfer */}
        <linearGradient id={`${id}_rim_bevel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFDF0" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        {/* 3D Star Facets Lighting */}
        <linearGradient id={`${id}_star_light`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FDE047" />
        </linearGradient>
        <linearGradient id={`${id}_star_dark`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#EA580C" />
          <stop offset="100%" stopColor="#7C2D12" />
        </linearGradient>

        {/* Diagonal Gloss Sweep */}
        <linearGradient id={`${id}_sheen`} x1="0" y1="0" x2="1" y2="0.8">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ambient Ground Shadow */}
      <path
        d="M6 37 C6 50 17.6 60 32 60 C46.4 60 58 50 58 37 C58 51.5 46.4 62 32 62 C17.6 62 6 51.5 6 37 Z"
        fill="#261201"
        opacity="0.5"
      />

      {/* 3D Coin Cylinder Side Edge (Physical thickness) */}
      <path
        d="M6 31 C6 44 17.6 54 32 54 C46.4 54 58 44 58 31 L58 37 C58 50 46.4 60 32 60 C17.6 60 6 50 6 37 Z"
        fill={`url(#${id}_side)`}
      />

      {/* Ribbed Milling / Reeded Edge Grooves on Side Cylinder */}
      <g stroke="#78350F" strokeWidth="1.2" opacity="0.6" strokeLinecap="round">
        <path d="M14 41 L14 47 M22 47 L22 53 M32 49 L32 55 M42 47 L42 53 M50 41 L50 47" />
      </g>

      {/* Top Coin Face Disc */}
      <ellipse
        cx="32"
        cy="31"
        rx="26"
        ry="23"
        fill={`url(#${id}_top)`}
        stroke={`url(#${id}_rim_bevel)`}
        strokeWidth="1.5"
      />

      {/* Beaded Dentil Pearl Ring (Hallmark of minted coins) */}
      <ellipse
        cx="32"
        cy="31"
        rx="22.5"
        ry="19.5"
        fill="none"
        stroke="#78350F"
        strokeWidth="1.8"
        opacity="0.45"
      />
      <ellipse
        cx="32"
        cy="31"
        rx="22.5"
        ry="19.5"
        fill="none"
        stroke="#FFF7B2"
        strokeWidth="1.4"
        strokeDasharray="0.01 3.2"
        strokeLinecap="round"
      />

      {/* Inner Recessed Basin */}
      <ellipse cx="32" cy="31" rx="19" ry="16.5" fill="#B45309" />
      <ellipse cx="32" cy="30.5" rx="18.5" ry="16" fill={`url(#${id}_top)`} />
      <ellipse
        cx="32"
        cy="30.5"
        rx="17"
        ry="14.5"
        fill="none"
        stroke="#FFF9C4"
        strokeWidth="0.8"
        opacity="0.7"
      />

      {/* Stamped 3D Relief Star (Faceted Lighting + Drop Shadow) */}
      <g transform="translate(0, -1)">
        {/* Star Stamped Inset Shadow */}
        <path
          d="M32 19.5 L34.5 27 L42.5 27.5 L36 32.5 L38 40 L32 36 L26 40 L28 32.5 L21.5 27.5 L29.5 27 Z"
          fill="#5A2200"
          opacity="0.5"
        />

        {/* 10-Facet 3D Star */}
        {/* Top Point */}
        <polygon points="32,30 29.5,25.5 32,18" fill={`url(#${id}_star_light)`} />
        <polygon points="32,30 32,18 34.5,25.5" fill={`url(#${id}_star_dark)`} />

        {/* Top-Right Point */}
        <polygon points="32,30 34.5,25.5 42,26" fill={`url(#${id}_star_light)`} />
        <polygon points="32,30 42,26 36,31" fill={`url(#${id}_star_dark)`} />

        {/* Bottom-Right Point */}
        <polygon points="32,30 36,31 38,38.5" fill={`url(#${id}_star_light)`} />
        <polygon points="32,30 38,38.5 32,34.5" fill={`url(#${id}_star_dark)`} />

        {/* Bottom-Left Point */}
        <polygon points="32,30 32,34.5 26,38.5" fill={`url(#${id}_star_light)`} />
        <polygon points="32,30 26,38.5 28,31" fill={`url(#${id}_star_dark)`} />

        {/* Top-Left Point */}
        <polygon points="32,30 28,31 22,26" fill={`url(#${id}_star_light)`} />
        <polygon points="32,30 22,26 29.5,25.5" fill={`url(#${id}_star_dark)`} />

        {/* Center Stamped Boss */}
        <circle cx="32" cy="30" r="2.2" fill="#FFFDE0" stroke="#B45309" strokeWidth="0.6" />
      </g>

      {/* Glossy Curved Sheen Across Upper Coin */}
      <path
        d="M14 26 C16 16 26 11 42 12 C33 13 21 16 16 28 C15 27 14 26 14 26 Z"
        fill={`url(#${id}_sheen)`}
      />

      {/* Specular Sparkle Glint on Top-Left Rim */}
      <polygon
        points="17,14 18,17 21,18 18,19 17,22 16,19 13,18 16,17"
        fill="#FFFFFF"
      />
      <circle cx="17" cy="18" r="1.2" fill="#FFFFFF" />
    </svg>
  )
}

export { GoldCoin }

export function CoinAmount({
  amount,
  size = 15,
  digits = 2,
  className = '',
  style = {},
  coinStyle = {},
}: {
  amount: number | string
  size?: number | string
  digits?: number
  className?: string
  style?: React.CSSProperties
  coinStyle?: React.CSSProperties
}) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || '0')
  const formatted = isNaN(num)
    ? '0.00'
    : num.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })

  return (
    <span
      className={`gold-coin-amount ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        ...style,
      }}
    >
      <GoldCoin size={size} style={coinStyle} />
      <span>{formatted}</span>
    </span>
  )
}

export function renderWithGoldCoins(text: string, size: number = 14): React.ReactNode {
  if (!text || typeof text !== 'string' || !text.includes('🪙')) return text
  const parts = text.split('🪙')
  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <GoldCoin
          size={size}
          style={{ display: 'inline-block', verticalAlign: '-2px', margin: '0 2px' }}
        />
      )}
    </React.Fragment>
  ))
}
