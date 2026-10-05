import { z } from 'zod'

const text = z.string().max(500)
const amount = z.number().finite().min(0).max(1_000_000_000)
export const settingsSchemas = {
  general: z.object({
    platformName: text.min(1), companyName: text.min(1), supportEmail: text.email(),
    supportPhone: text, websiteUrl: text.url().refine(url => new URL(url).protocol === 'https:'),
    copyright: text, timezone: text, language: text, currency: text,
    dateFormat: text, numberFormat: text, maintenanceMode: z.boolean(), maintenanceMessage: text.optional(),
  }).strict(),
  lottery: z.object({
    defaultCurrency: text, ticketPurchaseLimit: z.number().int().min(1).max(1000),
    minTicketPrice: amount, maxTicketPrice: amount, jackpotRollOver: z.boolean(), autoDraw: z.boolean(),
    drawTimezone: text, resultPublishDelay: z.number().int().min(0).max(10080),
    winnerVerification: z.boolean(), claimExpiryDays: z.number().int().min(1).max(3650),
    autoPrizeDistribution: z.boolean(),
  }).strict(),
  user: z.object({
    registrationEnabled: z.boolean(), emailVerification: z.boolean(), phoneVerification: z.boolean(),
    kycRequired: z.boolean(), minimumAge: z.number().int().min(18).max(100),
    referralSystem: z.boolean(), affiliateProgram: z.boolean(), vipProgram: z.boolean(),
  }).strict(),
  wallet: z.object({
    minDeposit: amount, maxDeposit: amount, minWithdrawal: amount, maxWithdrawal: amount,
    dailyDepositLimit: amount, dailyWithdrawalLimit: amount, bonusWalletEnabled: z.boolean(),
  }).strict(),
  security: z.object({
    jwtExpiryHours: z.number().int().min(1).max(24), refreshTokenExpiryDays: z.number().int().min(1).max(30),
    sessionTimeoutMinutes: z.number().int().min(1).max(1440), twoFactorAuth: z.boolean(),
    deviceVerification: z.boolean(), loginAlerts: z.boolean(), rateLimiting: z.boolean(), bruteForceProtection: z.boolean(),
  }).strict(),
}

export function parseSettings(category: string, body: unknown) {
  const schema = Object.prototype.hasOwnProperty.call(settingsSchemas, category)
    ? settingsSchemas[category as keyof typeof settingsSchemas] : undefined
  if (!schema) throw Object.assign(new Error('Unknown settings category'), { statusCode: 400 })
  const data = schema.parse(body)
  if ('minDeposit' in data && (data.minDeposit > data.maxDeposit || data.minWithdrawal > data.maxWithdrawal)) {
    throw Object.assign(new Error('Minimum amounts must not exceed maximum amounts'), { statusCode: 400 })
  }
  if ('minTicketPrice' in data && data.minTicketPrice > data.maxTicketPrice) {
    throw Object.assign(new Error('Minimum price must not exceed maximum price'), { statusCode: 400 })
  }
  return data
}
