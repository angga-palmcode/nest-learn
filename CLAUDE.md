# Astos Backend — Project Reference

## Stack

- **Framework:** NestJS 11 + TypeScript
- **Database:** PostgreSQL (local: `nest-dev2` on `localhost:5432`)
- **ORM:** Prisma 5
- **Auth:** JWT (access 15 min) + opaque refresh tokens (7 days) + TOTP MFA
- **Runtime:** Node.js 22

---

## Getting Started

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Seed demo org + admin user
npm run seed
# → org slug: "demo"  |  admin@demo.com / admin123

# Start dev server (watch mode)
npm run start:dev

# Build
npm run build
```

---

## Swagger / API Docs

URL: **http://localhost:3000/api**

- Interactive UI — expand any endpoint, click "Try it out", fill in the body and hit "Execute"
- Click the **Authorize** button (top right) → paste an `access_token` → JWT-protected endpoints work automatically

---

## Environment Variables (`.env`)

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/nest-dev2"
JWT_SECRET="change-me-in-production-use-a-long-random-string"
JWT_REFRESH_SECRET="change-me-refresh-secret-also-long-random-string"
FRONTEND_URL="http://localhost:5173"
```

> **Important:** `.env` must be plain UTF-8. On Windows, always write it via
> `printf` or Bash heredoc — NOT via PowerShell/notepad which produces UTF-16 LE.

---

## Project Structure

```
src/
├── app.module.ts               Root module
├── main.ts                     Bootstrap (GlobalValidationPipe, port 3000)
│
├── auth/                       Authentication module
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── decorators/
│   │   └── roles.decorator.ts  @Roles('admin', 'manager') decorator
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── register.dto.ts
│   │   ├── refresh-token.dto.ts
│   │   ├── update-profile.dto.ts
│   │   ├── forgot-password.dto.ts
│   │   ├── reset-password.dto.ts
│   │   ├── resend-verification.dto.ts
│   │   ├── setup-mfa.dto.ts
│   │   ├── disable-mfa.dto.ts
│   │   ├── mfa-verify.dto.ts
│   │   ├── mfa-challenge.dto.ts
│   │   ├── mfa-recover.dto.ts
│   │   └── revoke-all-sessions.dto.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts   Protect routes with Bearer JWT
│   │   └── roles.guard.ts      Role-based access (use with @Roles decorator)
│   └── strategies/
│       ├── jwt.strategy.ts
│       └── local.strategy.ts
│
├── users/                      User management module
│   ├── users.module.ts
│   ├── users.service.ts
│   ├── users.controller.ts
│   └── dto/
│       ├── list-users.dto.ts
│       ├── invite-user.dto.ts
│       └── change-role.dto.ts
│
├── organizations/              Organizations (tenants) module
│   ├── organizations.module.ts
│   ├── organizations.service.ts
│   ├── organizations.controller.ts
│   └── dto/
│       └── create-organization.dto.ts
│
├── mail/                       Email service (console logger — no SMTP yet)
│   ├── mail.module.ts          @Global()
│   └── mail.service.ts
│
├── audit/                      Audit logging service
│   ├── audit.module.ts         @Global()
│   └── audit.service.ts
│
└── prisma/
    ├── prisma.module.ts
    └── prisma.service.ts

prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

---

## Database Schema

### `Organization`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| name | VARCHAR(255) | |
| slug | VARCHAR(255) UNIQUE | URL-safe tenant identifier |
| industry | VARCHAR(100) NULLABLE | debt_collection, insurance, banking, healthcare, other |
| mfa_enforced | BOOLEAN | default false |
| max_concurrent_calls | INT | default 100 |
| timezone | VARCHAR(50) | default 'Europe/Stockholm' |
| locale | VARCHAR(10) | default 'sv' |
| created_at / updated_at / deleted_at | TIMESTAMP | soft delete |

### `User`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | multi-tenant isolation |
| name | VARCHAR(255) | |
| email | VARCHAR(255) UNIQUE | login field |
| password | VARCHAR(255) | bcrypt hash |
| role | ENUM(admin, manager, agent) | |
| email_verified_at | TIMESTAMP NULLABLE | NULL = not verified → login blocked |
| mfa_enabled | BOOLEAN | default false |
| mfa_secret | VARCHAR(255) NULLABLE | TOTP secret (Base32) |
| mfa_recovery_codes | JSON NULLABLE | array of bcrypt-hashed codes |
| last_login_at / last_login_ip | TIMESTAMP / VARCHAR | updated on each login |
| is_active | BOOLEAN | default true; inactive = cannot login |
| invited_by | UUID FK → User NULLABLE | self-referential |
| invited_at | TIMESTAMP NULLABLE | |
| created_at / updated_at / deleted_at | TIMESTAMP | soft delete |

### `RefreshToken`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| token | STRING UNIQUE | opaque 128-char hex, stored plain |
| user_id | UUID FK → User | |
| expires_at | TIMESTAMP | 7 days from creation |
| created_at | TIMESTAMP | |
| revoked_at | TIMESTAMP NULLABLE | set on logout / token rotation |

### `UserSession`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| user_id | UUID FK → User | |
| ip_address | VARCHAR(45) | |
| user_agent | TEXT | |
| device_name | VARCHAR(255) NULLABLE | e.g. "Chrome on MacOS" |
| last_active_at | TIMESTAMP | default now() |
| expires_at | TIMESTAMP | 24h from creation |
| created_at | TIMESTAMP | |

### `UserInvitation`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| email | VARCHAR(255) | |
| role | ENUM(admin, manager, agent) | |
| invited_by | UUID FK → User | |
| token | VARCHAR(64) UNIQUE | 32-byte random hex |
| accepted_at | TIMESTAMP NULLABLE | NULL = pending |
| expires_at | TIMESTAMP | 7 days |
| created_at | TIMESTAMP | |

### `PasswordResetToken`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| email | VARCHAR(255) | |
| token | VARCHAR(64) UNIQUE | 32-byte random hex |
| expires_at | TIMESTAMP | 1 hour |
| created_at | TIMESTAMP | |

### `AuditLog`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| user_id | UUID FK → User NULLABLE | NULL for system events |
| action | VARCHAR(100) | e.g. 'user.login', 'user.mfa_enabled' |
| resource_type | VARCHAR(100) NULLABLE | |
| resource_id | UUID NULLABLE | |
| metadata | JSON NULLABLE | |
| ip_address | VARCHAR(45) NULLABLE | |
| created_at | TIMESTAMP | immutable |

---

## API Endpoints

### Auth (`/auth`)

| Method | Path | Guard | Body | Description |
|--------|------|-------|------|-------------|
| POST | `/auth/register` | none | `{ name, email, password, password_confirmation, organization_name, industry?, locale? }` | Creates org + admin user, sends verification email |
| POST | `/auth/login` | none | `{ email, password, device_name? }` | Returns token pair, or `mfa_required + mfa_token`. Blocks if email not verified. |
| POST | `/auth/refresh` | none | `{ refresh_token }` | Rotate refresh token → new token pair |
| POST | `/auth/logout` | JWT | `{ refresh_token }` + `X-Session-ID` header | Revoke refresh token + session |
| POST | `/auth/email/verify/:id/:hash` | none | — | Verify email address from signed link |
| POST | `/auth/email/resend-verification` | none | `{ email }` | Resend verification email |
| POST | `/auth/forgot-password` | none | `{ email }` | Send password reset link (always 200) |
| POST | `/auth/reset-password` | none | `{ token, email, password, password_confirmation }` | Complete password reset |
| GET | `/auth/me` | JWT | — | Get current user profile |
| PUT | `/auth/me` | JWT | `{ name?, email?, current_password?, password? }` | Update profile |
| POST | `/auth/mfa/setup` | JWT | `{ current_password }` | Generate TOTP secret + QR URI + 8 recovery codes |
| POST | `/auth/mfa/confirm` | JWT | `{ code }` | Confirm TOTP code → enables MFA |
| DELETE | `/auth/mfa` | JWT | `{ current_password, code }` | Disable MFA |
| POST | `/auth/mfa/challenge` | none | `{ mfa_token, code }` | Login step 2: TOTP → full tokens |
| POST | `/auth/mfa/recover` | none | `{ mfa_token, recovery_code }` | Login step 2: recovery code → full tokens |
| GET | `/auth/sessions` | JWT | — + `X-Session-ID` header | List active sessions |
| DELETE | `/auth/sessions/:id` | JWT | — | Revoke specific session |
| DELETE | `/auth/sessions` | JWT | `{ current_password }` + `X-Session-ID` header | Revoke all sessions except current |

### Users (`/users`) — all require JWT

| Method | Path | Role | Body / Query | Description |
|--------|------|------|-------------|-------------|
| GET | `/users` | admin, manager | `?role=&search=&is_active=&sort=&page=&page_size=` | List org users with pagination |
| POST | `/users/invite` | admin | `{ email, role, name? }` | Invite user → sends invite email |
| PUT | `/users/:id/role` | admin | `{ role }` | Change user's role |
| PUT | `/users/:id/deactivate` | admin | — | Deactivate user + revoke all tokens/sessions |
| PUT | `/users/:id/activate` | admin | — | Reactivate user |
| DELETE | `/users/:id/force-logout` | admin | — | Revoke all tokens + sessions |

### Organizations (`/organizations`)

| Method | Path | Guard | Body | Description |
|--------|------|-------|------|-------------|
| POST | `/organizations` | none | `{ name, slug, industry?, timezone?, locale? }` | Create a new tenant org |
| GET | `/organizations/:slug` | none | — | Get org by slug |

---

## Auth Flows

### Registration (creates org + admin user)
```
POST /auth/register { name, email, password, password_confirmation, organization_name }
→ { user: { ... }, message: "...check your email..." }
  ↓ verification email sent
POST /auth/email/verify/:id/:hash
→ { message: "Email verified successfully." }
  ↓ user can now login
```

### Normal login (email verified, no MFA)
```
POST /auth/login { email, password, device_name? }
→ { access_token, refresh_token }
  ↓ UserSession created
```

### Login with MFA
```
POST /auth/login { email, password }
→ { mfa_required: true, mfa_token }   ← valid 5 minutes

POST /auth/mfa/challenge { mfa_token, code }
→ { access_token, refresh_token }

# OR recovery code:
POST /auth/mfa/recover { mfa_token, recovery_code }
→ { access_token, refresh_token }
```

### Enable MFA
```
POST /auth/mfa/setup { current_password }   → { secret, qr_code_uri, recovery_codes }
POST /auth/mfa/confirm { code }             → { success: true }
```

### Password reset
```
POST /auth/forgot-password { email }  → 200 (always, prevents enumeration)
POST /auth/reset-password { token, email, password, password_confirmation }
→ { message: "Password has been reset..." }  ← all sessions revoked
```

### Session management
```
# Client stores session_id after login (if returned), sends as X-Session-ID header
GET  /auth/sessions           → list of sessions, is_current flag
DELETE /auth/sessions/:id     → revoke one
DELETE /auth/sessions         → revoke all others (requires current_password)
```

---

## JWT Payload

```typescript
// access_token (JwtPayload)
{ sub: userId, orgId: string, role: 'admin'|'manager'|'agent' }

// mfa_token (short-lived, 5 min)
{ sub: userId, type: 'mfa_pending' }
```

---

## Protecting Routes

```typescript
// JWT only
@UseGuards(JwtAuthGuard)

// JWT + role check
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')

// Current user from JWT
req.user  // → { userId, orgId, role }
```

---

## Audit Actions

| Action | Trigger |
|---|---|
| `user.registered` | POST /auth/register |
| `user.login` | Successful login (normal or MFA) |
| `user.logout` | POST /auth/logout |
| `user.email_verified` | POST /auth/email/verify |
| `user.password_reset` | POST /auth/reset-password |
| `user.mfa_enabled` | POST /auth/mfa/confirm |
| `user.mfa_disabled` | DELETE /auth/mfa |
| `user.sessions_revoked` | DELETE /auth/sessions |
| `user.invited` | POST /users/invite |
| `user.role_changed` | PUT /users/:id/role |
| `user.deactivated` | PUT /users/:id/deactivate |
| `user.activated` | PUT /users/:id/activate |
| `user.force_logout` | DELETE /users/:id/force-logout |

---

## Libraries — What They Do

| Library | Purpose | Laravel equivalent |
|---|---|---|
| `@nestjs/passport` + `passport` | Pluggable auth strategies | Laravel Auth Guard |
| `passport-local` | Email + password strategy | `Auth::attempt()` |
| `passport-jwt` | Validate `Authorization: Bearer` JWT | `auth:sanctum` middleware |
| `@nestjs/jwt` | Sign & verify JWTs | `tymon/jwt-auth` |
| `bcrypt` | Hash passwords + recovery codes | `Hash::make()` / `Hash::check()` |
| `otplib` v13 | TOTP generation & verification (MFA) | No Laravel equivalent |
| `class-validator` | DTO validation | Laravel Form Request |
| `class-transformer` | Transform plain JSON → typed class | No direct equivalent |
| `@prisma/client` + `prisma` | ORM + schema + migrations | Eloquent + `php artisan migrate` |
| `@nestjs/config` | Read `.env` via `ConfigService` | `config()` / `.env` in Laravel |

---

## Key Quirks & Gotchas

- **otplib v13** has a new functional API — no `authenticator` export. Must pass plugin instances:
  ```typescript
  const otpCrypto = new NobleCryptoPlugin();
  const otpBase32 = new ScureBase32Plugin();
  totpVerify({ token, secret, crypto: otpCrypto, base32: otpBase32, strategy: 'totp' })
  ```
- **Prisma JSON fields** (`mfa_recovery_codes`, `metadata`) cannot be set to `null` with `null` literal — use `undefined` to keep them nullable in updates.
- **Soft deletes** — `deleted_at` exists on `Organization` and `User`. Always check `deleted_at` is null + `is_active` is true before allowing login.
- **Email verification required for login** — `validateUser` returns the user even if unverified; the `login()` method then throws 403 if `email_verified_at` is null.
- **MFA recovery codes** — stored as bcrypt hashes in `mfa_recovery_codes` JSON array. Each code is consumed (removed) after use.
- **Refresh token rotation** — old refresh token is revoked before issuing a new pair. Reusing a revoked token returns 401.
- **`X-Session-ID` header** — returned to the client after login (not yet wired into response body); frontend should store and send it to enable "current session" marking and targeted revocation.
- **MailService is console-only** — no SMTP configured yet. All emails are logged via `Logger`. Check the console for verification URLs / reset links during development.
- **`start:prod` script** points to `dist/main` but compiled output is in `dist/src/main.js`. Use `node dist/src/main.js` directly.
