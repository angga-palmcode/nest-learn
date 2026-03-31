# Astos Backend — Project Reference

## Progress

| # | Module (FSD) | Status | Notes |
|---|---|---|---|
| 1 | Authentication & User Management | ✅ Done | JWT + refresh tokens, TOTP MFA, Email OTP MFA, sessions, invitations, password reset, user CRUD, org management |
| 2 | Compliance Engine | ✅ Done | Consent, DNC, recording disclosures, audit trail + CSV export, `runComplianceChecks()` pipeline |
| 3 | Telephony | ✅ Done | `Call` model, list/get/recording/transcript endpoints, Telnyx + Twilio adapters (stubs), provider failover, `placeCall()` internal method |
| 4 | AI Voice Pipeline | ✅ Done (NestJS part) | Voices list, voice preview stub, script validator. STT/LLM/TTS pipeline is Python — not in this repo. |
| 5 | Campaign Management | ✅ Done | `Campaign`, `Lead`, `LeadUpload` models, full CRUD, activate/pause/resume actions, CSV lead upload with async processing |
| 6 | Lead Management | ✅ Done | Expanded `Lead` model (renamed columns, new fields, full `LeadStatus` enum), list/get/update/export endpoints, DNC terminal-state protection |
| 7 | Analytics Dashboard | ✅ Done | `GET /analytics/dashboard` (summary + hourly chart), `GET /analytics/campaigns/:id` (summary, funnel, intent distribution, calls over time with granularity) |
| 8 | Integration & Webhooks | ✅ Done | `WebhookEndpoint` model, CRUD endpoints, HMAC-SHA256 signed delivery, 3-attempt retry with exponential backoff, `dispatch()` internal method, secret rotation |
| 9 | Landing Page | ✅ Done (backend only) | `DemoRequest` model, `POST /public/demo-request` (no auth, 5/hr rate limit), console email notifications |
| 10 | Security & Infrastructure | ✅ Done (NestJS hardening) | `helmet` security headers, CORS, `@nestjs/throttler` global 60 req/min + per-endpoint overrides, global `HttpExceptionFilter` (Appendix A format) |

---

## Stack

- **Framework:** NestJS 11 + TypeScript
- **Database:** PostgreSQL (local: `nest-dev2` on `localhost:5432`)
- **ORM:** Prisma 5
- **Auth:** JWT (access 15 min) + opaque refresh tokens (7 days) + TOTP MFA + Email OTP MFA
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
│   ├── permissions.ts          Central RBAC matrix — all role assignments here
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
│   │   ├── send-mfa-email.dto.ts
│   │   ├── mfa-email-challenge.dto.ts
│   │   ├── accept-invite.dto.ts
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
├── compliance/                 Compliance Engine module
│   ├── compliance.module.ts
│   ├── compliance.service.ts
│   ├── compliance.controller.ts
│   └── dto/
│       ├── record-consent.dto.ts
│       ├── add-dnc.dto.ts
│       ├── create-disclosure.dto.ts
│       ├── update-disclosure.dto.ts
│       └── query-compliance-audit.dto.ts
│
├── ai/                         AI Voice Pipeline module (NestJS surface only)
│   ├── ai.module.ts
│   ├── ai.service.ts
│   ├── ai.controller.ts
│   └── dto/
│       └── validate-script.dto.ts
│
├── campaigns/                  Campaign Management module
│   ├── campaigns.module.ts
│   ├── campaigns.service.ts
│   ├── campaigns.controller.ts
│   └── dto/
│       ├── create-campaign.dto.ts
│       ├── update-campaign.dto.ts
│       └── list-campaigns.dto.ts
│
├── common/
│   └── filters/
│       └── http-exception.filter.ts  Global error format (Appendix A)
│
├── public/                     Public endpoints module (no auth)
│   ├── public.module.ts
│   ├── public.service.ts
│   ├── public.controller.ts
│   └── dto/
│       └── demo-request.dto.ts
│
├── webhooks/                   Integration & Webhooks module
│   ├── webhooks.module.ts
│   ├── webhooks.service.ts
│   ├── webhooks.controller.ts
│   └── dto/
│       ├── create-webhook.dto.ts
│       └── update-webhook.dto.ts
│
├── analytics/                  Analytics Dashboard module
│   ├── analytics.module.ts
│   ├── analytics.service.ts
│   ├── analytics.controller.ts
│   └── dto/
│       ├── dashboard-query.dto.ts
│       └── campaign-analytics-query.dto.ts
│
├── leads/                      Lead Management module
│   ├── leads.module.ts
│   ├── leads.service.ts
│   ├── leads.controller.ts
│   └── dto/
│       ├── list-leads.dto.ts
│       └── update-lead.dto.ts
│
├── telephony/                  Telephony module (Telnyx + Twilio)
│   ├── telephony.module.ts
│   ├── telephony.service.ts
│   ├── telephony.controller.ts
│   ├── providers/
│   │   ├── telephony-provider.interface.ts  ITelephonyProvider interface
│   │   ├── telnyx.adapter.ts               Telnyx adapter (stub)
│   │   └── twilio.adapter.ts               Twilio adapter (stub — failover)
│   └── dto/
│       └── list-calls.dto.ts
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
| failed_login_attempts | INT | default 0; reset on successful login |
| locked_until | TIMESTAMP NULLABLE | set for 15 min after 5 failed attempts |
| invited_by | UUID FK → User NULLABLE | self-referential |
| invited_at | TIMESTAMP NULLABLE | |
| created_at / updated_at / deleted_at | TIMESTAMP | soft delete |

### `MfaEmailToken`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| user_id | UUID FK → User | |
| code_hash | STRING | SHA-256 of the 6-digit OTP |
| expires_at | TIMESTAMP | 5 min from creation |
| created_at | TIMESTAMP | |

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

### `ConsentRecord`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| lead_id | VARCHAR(255) | FK to leads (future module) |
| consent_type | ENUM(prior_express, prior_express_written, implied) | |
| consent_source | VARCHAR(255) | e.g. 'web_form', 'verbal_recording' |
| consent_text | TEXT NULLABLE | Exact consent language |
| consented_at | TIMESTAMP | When consent was given |
| expires_at | TIMESTAMP NULLABLE | NULL = no expiry |
| revoked_at / revoked_reason | TIMESTAMP / VARCHAR NULLABLE | |
| metadata | JSON NULLABLE | |
| created_at / updated_at | TIMESTAMP | |

### `DncRegistry`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| phone_number | VARCHAR(20) | E.164 format, indexed with org_id |
| source | ENUM(national_registry, internal_optout, manual) | |
| reason | VARCHAR(255) NULLABLE | |
| added_at | TIMESTAMP | |
| lead_id / call_id | VARCHAR NULLABLE | FK to leads/calls (future) |
| org_id | UUID NULLABLE | NULL = national/global; set = org-specific |
| created_at | TIMESTAMP | |

### `ComplianceCheck`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| call_id | VARCHAR NULLABLE | FK to calls (future) |
| lead_id | VARCHAR(255) | FK to leads (future) |
| check_type | ENUM(consent, dnc, calling_window, recording_disclosure, optout_detection) | |
| status | ENUM(passed, failed, skipped) | |
| details | JSON | Full check result (see FSD section 2.2) |
| checked_at | TIMESTAMP | |
| created_at | TIMESTAMP | immutable — no UPDATE/DELETE ever |

### `Campaign`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| name | VARCHAR(255) | |
| description | TEXT NULLABLE | |
| status | ENUM(draft, active, paused, completed, archived) | default draft |
| script | TEXT | System prompt / conversation script |
| voice_id | VARCHAR(100) | TTS voice identifier |
| language | VARCHAR(10) | default sv |
| caller_id | VARCHAR(20) | Outbound caller ID (E.164) |
| disclosure_id | UUID FK → RecordingDisclosure | |
| schedule_timezone | VARCHAR(50) | default Europe/Stockholm |
| schedule_start_time | VARCHAR(5) | HH:MM e.g. "09:00" |
| schedule_end_time | VARCHAR(5) | HH:MM e.g. "17:00" |
| schedule_days | JSON | Array of weekday numbers [1-7], 1=Mon |
| max_concurrent_calls | INT | default 10 |
| max_attempts_per_lead | INT | default 3 |
| retry_interval_minutes | INT | default 60 |
| amd_action | ENUM(hang_up, leave_message, retry_later) | default hang_up |
| voicemail_script | TEXT NULLABLE | Used when amd_action = leave_message |
| created_by | UUID FK → User | |
| started_at / completed_at | TIMESTAMP NULLABLE | |
| created_at / updated_at / deleted_at | TIMESTAMP | soft delete |

### `Lead`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| campaign_id | UUID FK → Campaign | |
| name | VARCHAR(255) | |
| phone_number | VARCHAR(20) | E.164 format |
| email | VARCHAR(255) NULLABLE | |
| status | ENUM(new, queued, calling, contacted, interested, not_interested, converted, callback_scheduled, dnc, failed, max_attempts_reached) | default new |
| call_attempts | INT | default 0 |
| last_called_at | TIMESTAMP NULLABLE | |
| next_call_at | TIMESTAMP NULLABLE | Scheduled next call time |
| callback_requested_at | TIMESTAMP NULLABLE | When lead requested callback |
| callback_notes | TEXT NULLABLE | |
| custom_fields | JSON NULLABLE | Extra CSV columns |
| upload_id | VARCHAR(255) NULLABLE | LeadUpload.id that created this lead |
| timezone | VARCHAR(50) NULLABLE | Lead's local timezone |
| created_at / updated_at / deleted_at | TIMESTAMP | soft delete |

### `LeadUpload`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | — | |
| campaign_id | UUID FK → Campaign | |
| status | ENUM(processing, completed, failed) | default processing |
| total_rows / valid_rows / invalid_rows / duplicate_rows | INT | |
| errors | JSON NULLABLE | `[{row, field, error}]` |
| created_at / updated_at | TIMESTAMP | |

### `WebhookEndpoint`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| url | VARCHAR(500) | HTTPS delivery URL |
| secret | VARCHAR(255) | 64-char hex HMAC-SHA256 signing secret |
| events | JSON | Array of subscribed event strings |
| is_active | BOOLEAN | default true |
| created_at / updated_at | TIMESTAMP | |

### `DemoRequest`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| company_name | VARCHAR(255) | required |
| contact_name | VARCHAR(255) | required |
| email | VARCHAR(255) | required |
| phone | VARCHAR(30) NULLABLE | |
| industry | VARCHAR(100) NULLABLE | debt_collection, insurance, banking, healthcare, other |
| message | TEXT NULLABLE | |
| locale | VARCHAR(10) | default sv |
| ip_address | VARCHAR(45) NULLABLE | captured from request |
| created_at | TIMESTAMP | |

### `Call`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| campaign_id | VARCHAR(255) | FK to campaigns (future module) |
| lead_id | VARCHAR(255) | FK to leads (future module) |
| provider | ENUM(telnyx, twilio) | Which provider placed the call |
| provider_call_id | VARCHAR(255) NULLABLE | Provider's call SID |
| from_number | VARCHAR(20) | Caller ID (E.164) |
| to_number | VARCHAR(20) | Lead phone (E.164) |
| status | ENUM(queued, ringing, answered, completed, failed, no_answer, busy, voicemail, cancelled) | |
| direction | ENUM(outbound) | Always outbound for Phase 1A |
| started_at / ended_at | TIMESTAMP NULLABLE | |
| duration_seconds | INT NULLABLE | |
| recording_url | VARCHAR(500) NULLABLE | Cloud Storage URL |
| recording_duration_seconds | INT NULLABLE | |
| amd_result | ENUM(human, voicemail, unknown, not_checked) | default not_checked |
| voicemail_action | ENUM(hung_up, left_message, retry_scheduled) NULLABLE | |
| disconnect_reason | VARCHAR(255) NULLABLE | |
| cost_amount / cost_currency | DECIMAL(10,4) / VARCHAR(3) | default SEK |
| intent_result | ENUM(interested, not_interested, callback_requested, dnc_requested, undetermined) NULLABLE | AI-classified |
| sentiment_score | DECIMAL(3,2) NULLABLE | -1.00 to +1.00 |
| transcript_url | VARCHAR(500) NULLABLE | Cloud Storage URL |
| compliance_result | ENUM(passed, blocked) | |
| compliance_block_reason | VARCHAR(100) NULLABLE | NO_CONSENT / DNC_BLOCKED / OUTSIDE_CALLING_WINDOW |
| metadata | JSON NULLABLE | |
| created_at / updated_at | TIMESTAMP | |

### `RecordingDisclosure`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| name | VARCHAR(255) | e.g. "Swedish Default" |
| language | VARCHAR(10) | sv, en |
| text | TEXT | Full disclosure text |
| audio_url | VARCHAR(500) | URL to pre-recorded audio |
| duration_ms | INT | Audio duration |
| jurisdiction | VARCHAR(50) | e.g. 'SE', 'NO' |
| is_default | BOOLEAN | Default for org + jurisdiction + language |
| created_at / updated_at | TIMESTAMP | |

---

## API Endpoints

### Auth (`/auth`)

| Method | Path | Guard | Body | Description |
|--------|------|-------|------|-------------|
| POST | `/auth/register` | none | `{ name, email, password, password_confirmation, organization_name, industry?, locale? }` | Creates org + admin user, sends verification email |
| POST | `/auth/login` | none | `{ email, password, device_name? }` | Returns token pair + session_id, or `mfa_required + mfa_token + mfa_method`. Blocks if unverified. 429 if locked. |
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
| POST | `/auth/mfa/challenge` | none | `{ mfa_token, code }` | Login step 2: TOTP → full tokens + session_id |
| POST | `/auth/mfa/recover` | none | `{ mfa_token, recovery_code }` | Login step 2: recovery code → full tokens + session_id |
| POST | `/auth/mfa/send-email` | none | `{ mfa_token }` | Send 6-digit OTP to user's email (email MFA flow) |
| POST | `/auth/mfa/challenge/email` | none | `{ mfa_token, code }` | Login step 2: email OTP → full tokens + session_id |
| GET | `/auth/accept-invite/:token` | none | — | Get invitation details (email, org, role) |
| POST | `/auth/accept-invite` | none | `{ token, name, password, password_confirmation }` | Accept invite → creates account + auto-login tokens |
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

### Compliance (`/compliance`) — all require JWT

| Method | Path | Role | Body / Query | Description |
|--------|------|------|-------------|-------------|
| POST | `/compliance/consent` | admin, manager | `{ lead_id, consent_type, consent_source, consent_text?, consented_at, expires_at? }` | Record consent for a lead |
| GET | `/compliance/consent/:lead_id` | admin, manager | — | Get consent history for a lead |
| GET | `/compliance/dnc/check/:phone_number` | all roles | — | Check if number is on DNC |
| POST | `/compliance/dnc` | admin, manager | `{ phone_number, reason?, lead_id? }` | Manually add number to DNC |
| POST | `/compliance/dnc/sync` | admin | — | Trigger national DNC registry sync (stub) |
| GET | `/compliance/disclosures` | admin, manager | — | List recording disclosures for org |
| POST | `/compliance/disclosures` | admin, manager | `{ name, language, text, audio_url, duration_ms, jurisdiction, is_default? }` | Create disclosure |
| PUT | `/compliance/disclosures/:id` | admin, manager | partial disclosure fields | Update disclosure |
| GET | `/compliance/audit` | admin | `?call_id=&lead_id=&check_type=&status=&date_from=&date_to=&sort=&page=&page_size=` | Query compliance audit trail |
| GET | `/compliance/audit/export` | admin | same filters as audit | Download audit as CSV |

### AI (`/ai`) — all require JWT

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/ai/voices` | all roles | List available TTS voices |
| GET | `/ai/voices/:id/preview` | all roles | Get voice preview URL (stub — Cartesia integration pending) |
| POST | `/ai/scripts/validate` | admin, manager | Validate script: extract `{variables}`, estimate tokens, check syntax |

### Campaigns (`/campaigns`) — all require JWT

| Method | Path | Role | Body / Query | Description |
|--------|------|------|-------------|-------------|
| POST | `/campaigns` | admin, manager | `{ name, script, voice_id, caller_id, disclosure_id, schedule_start_time, schedule_end_time, schedule_days, ... }` | Create campaign |
| GET | `/campaigns` | admin, manager | `?status=&search=&sort=&include=leadStats&page=&page_size=` | List campaigns |
| GET | `/campaigns/:id` | admin, manager | — | Get campaign details |
| PUT | `/campaigns/:id` | admin, manager | partial fields | Update (draft or paused only) |
| DELETE | `/campaigns/:id` | admin | — | Soft delete (draft or completed only) |
| POST | `/campaigns/:id/activate` | admin, manager | — | Activate campaign (requires ≥1 lead + valid disclosure) |
| POST | `/campaigns/:id/pause` | admin, manager | — | Pause active campaign |
| POST | `/campaigns/:id/resume` | admin, manager | — | Resume paused campaign |
| POST | `/campaigns/:id/leads/upload` | admin, manager | `multipart/form-data: file, field_mapping (JSON), skip_first_row` | Upload CSV leads → 202 + upload_id |
| GET | `/campaigns/:id/leads/uploads/:upload_id` | admin, manager | — | Check upload status |

### Leads (`/campaigns/:campaign_id/leads`) — all require JWT

| Method | Path | Role | Body / Query | Description |
|--------|------|------|-------------|-------------|
| GET | `/campaigns/:campaign_id/leads` | admin, manager | `?status=&search=&sort=&page=&page_size=` | List leads with filters + pagination |
| GET | `/campaigns/:campaign_id/leads/export` | admin, manager | same filters (no pagination) | Download leads as CSV |
| GET | `/campaigns/:campaign_id/leads/:id` | admin, manager | — | Get lead details + full call history |
| PUT | `/campaigns/:campaign_id/leads/:id` | admin, manager | `{ status?, callback_notes?, next_call_at?, callback_requested_at? }` | Update lead (DNC leads are immutable) |

### Calls (`/calls`) — all require JWT

| Method | Path | Role | Body / Query | Description |
|--------|------|------|-------------|-------------|
| GET | `/calls` | admin, manager | `?campaign_id=&lead_id=&status=&intent_result=&date_from=&date_to=&sort=&include=&page=&page_size=` | List calls with filters + pagination |
| GET | `/calls/:id` | admin, manager | — | Get call details + compliance checks |
| GET | `/calls/:id/recording` | admin, manager | — | Get pre-signed recording URL (expires 1h) |
| GET | `/calls/:id/transcript` | admin, manager | — | Get call transcript |

### Analytics (`/analytics`) — all require JWT

| Method | Path | Role | Body / Query | Description |
|--------|------|------|-------------|-------------|
| GET | `/analytics/dashboard` | admin, manager | `?date_from=&date_to=` | Main dashboard: active campaigns, calls today, connection rate, conversions, hourly chart |
| GET | `/analytics/campaigns/:id` | admin, manager | `?date_from=&date_to=&granularity=day\|hour\|week\|month` | Campaign analytics: summary, funnel, intent distribution, calls over time |

### Webhooks (`/webhooks`) — all require JWT

| Method | Path | Role | Body / Query | Description |
|--------|------|------|-------------|-------------|
| POST | `/webhooks` | admin | `{ url, events[] }` | Register a webhook endpoint (secret auto-generated) |
| GET | `/webhooks` | admin | — | List webhook endpoints for the org |
| GET | `/webhooks/:id` | admin | — | Get a webhook endpoint |
| PUT | `/webhooks/:id` | admin | `{ url?, events[]?, is_active? }` | Update a webhook endpoint |
| DELETE | `/webhooks/:id` | admin | — | Delete a webhook endpoint |
| POST | `/webhooks/:id/rotate-secret` | admin | — | Rotate signing secret → returns new secret |

### Public (`/public`) — no authentication

| Method | Path | Role | Body | Description |
|--------|------|------|------|-------------|
| POST | `/public/demo-request` | none | `{ company_name, contact_name, email, phone?, industry?, message?, locale? }` | Submit demo request — rate limited 5/hr per IP |

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
→ { access_token, refresh_token, session_id }
  ↓ UserSession created
```

### Login with MFA
```
POST /auth/login { email, password }
→ { mfa_required: true, mfa_token, mfa_method: 'totp'|'email' }   ← valid 5 minutes
  mfa_method = 'totp'  → user has TOTP enabled
  mfa_method = 'email' → org enforces MFA but user has no TOTP (email OTP fallback)

# TOTP method:
POST /auth/mfa/challenge { mfa_token, code }
→ { access_token, refresh_token, session_id }

# Email OTP method:
POST /auth/mfa/send-email { mfa_token }   → sends 6-digit code to user's email
POST /auth/mfa/challenge/email { mfa_token, code }
→ { access_token, refresh_token, session_id }

# Recovery code (either MFA method):
POST /auth/mfa/recover { mfa_token, recovery_code }
→ { access_token, refresh_token, session_id }
```

### Accept Invitation
```
GET  /auth/accept-invite/:token          → { email, role, org: { name, slug } }
POST /auth/accept-invite { token, name, password, password_confirmation }
→ { access_token, refresh_token, session_id, user: { id, name, email, role } }
  ↓ email is auto-verified, user is logged in immediately
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

- **Brute-force lockout** — after 5 failed login attempts, `locked_until` is set to 15 min in the future. `validateUser()` throws 429 (`HttpException` with `HttpStatus.TOO_MANY_REQUESTS`) — NestJS 11 does not export `TooManyRequestsException`, use `HttpException` directly.
- **Email OTP MFA** — stored as a SHA-256 hash (not bcrypt) in `MfaEmailToken`. One active token per user; previous token is deleted before issuing a new one. Single-use: deleted on successful verify.
- **`mfa_method` in login response** — `'totp'` when user has TOTP enabled, `'email'` when org enforces MFA but user has no TOTP set up. Frontend uses this to decide which challenge screen to show.
- **Accept invite auto-login** — accepted users have `email_verified_at` set automatically (no email verification step needed). The endpoint returns tokens directly.
- **ComplianceCheck is immutable** — insert-only table. No UPDATE or DELETE operations exist anywhere in the codebase. Do not add them.
- **DNC check scope** — queries `DncRegistry` where `org_id = orgId` OR `org_id IS NULL`. `NULL` org_id = national registry entries (global). Org-specific opt-outs have `org_id` set.
- **`POST /compliance/dnc/sync`** — stub endpoint. Logs intent and returns 201. No national registry API is integrated yet.
- **Compliance pipeline `runComplianceChecks()`** — internal service method in `ComplianceService`, not exposed as an HTTP route. Called by the Campaign Dialer module (future). Steps: consent → DNC → calling window. Saves a `ComplianceCheck` record for each step.
- **CSV export** — synchronous, streams directly to response. No async job queue. Controller uses `@Res()` with `import type { Response }` (required for `isolatedModules` + `emitDecoratorMetadata`).
- **Disclosure `is_default`** — when set to true, automatically unsets `is_default` on other disclosures with the same `org_id + jurisdiction + language` combination.
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
- **`session_id`** — now returned in the response body of all login endpoints (normal login, TOTP challenge, email OTP challenge, recovery, accept-invite). Frontend should store it and send as `X-Session-ID` header for session listing and targeted revocation.
- **MailService is console-only** — no SMTP configured yet. All emails are logged via `Logger`. Check the console for verification URLs / reset links during development.
- **`start:prod` script** points to `dist/main` but compiled output is in `dist/src/main.js`. Use `node dist/src/main.js` directly.
- **Telephony providers are stubs** — `TelnyxAdapter` and `TwilioAdapter` throw `Error('not yet implemented')` on every method. Wire up real SDKs (`telnyx`, `twilio` npm packages) when integrating.
- **Telephony failover** — `placeCall()` tries Telnyx first; on any thrown error, retries via Twilio. If both fail, saves a `failed` Call record. All failures logged via `Logger`.
- **`GET /calls/:id/recording`** — returns `recording_url` directly (no real pre-signed URL yet). Replace with GCS/S3 signed URL when Cloud Storage is configured.
- **`GET /calls/:id/transcript`** — returns `transcript_url` only (no JSON fetch). Replace with actual fetch + parse from Cloud Storage.
- **`placeCall()` is internal** — not exposed as an HTTP route. Will be called by the Campaign Dialer module. Requires `callingWindowStart`, `callingWindowEnd`, and `timezone` from campaign config.
- **AI Voice Pipeline is Python** — STT (Deepgram/AssemblyAI), LLM (GPT-4o/Claude Haiku), TTS (Cartesia/ElevenLabs) all live in the Python AI service. The NestJS `AiModule` only exposes 3 utility endpoints.
- **`GET /ai/voices/:id/preview`** — stub. Returns `preview_url: null` until Cartesia API is integrated.
- **`POST /ai/scripts/validate`** — validates `{variable}` syntax, extracts variable names, estimates token count (`chars / 4`). Warns if estimated tokens > 8,000.
- **Voices are hardcoded** — 4 defaults (sv/en × female/male). Extend `VOICES` array in `ai.service.ts` when real Cartesia voice IDs are available.
- **Campaign `schedule_start_time` / `schedule_end_time`** — stored as `VARCHAR(5)` strings in `HH:MM` format (not a DB TIME type). Parse with `split(':')` to get hours/minutes.
- **CSV lead upload is async** — `POST /campaigns/:id/leads/upload` returns 202 immediately with an `upload_id`. Processing happens in the background via an unawaited Promise. Poll `GET /campaigns/:id/leads/uploads/:upload_id` for completion.
- **Phone normalization in CSV upload** — Swedish numbers without country code (`07XXXXXXXX`) are automatically prefixed with `+46`. Numbers starting with `00` are converted to `+`. E.164 numbers with `+` are accepted as-is.
- **Duplicate lead detection** — during CSV upload, a lead is considered a duplicate if the same `phone_number` already exists in the campaign. Duplicates are counted but not re-created.
- **Campaign activate preconditions** — (1) status must be `draft` or `paused`, (2) must have ≥1 lead, (3) `disclosure_id` must point to an existing disclosure in the org.
- **`leadStats` include** — appended to each campaign in `GET /campaigns` when `include=leadStats`. Adds `{ total, contacted, converted }` counts via separate count queries.
- **Lead DNC is a terminal state** — `PUT /campaigns/:campaign_id/leads/:id` throws 403 if the lead's current status is `dnc`. The `dnc` and `max_attempts_reached` statuses are also excluded from the `status` field in `UpdateLeadDto`; they can only be set by the dialer engine internally.
- **Lead `export` route before `/:id`** — `GET /campaigns/:campaign_id/leads/export` must be declared before `GET /campaigns/:campaign_id/leads/:id` in the controller to avoid NestJS routing `export` as an `:id` param.
- **Lead CSV export** — synchronous, streams directly to response using `res.write()` / `res.end()`. No pagination — returns all matching leads. Controller uses `@Res()` with `import type { Response }` (required for `isolatedModules`).
- **Lead schema migration (Module 6)** — applied via `npx prisma db push --accept-data-loss` (non-interactive shell). Manual migration file at `prisma/migrations/20260331060000_lead_management/migration.sql` for tracking. Renamed: `phone→phone_number`, `attempt_count→call_attempts`, `last_attempted_at→last_called_at`.
- **Analytics uses raw SQL (`$queryRaw`)** — hourly grouping (`EXTRACT(HOUR FROM started_at)`) and `DATE_TRUNC` for time-series are not expressible via Prisma's query API. Raw SQL is scoped to org + campaign via parameterized `orgId`/`campaignId` — no injection risk.
- **Analytics `granularity` inlined via `Prisma.raw`** — validated to one of `['hour', 'day', 'week', 'month']` by DTO `@IsIn` before use in `DATE_TRUNC`. Never pass unvalidated user input to `Prisma.raw`.
- **Analytics cost fields** — `aggregates._sum.cost_amount` returns a `Decimal | null`; convert with `.toString()` before `parseFloat`. Never compare Prisma Decimals directly.
- **`funnel.contacted`** — counts leads whose status is any of `contacted, interested, not_interested, converted, callback_scheduled` (all states that imply at least one successful contact).
- **Webhook secret auto-generated** — `POST /webhooks` generates a 64-char hex secret via `crypto.randomBytes(32)`. The secret is returned only in the creation response and on `POST /webhooks/:id/rotate-secret`. It is never returned in list/get responses.
- **Webhook HMAC-SHA256 signature** — payload is the raw JSON body string. Signature header: `X-Astos-Signature: sha256=<hex>`. Receivers verify with `HMAC-SHA256(body, secret)`.
- **Webhook retry policy** — 3 attempts with delays 10s → 60s → 300s. Implemented as recursive async calls with `setTimeout`. After all retries exhausted, logs an error. No persistent delivery log table — failures are console-only.
- **Webhook delivery uses native `fetch`** — available in Node.js 22 without `node-fetch`. Uses `AbortSignal.timeout(10_000)` for a 10-second per-attempt timeout.
- **`dispatch()` is fire-and-forget** — call sites (e.g. dialer engine) call `webhooksService.dispatch(orgId, payload)` without `await`. Errors are caught internally and logged.
- **Webhook `events` validation** — `@Matches(/^(call|lead|campaign)\.\w+$/, { each: true })` allows any `domain.action` pattern matching those three namespaces. Extend the regex when new domains are added.
- **Global `HttpExceptionFilter`** — catches all `HttpException` and unhandled `Error` instances, returns Appendix A format: `{ message, errors?, error_code, timestamp, trace_id }`. Registered in `main.ts` via `app.useGlobalFilters()`. ValidationPipe errors (array-shaped message) are automatically reshaped into `errors: { field: [msg] }` with `error_code: "VALIDATION_ERROR"`.
- **Rate limiting via `@nestjs/throttler`** — `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])` sets a 60 req/min default applied globally via `APP_GUARD`. `POST /public/demo-request` overrides to 5/hr with `@Throttle({ default: { ttl: 3_600_000, limit: 5 } })`. 429 responses are caught by the global filter → `error_code: "RATE_LIMITED"`.
- **Helmet** — `app.use(helmet())` in `main.ts` adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy`, and CSP headers automatically.
- **CORS** — `app.enableCors({ origin: FRONTEND_URL, credentials: true })`. Origin defaults to `http://localhost:5173` if env var is not set.
- **`POST /public/demo-request` is fully public** — no `JwtAuthGuard`, no `RolesGuard`. IP captured with `@Ip()` decorator and stored in `DemoRequest.ip_address`.
- **Pagination format** — NestJS convention uses flat params (`?page=1&page_size=25`), NOT the Laravel/Spatie bracket format (`page[number]=1`). All list endpoints use the flat format. Appendix C in the FSD describes the Laravel format which does not apply to this codebase.
