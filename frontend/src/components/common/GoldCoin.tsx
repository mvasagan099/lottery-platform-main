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
      viewBox="0 0 48 48"
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
        <radialGradient id={`${id}_rim`} cx="30%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#FFF6A3" />
          <stop offset="35%" stopColor="#F5B014" />
          <stop offset="70%" stopColor="#C87A04" />
          <stop offset="100%" stopColor="#7A4500" />
        </radialGradient>
        <linearGradient id={`${id}_edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF275" />
          <stop offset="100%" stopColor="#8C4E00" />
        </linearGradient>
        <radialGradient id={`${id}_face`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#FFF8B8" />
          <stop offset="45%" stopColor="#F7BA1E" />
          <stop offset="85%" stopColor="#DF8705" />
          <stop offset="100%" stopColor="#B26000" />
        </radialGradient>
        <linearGradient id={`${id}_sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer Rim */}
      <circle
        cx="24"
        cy="24"
        r="22"
        fill={`url(#${id}_rim)`}
        stroke={`url(#${id}_edge)`}
        strokeWidth="1.5"
      />

      {/* Coin Serrations / Milling */}
      <circle
        cx="24"
        cy="24"
        r="19.5"
        fill="none"
        stroke="#FFF6A3"
        strokeWidth="1"
        strokeDasharray="2.2 1.6"
        opacity="0.85"
      />

      {/* Inner Recessed Face */}
      <circle
        cx="24"
        cy="24"
        r="17"
        fill={`url(#${id}_face)`}
        stroke="#8C4E00"
        strokeWidth="0.8"
      />
      <circle
        cx="24"
        cy="24"
        r="15"
        fill="none"
        stroke="#FFDF00"
        strokeWidth="0.5"
        opacity="0.5"
      />

      {/* Center 5-Point Star Emblem */}
      <path
        d="M24 13.5 L26.8 19.8 L33.6 20.4 L28.5 24.9 L30 31.6 L24 28.1 L18 31.6 L19.5 24.9 L14.4 20.4 L21.2 19.8 Z"
        fill="#FFF9D2"
        stroke="#A55400"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Highlight Sheen Arc */}
      <path
        d="M10 20 C 12 12, 20 8, 30 8 C 35 8, 37 9, 39 12 C 34 10, 22 11, 14 19 C 12 21, 10 23, 10 20 Z"
        fill={`url(#${id}_sheen)`}
      />
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
