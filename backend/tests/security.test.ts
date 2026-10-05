import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import rawBody from 'fastify-raw-body'
import Stripe from 'stripe'
import argon2 from 'argon2'

const { db, redis, mail } = vi.hoisted(() => ({
  db: {
    session: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    userRoleMapping: { findMany: vi.fn() },
    systemSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    supportTicket: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
    transaction: { findUnique: vi.fn(), updateMany: vi.fn() },
    wallet: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  redis: { setex: vi.fn(), get: vi.fn() },
  mail: vi.fn(),
}))
vi.mock('../src/server', () => ({ prisma: db, redis }))
vi.mock('../src/services/email', () => ({ sendEmail: mail }))
vi.mock('../src/services/affiliate', () => ({ processAffiliateCommission: vi.fn() }))
vi.mock('../src/routes/adminSupport', () => ({ default: async () => {} }))
import { authenticate, requireAdmin } from '../src/middleware/auth'
import { requirePermission } from '../src/middleware/rbacMiddleware'
import settingsRoutes from '../src/routes/settings'
import supportRoutes from '../src/routes/support'
import authRoutes from '../src/routes/auth'
import paymentRoutes from '../src/routes/payments'
import walletRoutes from '../src/routes/wallet'
import adminRoutes from '../src/routes/admin'
import { submitCouponTransfer } from '../src/services/couponTransfer'

const apps: FastifyInstance[] = []
const activeSession = () => ({ isActive: true, expiresAt: new Date(Date.now() + 60_000),
  userId: 'user-1', user: { status: 'ACTIVE', role: 'ADMIN' } })
async function app() {
  const instance = Fastify()
  await instance.register(jwt, { secret: 'test-only-secret-with-at-least-32-characters' })
  apps.push(instance)
  return instance
}
function headers(instance: FastifyInstance, role = 'ADMIN') {
  return { authorization: `Bearer ${instance.jwt.sign({ userId: 'user-1', role, sessionId: 'session-1' })}` }
}
beforeEach(() => {
  vi.resetAllMocks()
  db.session.findUnique.mockResolvedValue(activeSession())
  db.session.update.mockResolvedValue({})
  db.auditLog.create.mockResolvedValue({})
  db.$transaction.mockImplementation(async callback => callback(db))
})
afterEach(async () => {
  await Promise.all(apps.splice(0).map(instance => instance.close()))
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('authentication and settings authorization', () => {
  it.each(['SUSPENDED', 'BANNED'])('denies an active session for a %s account', async status => {
    const instance = await app()
    instance.get('/private', { preHandler: authenticate }, async () => ({ ok: true }))
    db.session.findUnique.mockResolvedValue({ ...activeSession(), user: { status, role: 'ADMIN' } })
    expect((await instance.inject({ url: '/private', headers: headers(instance) })).statusCode).toBe(403)
    expect(db.session.update).not.toHaveBeenCalled()
  })
  it('denies sessions belonging to a different user', async () => {
    const instance = await app()
    instance.get('/private', { preHandler: authenticate }, async () => ({ ok: true }))
    db.session.findUnique.mockResolvedValue({ ...activeSession(), userId: 'someone-else' })
    expect((await instance.inject({ url: '/private', headers: headers(instance) })).statusCode).toBe(401)
  })
  it('uses current privileges instead of a stale admin claim', async () => {
    const instance = await app()
    instance.get('/admin', { preHandler: [authenticate, requireAdmin] }, async () => ({ ok: true }))
    db.session.findUnique.mockResolvedValue({ ...activeSession(), user: { status: 'ACTIVE', role: 'USER' } })
    expect((await instance.inject({ url: '/admin', headers: headers(instance) })).statusCode).toBe(403)
  })
  it('rejects an expired session', async () => {
    const instance = await app()
    instance.get('/private', { preHandler: authenticate }, async () => ({ ok: true }))
    db.session.findUnique.mockResolvedValue({ ...activeSession(), expiresAt: new Date(0) })
    expect((await instance.inject({ url: '/private', headers: headers(instance) })).statusCode).toBe(401)
  })
  it('does not let a revoked admin token update settings', async () => {
    const instance = await app()
    await instance.register(settingsRoutes, { prefix: '/settings' })
    db.session.findUnique.mockResolvedValue({ ...activeSession(), isActive: false })
    const result = await instance.inject({ method: 'PUT', url: '/settings/wallet',
      headers: headers(instance), payload: { minWithdrawal: 0 } })
    expect(result.statusCode).toBe(401)
    expect(db.systemSetting.upsert).not.toHaveBeenCalled()
  })
  it('validates settings and records the real actor', async () => {
    const instance = await app()
    await instance.register(settingsRoutes, { prefix: '/settings' })
    const payload = { minDeposit: 1, maxDeposit: 100, minWithdrawal: 1, maxWithdrawal: 100,
      dailyDepositLimit: 100, dailyWithdrawalLimit: 100, bonusWalletEnabled: true }
    db.systemSetting.upsert.mockResolvedValue({ data: payload })
    const result = await instance.inject({ method: 'PUT', url: '/settings/wallet', headers: headers(instance), payload })
    expect(result.statusCode).toBe(200)
    expect(db.systemSetting.upsert.mock.calls[0][0].update.updatedBy).toBe('user-1')
    expect(db.auditLog.create.mock.calls[0][0].data.userId).toBe('user-1')
    db.systemSetting.upsert.mockClear()
    await instance.inject({ method: 'PUT', url: '/settings/wallet', headers: headers(instance),
      payload: { ...payload, minDeposit: 101 } })
    expect(db.systemSetting.upsert).not.toHaveBeenCalled()
  })
  it('excludes expired permissions at the database boundary', async () => {
    const instance = await app()
    db.session.findUnique.mockResolvedValue({ ...activeSession(), user: { status: 'ACTIVE', role: 'USER' } })
    db.userRoleMapping.findMany.mockResolvedValue([])
    instance.get('/users', { preHandler: [authenticate, requirePermission('Users', 'View')] }, async () => ({ ok: true }))
    expect((await instance.inject({ url: '/users', headers: headers(instance) })).statusCode).toBe(403)
    const where = db.userRoleMapping.findMany.mock.calls[0][0].where
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }])
  })
  it('never returns unknown public settings fields', async () => {
    const instance = await app()
    await instance.register(settingsRoutes, { prefix: '/settings' })
    db.systemSetting.findUnique.mockResolvedValue({ data: { platformName: 'Test', apiSecret: 'private' } })
    const result = await instance.inject('/settings/general')
    expect(result.json().data).toEqual({ platformName: 'Test' })
    expect((await instance.inject('/settings/security')).statusCode).toBe(401)
  })
  it('revokes sessions in the same transaction as bulk suspension', async () => {
    const instance = await app()
    await instance.register(adminRoutes, { prefix: '/admin' })
    const result = await instance.inject({ method: 'POST', url: '/admin/users/bulk-action',
      headers: headers(instance), payload: { userIds: ['user-2'], action: 'SUSPEND' } })
    expect(result.statusCode).toBe(200)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['user-2'] } }, data: { status: 'SUSPENDED' } })
    expect(db.session.updateMany).toHaveBeenCalledWith({ where: { userId: { in: ['user-2'] } }, data: { isActive: false } })
  })
})

describe('registration and support privacy', () => {
  it('stores only a password hash and never returns a development OTP in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SMTP_USER', '')
    vi.stubEnv('RESEND_API_KEY', '')
    mail.mockResolvedValue(undefined)
    db.user.findFirst.mockResolvedValue(null)
    const instance = await app()
    await instance.register(authRoutes, { prefix: '/auth' })
    const password = 'a-test-password-123'
    const result = await instance.inject({ method: 'POST', url: '/auth/register', payload: {
      email: 'test@example.com', username: 'testuser', password, firstName: 'Test', lastName: 'User',
    } })
    expect(result.statusCode).toBe(201)
    expect(result.json()).not.toHaveProperty('devOtp')
    const pending = JSON.parse(redis.setex.mock.calls.find(call => call[0].startsWith('pending_reg:'))![2])
    expect(pending).not.toHaveProperty('password')
    expect(await argon2.verify(pending.passwordHash, password)).toBe(true)
    expect(result.body).not.toContain(mail.mock.calls[0][0].data.code)
  })
  it('filters internal notes from customer ticket previews', async () => {
    const instance = await app()
    await instance.register(supportRoutes, { prefix: '/support' })
    db.supportTicket.findMany.mockResolvedValue([])
    db.supportTicket.count.mockResolvedValue(0)
    const result = await instance.inject({ url: '/support/tickets', headers: headers(instance) })
    expect(result.statusCode).toBe(200)
    expect(db.supportTicket.findMany.mock.calls[0][0].include.messages.where).toEqual({ isInternal: false })
  })
})

describe('signed payment webhooks', () => {
  it('accepts a real signed raw payload and rejects a modified payload', async () => {
    const instance = await app()
    await instance.register(rawBody, { global: false, encoding: false, runFirst: true })
    await instance.register(paymentRoutes, { prefix: '/payments' })
    const secret = 'whsec_test_only'
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_testonly')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
    const stripe = new Stripe('sk_test_testonly')
    const payload = JSON.stringify({ id: 'evt_test', object: 'event', type: 'test.event', data: { object: {} } })
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })
    const requestHeaders = { 'content-type': 'application/json', 'stripe-signature': signature }
    expect((await instance.inject({ method: 'POST', url: '/payments/stripe/webhook', headers: requestHeaders, payload })).statusCode).toBe(200)
    expect((await instance.inject({ method: 'POST', url: '/payments/stripe/webhook', headers: requestHeaders, payload: payload.replace('evt_test', 'evt_changed') })).statusCode).toBe(400)
  })
})

describe('coupon transfer outcomes', () => {
  const transfer = { userId: 'user-1', userEmail: 'test@example.com', amount: 10, transactionId: 'TRF-test' }
  it.each(['network', 'malformed', 'conflict', 'server-error', 'wrong-receipt'])('keeps funds pending for %s', async kind => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    if (kind === 'network') fetchMock.mockRejectedValue(new Error('network failure'))
    else fetchMock.mockResolvedValue({ ok: kind === 'malformed' || kind === 'wrong-receipt',
      status: kind === 'conflict' ? 409 : 500,
      json: kind === 'malformed' ? async () => { throw new Error('invalid JSON') } : async () => ({ success: true, transactionId: 'wrong' }),
    })
    expect(await submitCouponTransfer('https://coupon.example/wallet/transfer', 'key', transfer)).toBe('PENDING')
    const options = fetchMock.mock.calls[0][1]
    expect(JSON.parse(options.body).transactionId).toBe('TRF-test')
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })
  it('accepts a confirmed success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, transactionId: transfer.transactionId }) }))
    expect(await submitCouponTransfer('https://coupon.example/wallet/transfer', 'key', transfer)).toBe('COMPLETED')
  })
  it('refunds a confirmed failed transfer once and rejects repeat resolution', async () => {
    const instance = await app()
    await instance.register(walletRoutes, { prefix: '/wallet' })
    db.transaction.findUnique.mockResolvedValue({ id: 'tx-1', walletId: 'wallet-1', amount: 10,
      metadata: { kind: 'COUPON_TRANSFER' } })
    db.transaction.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    const request = { method: 'POST' as const, url: '/wallet/transfers/TRF-test/resolve',
      headers: headers(instance), payload: { outcome: 'FAILED', providerReference: 'provider-ledger-1', notes: 'Provider confirms no credit was made.' } }
    expect((await instance.inject(request)).statusCode).toBe(200)
    expect(db.wallet.update.mock.calls[0][0].data.balance).toEqual({ increment: 10 })
    expect((await instance.inject(request)).statusCode).toBe(409)
    expect(db.wallet.update).toHaveBeenCalledTimes(1)
    expect(db.auditLog.create).toHaveBeenCalledTimes(1)
  })
  it('refuses ordinary users access to transfer reconciliation', async () => {
    const instance = await app()
    await instance.register(walletRoutes, { prefix: '/wallet' })
    db.session.findUnique.mockResolvedValue({ ...activeSession(), user: { status: 'ACTIVE', role: 'USER' } })
    expect((await instance.inject({ method: 'POST', url: '/wallet/transfers/TRF-test/resolve',
      headers: headers(instance), payload: {} })).statusCode).toBe(403)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
