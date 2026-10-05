# Security review — 5 October 2026

## Remediation update

The ten application/configuration findings below have been addressed in the working tree. Support HTML is sanitized at both rendering boundaries; tokens are excluded from browser persistence with migration of legacy entries; settings writes now validate live sessions/current roles, validate fields, and log the actor; admin seeding requires an explicit strong password; production email cannot fall back to OTP disclosure; bulk suspension revokes sessions atomically; role queries exclude expired assignments; customer previews exclude internal notes; pending registration stores a password hash; proxy trust defaults to disabled and requires explicit proxy addresses.

Dependency families were upgraded with compatible Fastify 5 plugins and aligned Tiptap releases. Final npm audits report **zero known vulnerabilities** for both root/backend and frontend. The Bull UUID override uses a patched CommonJS-compatible release; a smoke check confirmed Bull and the Fastify plugin set load successfully. Audit snapshots are `security-audit/backend-after.json` and `security-audit/frontend-after.json`.

Additional repairs register bounded raw-body capture for Stripe signature verification, remove the shadow-database hardcoded credential, harden the alternate Compose configuration, and add a Render frontend CSP. Coupon transfers have random unique references, a durable pending record, a 15-second request timeout, and no automatic refund after ambiguous remote outcomes. An admin-only, atomic reconciliation endpoint records provider evidence and refunds confirmed failures at most once.

Production rollout still requires real credentials/proxy configuration and rotation of any previously used default admin password. No live systems or existing credentials were changed. See the deployment notes in README.md.

Validation: backend TypeScript build and frontend TypeScript/Vite production build pass; all **30 tests** pass, including new security regression tests. Signed Stripe payloads are accepted and modified payloads rejected; DOM tests verify removal of executable support markup and legacy bearer tokens; route tests cover revoked sessions, current privileges, bulk suspension, expired-role filtering, internal-note privacy, and transfer refunds occurring only once. Admin seeding without an explicit password exits before querying the database. Live PostgreSQL/Redis/provider integration and production ingress settings remain unverified.

## Initial review

The initial review covered authentication, authorization, support messages, wallet/payment flows, deployment configuration, tracked secret candidates, and the root/frontend dependency lockfiles. The findings and line references below describe the original code, retained for traceability; they are not assertions that the repaired implementation still contains those issues.

## Highest-priority findings

### 1. High: stored HTML injection in support conversations

**Evidence:** `backend/src/routes/support.ts:128` and `:205` save caller-controlled messages without sanitization. `frontend/src/pages/support/SupportTicketModal.tsx:66` and `frontend/src/pages/admin/support/TicketDetailsDrawer.tsx:256` insert messages using `dangerouslySetInnerHTML`. The admin support service returns these messages without sanitization (`backend/src/services/supportTicket.service.ts:60`).

A customer can submit HTML that executes in the browser when a support agent opens the ticket, where the page permits inline event handlers. The Render static-site configuration lacks a CSP; the Docker Nginx CSP can block many script payloads but does not make HTML insertion safe. The access token is also persisted to localStorage (finding 3), increasing the impact.

**Fix:** Render messages as text. If rich text is required, sanitize against an explicit HTML allowlist at every rendering boundary, including existing messages. Add a frontend CSP as defense in depth.

### 2. High: revoked admin sessions can still write system settings

**Evidence:** `backend/src/routes/settings.ts:45` calls `jwtVerify()` and checks the token's role, without the shared `authenticate` session check. `:59` then writes arbitrary category data. `updatedBy` uses `user.id`, although tokens contain `userId`.

A captured admin access token remains usable on this endpoint after logout, password reset, or session termination, until its 15-minute expiry. Account suspension and role changes are not rechecked here.

**Validation:** Executed the actual TypeScript route registration and hooks with mocked JWT verification and storage; a valid-signature ADMIN token with an inactive-session identifier reached the settings write. This was an isolated check, not a live API attack.

**Fix:** Use `[authenticate, requireAdmin]`, check current account status/role, validate settings per category, and record `request.user.userId` in an audit trail.

### 3. High: access tokens are persisted to localStorage

**Evidence:** `frontend/src/store/authStore.ts:66` includes `accessToken` in Zustand's persisted `partialize` output. The comments describing memory-only storage do not match the implementation.

JavaScript executing in the frontend origin can read a bearer token from the persisted `auth-store` entry, including after reload. This compounds finding 1.

**Fix:** Remove tokens from persistence, migrate/delete existing persisted token fields, and restore access through the HttpOnly refresh flow. Test refresh-cookie behavior under the configured `/api` proxy path.

### 4. High: default privileged account password in the seed script

**Evidence:** `backend/src/seed.ts:23` falls back to a public default password when `ADMIN_SEED_PASSWORD` is missing, and creates an ACTIVE, email-verified SUPER_ADMIN (`:35`). The script prints the fallback password near its end.

A fresh database seeded without this environment variable has a predictable privileged login. This review did not establish whether any deployed account still uses that password.

**Fix:** Require a strong explicitly supplied password before seeding an admin. Remove password logging. Rotate existing seeded credentials and invalidate sessions if the default was used.

### 5. High, configuration-dependent: verification OTPs are returned in production responses

**Evidence:** `backend/src/routes/auth.ts:147` and `:200` identify development mode solely from missing `RESEND_API_KEY` and `SMTP_USER`, independent of `NODE_ENV`. The registration and resend responses then disclose the OTP in `devOtp` and/or the message.

A production deployment with absent email credentials gives anonymous callers the verification code. Resend accepts an email address without requiring the account password. Email verification therefore ceases to prove mailbox ownership in that configuration.

**Fix:** Never include OTPs in production responses. Require explicit development mode for any development helper, and reject production startup or verification requests when email delivery is unavailable.

### 6. High: bulk suspension leaves existing sessions usable

**Evidence:** `backend/src/routes/admin.ts:279` bulk-updates account status without invalidating sessions. Unlike the single-user status endpoint (`:269`), it never calls `session.updateMany`. `backend/src/middleware/auth.ts:19` checks only session activity/expiry, not current account status. The `requireActiveAccount` helper is not used by routes.

A user suspended through the bulk endpoint can continue using an already-issued access token on purchase and wallet endpoints. Refresh is blocked by account status, but existing access remains available until token expiry. Role-based guards likewise rely on token roles until refresh/expiry.

**Validation:** The actual `authenticate` function accepted a mocked active session without consulting the mocked SUSPENDED user record.

**Fix:** Invalidate sessions atomically with bulk suspension. Enforce current account status and current privilege state consistently in authentication.

### 7. Medium: expired role assignments still grant permissions

**Evidence:** `prisma/schema.prisma:840` provides `UserRoleMapping.expiresAt`, and `backend/src/routes/rbac.ts` accepts expiry on assignment. Neither `backend/src/routes/admin.ts:92` nor `backend/src/middleware/rbacMiddleware.ts:19` filters expired assignments or checks expiry before granting access.

Temporary staff permissions remain effective indefinitely while the assigned role stays active.

**Validation:** Executed the actual `requirePermission` function with an assignment expiring in 1970; it allowed access.

**Fix:** Require `expiresAt IS NULL OR expiresAt > now` in both authorization paths. Centralize the permission decision so the paths cannot drift.

### 8. Medium: internal support notes leak through the customer ticket list

**Evidence:** `backend/src/routes/support.ts:85` fetches the latest ticket message without `isInternal: false`, then returns the full ticket objects. The individual-ticket endpoint correctly filters internal notes, but the list endpoint does not.

If the latest message is an internal note, the customer can retrieve its contents through `GET /support/tickets`.

**Fix:** Filter customer-visible messages in every customer query and return explicitly selected preview fields.

### 9. Medium: pending registrations store plaintext passwords in Redis

**Evidence:** `backend/src/routes/auth.ts:123` serializes the entire registration body, including `password`, into `pending_reg:<email>` for 15 minutes. Hashing occurs only when verification or skip-verification creates the account.

Redis access, snapshots, or diagnostic dumps can disclose those passwords during the pending period. Expiry does not remove credentials already copied into a snapshot.

**Fix:** Hash the password before storing pending registration data and carry only the hash into account creation.

### 10. Medium, deployment-dependent: proxy trust permits client-IP spoofing

**Evidence:** `backend/src/server.ts:66` sets `trustProxy: true`. Rate-limit keys use `req.ip`, while `nginx/nginx.conf` appends incoming `X-Forwarded-For` values. The backend Dockerfile exposes port 3001, and Render hosts the API directly behind its proxy.

If an ingress preserves a caller-supplied forwarding chain, arbitrary proxy trust can let the caller vary the apparent client IP and evade IP-based login/OTP limits. Actual production ingress behavior was not tested.

**Fix:** Trust only known proxies/hops and have ingress overwrite untrusted forwarding headers. Verify limits against spoofed forwarding headers in staging.

## Dependency audit

Successfully queried the npm advisory registry against the checked-in lockfiles. Counts are affected dependency entries, including inherited parent-package advisories; they are not distinct CVEs or confirmed exploitable paths.

| Scope | Critical | High | Moderate | Total |
| --- | ---: | ---: | ---: | ---: |
| Root/backend, all dependencies | 1 | 9 | 8 | 18 |
| Root/backend, production only | 1 | 8 | 5 | 14 |
| Frontend, all dependencies | 0 | 16 | 31 | 47 |

Notable locked packages include `fast-jwt@4.0.5` (critical), `fastify@4.29.1` (high), `nodemailer@6.10.1` (high), `sharp@0.33.5` (high), `axios@1.18.1` (high), `@tiptap/core@3.28.0` (high), and `vite@5.4.21` (high). Confirm exact affected versions and paths in the saved JSON audit files.

The critical fast-jwt advisories include [RSA public-key algorithm confusion](https://github.com/advisories/GHSA-mvf2-f6gm-w987) and [custom cache-key collisions](https://github.com/advisories/GHSA-rp9m-7r4c-75qg). This application's displayed configuration uses a static secret and no custom cache key; the review did not demonstrate those critical exploit conditions here. Upgrade the affected dependency family nonetheless. Several npm-proposed fixes require major-version changes; do not apply `npm audit fix --force` without compatibility review. Frontend totals include development tooling, so they are not all risks to the deployed static bundle.

Raw results: `security-audit/backend-all.json`, `security-audit/backend-production.json`, and `security-audit/frontend-all.json`.

## Additional observations

- **Stripe webhook availability:** `backend/src/routes/payments.ts:76` sets `config.rawBody`, but no raw-body plugin or parser is registered anywhere in the backend. `constructEvent` receives an undefined raw body and cannot validate ordinary deliveries. Register bounded raw-body capture before the route; validate a signed test event and duplicate delivery locally.
- **Coupon transfer consistency:** `backend/src/routes/wallet.ts` debits locally before an external `fetch`; network rejection has no encompassing recovery block. Conversely, an invalid response causes an immediate refund even when the remote service might already have credited funds. Use durable idempotency, bounded requests, and reconciliation for uncertain outcomes rather than automatic refunds after ambiguous responses.
- **Alternate Docker configuration:** `docker/docker-compose.yml` still supplies predictable database/Redis defaults and publishes their ports. The root Compose file is hardened. Make the alternate configuration explicitly local-only or align it with the root configuration.
- **Tracked-secret scan:** No non-placeholder provider key or private key was confirmed by the targeted pattern scan. A hardcoded local database credential remains in `create_shadow_db.js:3`; move it to environment configuration. This was a tracked working-tree scan, not a full Git-history secret audit.
- **Prize-claim race checked:** A possible double-credit pattern was inspected, but the unique `Transaction.reference` and enclosing database transaction prevent the duplicate transaction from committing under the declared schema. No double-credit finding is asserted.

## Validation and limitations

Three isolated checks executed the repository's actual TypeScript authentication/permission/settings functions after Node type stripping, replacing external imports with mocks. These establish control-flow gaps, not end-to-end behavior under real Fastify and PostgreSQL. The temporary harness was stored outside the repository.

No live service, production credentials, database, Redis, or browser session was used. Dependencies are not installed in this checkout, so the existing application test suite and builds were not executed. Supabase bucket policies, deployed TLS/security headers, payment-provider setup, and runtime environment values remain unverified.

Prioritize support rendering/token persistence, settings authorization, privileged seed credentials, production OTP handling, and session revocation; then address role expiry, note privacy, pending-password storage, ingress trust, and dependency upgrades with targeted regression checks.
