# ASTOS VOICE AI PLATFORM — Functional Specification Document (FSD)

**Version:** 1.0
**Date:** March 3, 2026
**Scope:** Phase 1A — MVP Compliant Outbound Platform
**Classification:** Confidential
**Status:** Draft

---

## Document Purpose

This FSD is the **definitive technical reference** for building Phase 1A of the Astos Voice AI Platform. It translates every PRD requirement into explicit functional behavior, API contracts, data models, UI specifications, error handling, and acceptance criteria.

**This document is designed to be consumed by both human developers and AI coding agents.** Every specification is written to be unambiguous, self-contained, and implementable without requiring additional clarification. If a behavior is not specified here, it should not be built.

> **NestJS Implementation Note:** The original FSD was authored for a Laravel/Spatie stack. The NestJS backend implements the same business logic but uses NestJS conventions where they differ. **The implemented code is the authoritative source of truth** — not the raw FSD text. Key divergences:
> - **Pagination:** NestJS uses flat params (`?page=1&page_size=25`) — not Laravel's `page[number]=1&page[size]=25` bracket format (see Appendix C).
> - **Endpoint prefix:** NestJS routes are served at `/` (e.g. `/auth/login`) — not `/api/` as specified in the Laravel section headers.
> - **Auth tokens:** JWT access + opaque refresh tokens — not Laravel Sanctum `personal_access_tokens`.
> - **Modules 6–10 and Appendices** were added during NestJS implementation and document NestJS behavior directly.

---

## Tech Stack Reference

| Layer | Technology | Version / Notes |
|---|---|---|
| Frontend | Next.js (React) | Latest stable. App Router. TypeScript required. |
| Backend API | **NestJS 11 (TypeScript)** | RESTful JSON API. Node.js 22 runtime. |
| Authentication | **JWT + opaque refresh tokens** | Access token 15 min, refresh token 7 days. TOTP MFA + Email OTP MFA. |
| AI Services | Python (FastAPI) | Voice pipeline, STT/TTS orchestration, LLM engine. Not in this repo. |
| Database | PostgreSQL 15+ | Local dev: `nest-dev2` on `localhost:5432`. Production: GCP Cloud SQL. |
| ORM | **Prisma 5** | Schema-first, migrations via `prisma migrate dev` / `db push`. |
| Cache | Redis (GCP Memorystore) | Not yet integrated in NestJS — reserved for sessions and active call state. |
| Message Queue | GCP Pub/Sub + Redis Streams | Not yet integrated — reserved for real-time events and analytics pipeline. |
| Cloud | Google Cloud Platform (GCP) | GKE, Cloud SQL, Cloud Storage, Memorystore, Pub/Sub. |
| Storage | GCP Cloud Storage | Call recordings, CSV uploads, exports. Not yet integrated. |
| CI/CD | GitHub Actions + Cloud Build | Blue-green deployment to GKE. |
| Monitoring | Prometheus + Grafana | OpenTelemetry + Jaeger for tracing. Not yet integrated. |

### Coding Conventions

- **API format:** All API responses use JSON. Endpoints are served at root (e.g. `/auth/login`) — no `/api/` prefix.
- **Query parameters:** All list/index endpoints use flat query params (NestJS/class-validator DTOs):
  - **Filtering:** `?status=active&role=admin` — flat params, no bracket notation
  - **Sorting:** `?sort=field` (ascending) or `?sort=-field` (descending) — e.g., `?sort=-created_at`
  - **Including relations:** `?include=relation1,relation2` — e.g., `?include=leadStats`
  - **Pagination:** `?page=1&page_size=25` — flat params (not bracket notation)
  - All query params are validated and whitelisted by NestJS DTO classes using `class-validator`. Unknown params are rejected (`forbidNonWhitelisted: true`).
- **Timestamps:** All timestamps are stored and returned in ISO 8601 UTC format (`2026-03-03T14:30:00Z`).
- **UUIDs:** All primary keys use UUIDv4 (not auto-increment integers). This applies to all tables.
- **Soft deletes:** All models use soft deletes (`deleted_at` column). No hard deletes except for GDPR right-to-deletion requests.
- **Multi-tenancy:** Every database table that stores tenant data must include an `org_id` column. Every query must scope by `org_id`.
- **Validation:** All input validation happens at the NestJS API layer using ValidationPipe + class-validator DTO classes. The frontend performs client-side validation for UX but never trusts it for security.
- **Error format:** All API errors return a consistent JSON structure (see Appendix A).
- **Language:** All code comments, variable names, API field names, and documentation are in English. User-facing UI text supports Swedish (primary) and English.

---

## 1. MODULE: Authentication & User Management

**PRD References:** AUTH-001 through AUTH-008, SEC-001, SEC-002
**Priority:** CRITICAL
**Owner:** Backend (NestJS) + Frontend (Next.js)

### 1.1 Overview

Authentication is the first system a user interacts with. It controls access to every other module. The system uses **JWT access tokens + opaque refresh tokens**. The Next.js frontend communicates with the NestJS API exclusively via authenticated API calls using Bearer tokens.

**Authentication mode: JWT + Opaque Refresh Tokens.**
- On successful login, the API issues a short-lived JWT access token (15 min) and a long-lived opaque refresh token (7 days). The frontend stores the refresh token securely and uses it to obtain new access tokens.
- Every API request includes the JWT in the `Authorization: Bearer {token}` header.
- No server-side session state for JWT validation. Sessions (`user_sessions`) are tracked separately for device/session management.
- Access tokens are validated on every request by verifying the JWT signature. Refresh tokens are validated by lookup in the `refresh_tokens` table.
- This approach enables full API portability — the same token works from the Next.js frontend, mobile apps, or third-party integrations.

### 1.2 Data Models

#### Table: `organizations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Organization identifier |
| `name` | VARCHAR(255) | NOT NULL | Company name |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | URL-safe identifier |
| `industry` | VARCHAR(100) | NULLABLE | Industry vertical (debt_collection, insurance, banking, healthcare) |
| `mfa_enforced` | BOOLEAN | DEFAULT false | Whether MFA is required for all users in this org |
| `max_concurrent_calls` | INTEGER | DEFAULT 100 | Max concurrent calls allowed |
| `timezone` | VARCHAR(50) | DEFAULT 'Europe/Stockholm' | Organization default timezone |
| `locale` | VARCHAR(10) | DEFAULT 'sv' | Default language (sv, en) |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| `deleted_at` | TIMESTAMP | NULLABLE | Soft delete |

#### Table: `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | User identifier |
| `org_id` | UUID | FK → organizations.id, NOT NULL | Organization this user belongs to |
| `name` | VARCHAR(255) | NOT NULL | Full name |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email address (used for login) |
| `password` | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| `role` | ENUM('admin', 'manager', 'agent') | NOT NULL | User role |
| `email_verified_at` | TIMESTAMP | NULLABLE | NULL = not verified |
| `mfa_enabled` | BOOLEAN | DEFAULT false | Whether user has MFA active |
| `mfa_secret` | VARCHAR(255) | NULLABLE, ENCRYPTED | TOTP secret key |
| `mfa_recovery_codes` | JSON | NULLABLE, ENCRYPTED | Array of recovery codes |
| `last_login_at` | TIMESTAMP | NULLABLE | Last successful login |
| `last_login_ip` | VARCHAR(45) | NULLABLE | Last login IP (IPv4 or IPv6) |
| `is_active` | BOOLEAN | DEFAULT true | Deactivated users cannot log in |
| `failed_login_attempts` | INTEGER | DEFAULT 0 | Reset on successful login |
| `locked_until` | TIMESTAMP | NULLABLE | Set to now+15min after 5 failed attempts |
| `invited_by` | UUID | FK → users.id, NULLABLE | Who invited this user |
| `invited_at` | TIMESTAMP | NULLABLE | When invitation was sent |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| `deleted_at` | TIMESTAMP | NULLABLE | Soft delete |

#### Table: `refresh_tokens`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `token` | STRING | UNIQUE, NOT NULL | Opaque 128-char hex; stored plain |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `expires_at` | TIMESTAMP | NOT NULL | 7 days from creation |
| `created_at` | TIMESTAMP | NOT NULL | |
| `revoked_at` | TIMESTAMP | NULLABLE | Set on logout or token rotation |

#### Table: `mfa_email_tokens`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `code_hash` | STRING | NOT NULL | SHA-256 of the 6-digit OTP |
| `expires_at` | TIMESTAMP | NOT NULL | 5 min from creation |
| `created_at` | TIMESTAMP | NOT NULL | |

#### Table: `password_reset_tokens`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `email` | VARCHAR(255) | NOT NULL | |
| `token` | VARCHAR(64) | UNIQUE, NOT NULL | 32-byte random hex |
| `expires_at` | TIMESTAMP | NOT NULL | 1 hour from creation |
| `created_at` | TIMESTAMP | NOT NULL | |

#### Table: `user_sessions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Session identifier |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `ip_address` | VARCHAR(45) | NOT NULL | Client IP |
| `user_agent` | TEXT | NOT NULL | Browser/client user agent string |
| `device_name` | VARCHAR(255) | NULLABLE | Parsed device name (e.g., "Chrome on MacOS") |
| `last_active_at` | TIMESTAMP | NOT NULL | Updated on every authenticated request |
| `expires_at` | TIMESTAMP | NOT NULL | Session expiration (24h from last activity) |
| `created_at` | TIMESTAMP | NOT NULL | |

#### Table: `user_invitations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | FK → organizations.id, NOT NULL | |
| `email` | VARCHAR(255) | NOT NULL | Invitee email |
| `role` | ENUM('admin', 'manager', 'agent') | NOT NULL | Assigned role |
| `invited_by` | UUID | FK → users.id, NOT NULL | |
| `token` | VARCHAR(64) | UNIQUE, NOT NULL | Invitation token |
| `accepted_at` | TIMESTAMP | NULLABLE | NULL = pending |
| `expires_at` | TIMESTAMP | NOT NULL | 7 days from creation |
| `created_at` | TIMESTAMP | NOT NULL | |

#### Table: `audit_logs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | FK → organizations.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NULLABLE | NULL for system events |
| `action` | VARCHAR(100) | NOT NULL | Action identifier (e.g., 'user.login', 'user.mfa_enabled', 'campaign.created') |
| `resource_type` | VARCHAR(100) | NULLABLE | Model class name |
| `resource_id` | UUID | NULLABLE | Resource identifier |
| `metadata` | JSON | NULLABLE | Additional context (IP, user agent, changed fields, etc.) |
| `ip_address` | VARCHAR(45) | NULLABLE | |
| `created_at` | TIMESTAMP | NOT NULL | Immutable — no updated_at |

### 1.3 API Endpoints

#### 1.3.1 POST `/auth/register`

**Purpose:** Create a new user account and organization.
**Authentication:** None (public endpoint).
**Rate limit:** 3 requests per IP per hour.

**Request body:**
```json
{
  "name": "Erik Johansson",
  "email": "erik@company.se",
  "password": "SecureP@ss123",
  "password_confirmation": "SecureP@ss123",
  "organization_name": "Stockholm Collections AB",
  "industry": "debt_collection",
  "locale": "sv"
}
```

**Validation rules:**
| Field | Rules |
|---|---|
| `name` | Required. String. 2–255 characters. |
| `email` | Required. Valid email format. Unique in `users` table. |
| `password` | Required. Min 8 characters. Must contain: 1 uppercase, 1 lowercase, 1 number, 1 special character. |
| `password_confirmation` | Required. Must match `password`. |
| `organization_name` | Required. String. 2–255 characters. |
| `industry` | Optional. Must be one of: `debt_collection`, `insurance`, `banking`, `healthcare`, `other`. |
| `locale` | Optional. Must be one of: `sv`, `en`. Defaults to `sv`. |

**Success response (201 Created):**
```json
{
  "data": {
    "user": {
      "id": "uuid-here",
      "name": "Erik Johansson",
      "email": "erik@company.se",
      "role": "admin",
      "email_verified": false,
      "organization": {
        "id": "uuid-here",
        "name": "Stockholm Collections AB",
        "slug": "stockholm-collections-ab"
      }
    },
    "message": "Registration successful. Please check your email to verify your account."
  }
}
```

**Side effects:**
1. Creates organization record.
2. Creates user record with role `admin` (first user of an org is always admin).
3. Sends verification email with a signed URL valid for 24 hours.
4. Logs `user.registered` to `audit_logs`.

**Error responses:**
| Status | Condition | Body |
|---|---|---|
| 422 | Validation failure | `{ "message": "...", "errors": { "email": ["The email has already been taken."] } }` |
| 429 | Rate limit exceeded | `{ "message": "Too many registration attempts. Please try again later.", "retry_after": 3600 }` |

---

#### 1.3.2 POST `/auth/login`

**Purpose:** Authenticate a user and issue a session.
**Authentication:** None (public endpoint).
**Rate limit:** 5 failed attempts per email per 15 minutes.

**Request body:**
```json
{
  "email": "erik@company.se",
  "password": "SecureP@ss123",
  "device_name": "Chrome on MacOS"
}
```

**Validation rules:**
| Field | Rules |
|---|---|
| `email` | Required. Valid email format. |
| `password` | Required. String. |
| `device_name` | Optional. String. Max 255 chars. Defaults to parsed user agent. |

**Flow logic:**
1. Look up user by email. If not found → 401.
2. Check `is_active`. If false → 403 with message "Your account has been deactivated."
3. Check `email_verified_at`. If NULL → 403 with message "Please verify your email before logging in."
4. Verify password using bcrypt compare. If wrong → increment `failed_login_attempts` → 401.
5. If `failed_login_attempts` >= 5 → set `locked_until = now + 15min` → 429 with lockout message + send lockout notification email.
6. If `organizations.mfa_enforced` is true OR `users.mfa_enabled` is true → return 200 with `mfa_required: true` and short-lived `mfa_token` JWT (5 min, type: `mfa_pending`). Do NOT issue access/refresh tokens yet.
7. If MFA not required → issue JWT access token (15 min) + opaque refresh token (7 days), create `user_sessions` record, update `last_login_at` and `last_login_ip`.

**Success response — no MFA (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6...",
  "session_id": "uuid-here",
  "user": {
    "id": "uuid-here",
    "name": "Erik Johansson",
    "email": "erik@company.se",
    "role": "admin",
    "mfa_enabled": false,
    "organization": {
      "id": "uuid-here",
      "name": "Stockholm Collections AB",
      "slug": "stockholm-collections-ab",
      "mfa_enforced": false
    }
  }
}
```

**Success response — MFA required (200 OK):**
```json
{
  "mfa_required": true,
  "mfa_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "mfa_method": "totp"
}
```

> `mfa_method` is `"totp"` when user has TOTP enabled; `"email"` when org enforces MFA but user has no TOTP configured (email OTP fallback). Frontend uses this to decide which challenge screen to show.

**Error responses:**
| Status | Condition | Body |
|---|---|---|
| 401 | Invalid credentials | `{ "message": "Invalid email or password." }` |
| 403 | Account deactivated | `{ "message": "Your account has been deactivated. Contact your administrator." }` |
| 403 | Email not verified | `{ "message": "Please verify your email before logging in.", "action": "resend_verification" }` |
| 429 | Rate limited (lockout) | `{ "message": "Too many failed attempts. Account locked for 15 minutes.", "retry_after": 900, "locked_until": "2026-03-03T14:45:00Z" }` |

---

#### 1.3.3 MFA Challenge Endpoints

**POST `/auth/mfa/challenge`** — TOTP MFA step 2.
**Authentication:** Requires `mfa_token` from login response.

**Request body:**
```json
{
  "mfa_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "code": "123456"
}
```

**Flow:** Validate `mfa_token` JWT (5-min TTL, type `mfa_pending`). Verify TOTP code against user's `mfa_secret` (30-second window, ±1 period drift). On success → issue access token + refresh token + session_id.

**Success response (200 OK):** Same shape as normal login success (`access_token`, `refresh_token`, `session_id`, `user`).

---

**POST `/auth/mfa/send-email`** — Send email OTP for email MFA flow.
**Request:** `{ "mfa_token": "..." }`
**Flow:** Validate `mfa_token`, send 6-digit OTP to user's email (stored as SHA-256 hash in `mfa_email_tokens`, 5-min TTL). One active token per user; previous token deleted before issuing new one.

---

**POST `/auth/mfa/challenge/email`** — Email OTP MFA step 2.
**Request:** `{ "mfa_token": "...", "code": "123456" }`
**Flow:** Validate `mfa_token` JWT. Verify SHA-256(code) against `mfa_email_tokens`. On success → delete token, issue access token + refresh token + session_id.

---

**POST `/auth/mfa/recover`** — Recovery code MFA step 2.
**Request:** `{ "mfa_token": "...", "recovery_code": "a1b2c3d4e5" }`
**Flow:** Validate `mfa_token` JWT. Verify recovery code against bcrypt-hashed codes in `mfa_recovery_codes`. On success → remove used code, issue access token + refresh token + session_id.

**Error responses (all MFA challenge endpoints):**
| Status | Condition | Body |
|---|---|---|
| 401 | Invalid or expired MFA code | `{ "message": "Invalid verification code.", "error_code": "UNAUTHENTICATED" }` |
| 401 | MFA token expired | `{ "message": "MFA session expired. Please log in again.", "error_code": "UNAUTHENTICATED" }` |

---

#### 1.3.4 POST `/auth/logout`

**Purpose:** Revoke the current session token.
**Authentication:** Required (Bearer token).

**Request body:** None.

**Request body:** `{ "refresh_token": "..." }` + `X-Session-ID` header.

**Flow logic:**
1. Revoke the provided refresh token (set `revoked_at`).
2. Delete the corresponding `user_sessions` record (identified by `X-Session-ID`).
3. Log `user.logout` to `audit_logs`.

**Success response (200 OK):**
```json
{
  "message": "Successfully logged out."
}
```

---

#### 1.3.5 POST `/auth/forgot-password`

**Purpose:** Initiate password reset flow.
**Authentication:** None (public endpoint).
**Rate limit:** 3 requests per email per hour.

**Request body:**
```json
{
  "email": "erik@company.se"
}
```

**Flow logic:**
1. Look up user by email. **Always return 200** regardless of whether user exists (prevents email enumeration).
2. If user exists → generate 32-byte random hex token (60-minute TTL), store in `password_reset_tokens` table, send reset email with link.
3. Reset link format: `{FRONTEND_URL}/auth/reset-password?token={token}&email={email}`

**Success response (200 OK):**
```json
{
  "message": "If an account with that email exists, we have sent a password reset link."
}
```

---

#### 1.3.6 POST `/auth/reset-password`

**Purpose:** Complete password reset.
**Authentication:** None (public, token-validated).

**Request body:**
```json
{
  "token": "reset-token-here",
  "email": "erik@company.se",
  "password": "NewSecureP@ss456",
  "password_confirmation": "NewSecureP@ss456"
}
```

**Flow logic:**
1. Validate token exists, matches email, and has not expired (60 minutes).
2. Validate new password meets strength requirements.
3. Update user's password (bcrypt hash).
4. Revoke all refresh tokens for this user (set `revoked_at`). Delete `password_reset_tokens` record.
5. Delete all `user_sessions` for this user (force re-login everywhere).
6. Send confirmation email: "Your password was reset."
7. Log `user.password_reset` to `audit_logs`.

**Success response (200 OK):**
```json
{
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

**Error responses:**
| Status | Condition | Body |
|---|---|---|
| 400 | Invalid/expired token | `{ "message": "This password reset link is invalid or has expired." }` |
| 422 | Validation failure | `{ "message": "...", "errors": { "password": ["..."] } }` |

---

#### 1.3.7 POST `/auth/email/verify/:id/:hash`

**Purpose:** Verify user email address.
**Authentication:** None (public — uses userId + SHA-256 hash of email as verification).

**Flow logic:**
1. Find user by `id`. Verify `hash` matches `SHA-256(user.email)`.
2. Set `email_verified_at` to current timestamp.
3. Log `user.email_verified` to `audit_logs`.

**Success response (200 OK):** `{ "message": "Email verified successfully." }`

---

#### 1.3.8 POST `/auth/email/resend-verification`

**Purpose:** Resend verification email.
**Authentication:** None (public).
**Rate limit:** 3 per email per hour.

**Request body:**
```json
{
  "email": "erik@company.se"
}
```

**Flow logic:** Always return 200. If user exists and is not verified, send new verification email.

---

#### 1.3.9 GET `/auth/me`

**Purpose:** Get current authenticated user profile.
**Authentication:** Required.

**Success response (200 OK):**
```json
{
  "data": {
    "id": "uuid-here",
    "name": "Erik Johansson",
    "email": "erik@company.se",
    "role": "admin",
    "email_verified": true,
    "mfa_enabled": true,
    "is_active": true,
    "last_login_at": "2026-03-03T14:30:00Z",
    "organization": {
      "id": "uuid-here",
      "name": "Stockholm Collections AB",
      "slug": "stockholm-collections-ab",
      "mfa_enforced": false,
      "industry": "debt_collection",
      "timezone": "Europe/Stockholm",
      "locale": "sv"
    },
    "created_at": "2026-01-15T10:00:00Z"
  }
}
```

---

#### 1.3.10 PUT `/auth/me`

**Purpose:** Update current user's profile.
**Authentication:** Required.

**Request body (all fields optional):**
```json
{
  "name": "Erik J. Johansson",
  "email": "erik.new@company.se",
  "current_password": "OldP@ss123",
  "password": "NewP@ss456",
  "password_confirmation": "NewP@ss456"
}
```

**Rules:**
- If `email` is changed → set `email_verified_at` to NULL → send new verification email.
- If `password` is provided → `current_password` is required and must be verified.

---

#### 1.3.11 MFA Setup Endpoints

**POST `/auth/mfa/setup`** — Generate TOTP secret and QR code URI.
**Authentication:** Required (JWT). Requires `current_password` in body for verification.

**Response:**
```json
{
  "data": {
    "secret": "BASE32SECRETHERE",
    "qr_code_uri": "otpauth://totp/Astos:erik@company.se?secret=BASE32SECRETHERE&issuer=Astos",
    "recovery_codes": [
      "a1b2c3d4e5",
      "f6g7h8i9j0",
      "k1l2m3n4o5",
      "p6q7r8s9t0",
      "u1v2w3x4y5",
      "z6a7b8c9d0",
      "e1f2g3h4i5",
      "j6k7l8m9n0"
    ]
  }
}
```

**POST `/auth/mfa/confirm`** — Confirm MFA setup by verifying a TOTP code.
**Request:** `{ "code": "123456" }`
**Flow:** Verify code against the secret using otplib. If valid → set `mfa_enabled = true`, store secret + bcrypt-hashed recovery codes. Log `user.mfa_enabled`.

**DELETE `/auth/mfa`** — Disable MFA.
**Request:** `{ "current_password": "...", "code": "123456" }`
**Flow:** Verify password + TOTP code. If valid → set `mfa_enabled = false`, null out `mfa_secret` and `mfa_recovery_codes`. Log `user.mfa_disabled`.

---

#### 1.3.12 Session Management Endpoints

**GET `/auth/sessions`** — List active sessions for current user.
**Authentication:** Required (JWT + `X-Session-ID` header to identify current session).

**Response:**
```json
{
  "data": [
    {
      "id": "session-uuid",
      "ip_address": "192.168.1.1",
      "device_name": "Chrome on MacOS",
      "last_active_at": "2026-03-03T14:30:00Z",
      "is_current": true,
      "created_at": "2026-03-03T08:00:00Z"
    }
  ]
}
```

**DELETE `/auth/sessions/:id`** — Revoke a specific session.
**Authentication:** Required (JWT). User can only revoke their own sessions.

**DELETE `/auth/sessions`** — Revoke all sessions except current.
**Authentication:** Required (JWT + `X-Session-ID` header). Request body: `{ "current_password": "..." }`.

---

#### 1.3.13 User Management Endpoints (Admin Only)

**GET `/users`** — List all users in the organization.
**Authentication:** Required (JWT). Role: `admin` or `manager`.
**Query params (flat):**
```
?role=manager
&search=erik
&is_active=true
&sort=-created_at
&page=1
&page_size=25
```
**Allowed filters:** `role` (exact), `search` (partial — matches `name` and `email`), `is_active` (boolean).
**Allowed sorts:** `name`, `email`, `role`, `created_at`, `last_login_at`.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Erik Johansson",
      "email": "erik@company.se",
      "role": "admin",
      "is_active": true,
      "mfa_enabled": true,
      "last_login_at": "2026-03-03T14:30:00Z",
      "created_at": "2026-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "page_size": 25,
    "total": 12,
    "last_page": 1
  }
}
```

**GET `/auth/accept-invite/:token`** — Get invitation details before accepting.
**Authentication:** None (public).
**Response:** `{ email, role, org: { name, slug } }`

**POST `/auth/accept-invite`** — Accept invitation and create account.
**Authentication:** None (public, token-validated).
**Request:** `{ token, name, password, password_confirmation }`
**Flow:** Validate token, create user with `email_verified_at` set (auto-verified), return tokens + session_id directly (no separate login step).

**POST `/users/invite`** — Invite a new user.
**Authentication:** Required (JWT). Role: `admin`.

**Request:**
```json
{
  "email": "anna@company.se",
  "role": "manager",
  "name": "Anna Lindgren"
}
```

**Flow:**
1. Check email is not already registered in this org.
2. Create `user_invitations` record with 7-day expiry token.
3. Send invitation email with link: `{FRONTEND_URL}/auth/accept-invite?token={token}`.
4. Log `user.invited`.

**PUT `/users/:id/role`** — Change a user's role.
**Authentication:** Required (JWT). Role: `admin`. Cannot change own role.

**Request:** `{ "role": "agent" }`

**PUT `/users/:id/deactivate`** — Deactivate a user.
**Authentication:** Required (JWT). Role: `admin`. Cannot deactivate self.

**Flow:**
1. Set `is_active = false`.
2. Revoke ALL refresh tokens for this user (set `revoked_at`).
3. Delete all `user_sessions` for this user.
4. Log `user.deactivated`.

**PUT `/users/:id/activate`** — Reactivate a user.
**Authentication:** Required (JWT). Role: `admin`.

**DELETE `/users/:id/force-logout`** — Force logout a user.
**Authentication:** Required (JWT). Role: `admin`.
**Flow:** Revoke all refresh tokens + delete all sessions for the target user. Log `user.force_logout`.

---

### 1.4 RBAC Permission Matrix

Every API endpoint must check the user's role. The following matrix defines access:

| Endpoint / Action | Admin | Manager | Agent |
|---|---|---|---|
| Register org | Yes (creates org) | N/A | N/A |
| Login / Logout / Profile | Yes | Yes | Yes |
| MFA setup/disable | Yes | Yes | Yes |
| View own sessions | Yes | Yes | Yes |
| List users | Yes | Read-only | No |
| Invite users | Yes | No | No |
| Change user roles | Yes | No | No |
| Deactivate/activate users | Yes | No | No |
| Force logout users | Yes | No | No |
| Org settings (timezone, MFA enforcement) | Yes | No | No |
| Create campaigns | Yes | Yes | No |
| Edit campaigns | Yes | Yes (own) | No |
| Pause/resume campaigns | Yes | Yes (own) | No |
| View campaigns | Yes | Yes | Yes (assigned only) |
| Upload leads | Yes | Yes | No |
| View analytics | Yes | Yes | Yes (assigned campaigns) |
| View audit trail | Yes | No | No |
| Export data | Yes | Yes | No |
| Compliance reports | Yes | Read-only | No |

**Implementation:** NestJS uses `JwtAuthGuard` + `RolesGuard` + `@Roles()` decorator. The central RBAC matrix is in `src/auth/permissions.ts`. Route-level protection example:

```typescript
// Protect with JWT + role check
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post('invite')
invite(@Body() dto: InviteUserDto, @Request() req) { ... }

// Extract current user from JWT payload
req.user  // → { userId, orgId, role }
```

### 1.5 Frontend Pages & Behavior

#### Login Page (`/auth/login`)

**Layout:** Centered card on a minimal background with Astos branding.

**Fields:**
- Email input (type="email", autofocus)
- Password input (type="password", show/hide toggle)
- "Remember me" checkbox (extends token expiry to 30 days)
- "Forgot password?" link
- Submit button: "Sign In"
- Link: "Don't have an account? Get Started"

**Behavior:**
1. Client-side validation on blur (email format, password not empty).
2. On submit → show loading spinner on button → call POST `/auth/login`.
3. If success with no MFA → store `access_token` + `refresh_token` + `session_id`, redirect to `/dashboard`.
4. If success with MFA → redirect to `/auth/mfa-verify` with `mfa_token` + `mfa_method` in state.
5. If 401 → show "Invalid email or password" error below form.
6. If 403 (deactivated) → show error message with contact admin guidance.
7. If 403 (unverified) → show message with "Resend verification email" button.
8. If 429 (locked) → show lockout message with countdown timer.

#### MFA Verification Page (`/auth/mfa-verify`)

**Fields:**
- 6-digit code input (numeric, auto-advance between digits)
- Method toggle: "Use authenticator app" / "Send code via email"
- "Use recovery code" link
- Submit button: "Verify"
- "Back to login" link

**Behavior:**
1. If `mfa_method` is `email` and page loads → auto-send email OTP via POST `/auth/mfa/send-email`.
2. On submit → call POST `/auth/mfa/challenge` (TOTP) or POST `/auth/mfa/challenge/email` (email OTP).
3. If success → store token, redirect to `/dashboard`.
4. If fail → shake input, show error, clear code fields.
5. If mfa_token expires (5 min) → redirect to `/auth/login` with message.

#### Registration Page (`/auth/register`)

**Fields:**
- Full name
- Work email
- Password (with strength meter: weak/fair/strong/excellent)
- Confirm password
- Organization name
- Industry (dropdown)
- Language preference (toggle: Swedish / English)
- Terms & privacy policy checkbox
- Submit button: "Create Account"

**Behavior:**
1. Real-time password strength indicator.
2. On submit → call POST `/auth/register`.
3. On success → redirect to `/auth/verify-email` with success message.
4. On 422 → show field-level errors.

#### Password Reset Flow

**Page 1 (`/auth/forgot-password`):** Email input + submit. Always shows success message.
**Page 2 (`/auth/reset-password?token=...&email=...`):** New password + confirm + submit. On success → redirect to login.

#### Accept Invitation Page (`/auth/accept-invite?token=...`)

**Fields:** Name (pre-filled if provided), password, confirm password.
**Flow:** Call POST `/auth/accept-invite` → on success → tokens returned directly, redirect to `/dashboard` (no separate login step).

### 1.6 Acceptance Criteria

| ID | Criterion | How to Verify |
|---|---|---|
| AC-AUTH-01 | User can register, receive verification email, verify, and log in | E2E test: register → check email → click verify → login succeeds |
| AC-AUTH-02 | Unverified users cannot access protected routes | Login attempt with unverified email returns 403 |
| AC-AUTH-03 | Login fails after 5 bad attempts within 15 minutes | Automated test: 5 wrong passwords → 6th returns 429 |
| AC-AUTH-04 | Lockout notification email is sent on account lockout | Check email service logs after lockout trigger |
| AC-AUTH-05 | MFA (TOTP) works end-to-end | Setup MFA → logout → login → verify TOTP code → access granted |
| AC-AUTH-06 | MFA (email OTP) works end-to-end | Same flow with email method |
| AC-AUTH-07 | Recovery codes work when MFA device is lost | Use recovery code instead of TOTP → access granted, code marked used |
| AC-AUTH-08 | Password reset flow works end-to-end | Request reset → click email link → set new password → login with new password |
| AC-AUTH-09 | Old sessions are invalidated on password reset | Login on 2 devices → reset password → both sessions are revoked |
| AC-AUTH-10 | Admin can invite user, invitee can accept and log in | Invite → email received → accept → set password → login succeeds |
| AC-AUTH-11 | Admin can deactivate user, user cannot log in | Deactivate → user's existing session ends → login returns 403 |
| AC-AUTH-12 | RBAC prevents agent from accessing admin endpoints | Agent token → call admin-only endpoint → 403 |
| AC-AUTH-13 | Sessions expire after 24h of inactivity | Create session → wait 24h (mock) → next request returns 401 |
| AC-AUTH-14 | Admin can force-logout any user in org | Force logout → target user's next request returns 401 |
| AC-AUTH-15 | Org-enforced MFA requires MFA for all users | Enable org MFA → user without MFA setup is prompted to set it up on next login |

---

## 2. MODULE: Compliance Engine

**PRD References:** CMP-001, CMP-003, CMP-004, CMP-005, CMP-006
**Priority:** CRITICAL
**Owner:** Backend (NestJS) + AI Services (Python)

### 2.1 Overview

The Compliance Engine is the gatekeeper for every outbound call. **No call can be placed without passing through the compliance pipeline.** The engine enforces consent verification, DNC checking, recording disclosure, opt-out processing, and audit logging. These checks are mandatory and cannot be disabled or bypassed by any user role.

The compliance pipeline executes in this exact order before every call:

```
Lead selected for dialing
    → Step 1: Verify consent exists and is valid
    → Step 2: Check phone number against DNC registry
    → Step 3: Verify calling window (timezone-aware)
    → Step 4: All checks pass → Place call
    → Step 5: Call connected → Play recording disclosure
    → Step 6: During call → Monitor for opt-out phrases
    → Step 7: Call ends → Log complete audit trail
```

If ANY step fails, the call is **blocked** and the reason is logged.

### 2.2 Data Models

#### Table: `consent_records`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | FK → organizations.id, NOT NULL | |
| `lead_id` | UUID | FK → leads.id, NOT NULL | |
| `consent_type` | ENUM('prior_express', 'prior_express_written', 'implied') | NOT NULL | Type of consent obtained |
| `consent_source` | VARCHAR(255) | NOT NULL | Where consent was obtained (e.g., 'web_form', 'verbal_recording', 'contract_signed') |
| `consent_text` | TEXT | NULLABLE | Exact consent language the lead agreed to |
| `consented_at` | TIMESTAMP | NOT NULL | When the lead gave consent |
| `expires_at` | TIMESTAMP | NULLABLE | Consent expiration (NULL = no expiry) |
| `revoked_at` | TIMESTAMP | NULLABLE | If consent was revoked |
| `revoked_reason` | VARCHAR(255) | NULLABLE | Reason for revocation |
| `metadata` | JSON | NULLABLE | Additional context (IP, form URL, recording ID, etc.) |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |

#### Table: `dnc_registry`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `phone_number` | VARCHAR(20) | NOT NULL, INDEXED | E.164 format |
| `source` | ENUM('national_registry', 'internal_optout', 'manual') | NOT NULL | How the number got on the DNC list |
| `reason` | VARCHAR(255) | NULLABLE | Why the number is on DNC |
| `added_at` | TIMESTAMP | NOT NULL | When the number was added |
| `lead_id` | UUID | FK → leads.id, NULLABLE | If tied to a specific lead |
| `org_id` | UUID | NULLABLE | NULL = national registry (global), set = org-specific opt-out |
| `call_id` | UUID | FK → calls.id, NULLABLE | If added due to an opt-out during a call |
| `created_at` | TIMESTAMP | NOT NULL | |

**Index:** Composite index on (`phone_number`, `org_id`) for fast lookup.

#### Table: `compliance_checks`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | FK → organizations.id, NOT NULL | |
| `call_id` | UUID | FK → calls.id, NULLABLE | NULL if call was blocked before placement |
| `lead_id` | UUID | FK → leads.id, NOT NULL | |
| `check_type` | ENUM('consent', 'dnc', 'calling_window', 'recording_disclosure', 'optout_detection') | NOT NULL | |
| `status` | ENUM('passed', 'failed', 'skipped') | NOT NULL | |
| `details` | JSON | NOT NULL | Full details of the check (see below) |
| `checked_at` | TIMESTAMP | NOT NULL | |
| `created_at` | TIMESTAMP | NOT NULL | |

**`details` JSON structure by check_type:**

For `consent`:
```json
{
  "consent_record_id": "uuid",
  "consent_type": "prior_express",
  "consented_at": "2026-01-15T10:00:00Z",
  "expired": false
}
```

For `dnc`:
```json
{
  "phone_number": "+46701234567",
  "checked_against": ["national_registry", "internal_optout"],
  "found_on_dnc": false,
  "registry_last_updated": "2026-03-01T00:00:00Z"
}
```

For `optout_detection`:
```json
{
  "detected_phrase": "stop calling me",
  "detected_language": "en",
  "timestamp_in_call": 45.2,
  "action_taken": "flagged_dnc_and_ended_contact",
  "new_dnc_record_id": "uuid"
}
```

#### Table: `recording_disclosures`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | FK → organizations.id, NOT NULL | |
| `name` | VARCHAR(255) | NOT NULL | Disclosure name (e.g., "Swedish Default", "English Financial") |
| `language` | VARCHAR(10) | NOT NULL | Language code (sv, en) |
| `text` | TEXT | NOT NULL | Full disclosure text |
| `audio_url` | VARCHAR(500) | NOT NULL | URL to pre-recorded audio file in Cloud Storage |
| `duration_ms` | INTEGER | NOT NULL | Audio duration in milliseconds |
| `jurisdiction` | VARCHAR(50) | NOT NULL | Jurisdiction this applies to (e.g., 'SE', 'NO') |
| `is_default` | BOOLEAN | DEFAULT false | Default for this org + jurisdiction |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |

### 2.3 API Endpoints

#### 2.3.1 Consent Management

**POST `/compliance/consent`** — Record consent for a lead.
**Authentication:** Required. Role: `admin`, `manager`.

**Request:**
```json
{
  "lead_id": "uuid",
  "consent_type": "prior_express",
  "consent_source": "web_form",
  "consent_text": "I agree to be contacted by phone regarding my account.",
  "consented_at": "2026-02-15T10:00:00Z",
  "expires_at": null
}
```

**GET `/compliance/consent/:lead_id`** — Get consent history for a lead.
**Authentication:** Required. Role: `admin`, `manager`.

#### 2.3.2 DNC Management

**GET `/compliance/dnc/check/:phone_number`** — Check if a number is on DNC.
**Authentication:** Required.

**Response:**
```json
{
  "data": {
    "phone_number": "+46701234567",
    "is_blocked": true,
    "sources": [
      {
        "source": "national_registry",
        "added_at": "2026-01-10T00:00:00Z",
        "reason": "National DNC registration"
      }
    ]
  }
}
```

**POST `/compliance/dnc`** — Manually add a number to DNC.
**Authentication:** Required. Role: `admin`, `manager`.

**POST `/compliance/dnc/sync`** — Trigger DNC registry sync from national provider.
**Authentication:** Required. Role: `admin`.

#### 2.3.3 Recording Disclosures

**GET `/compliance/disclosures`** — List all recording disclosures for the org.
**POST `/compliance/disclosures`** — Create a new disclosure.
**PUT `/compliance/disclosures/:id`** — Update a disclosure.

#### 2.3.4 Audit Trail

**GET `/compliance/audit`** — Query audit trail.
**Authentication:** Required. Role: `admin`.

**Query params (flat):**
```
?call_id=uuid
&lead_id=uuid
&check_type=consent
&status=passed
&date_from=2026-03-01
&date_to=2026-03-03
&sort=-created_at
&page=1
&page_size=50
```
**Allowed filters:** `call_id` (exact), `lead_id` (exact), `check_type` (exact), `status` (exact), `date_from` (scope — `>=`), `date_to` (scope — `<=`).
**Allowed sorts:** `created_at`, `check_type`, `status`.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "call_id": "uuid",
      "lead_id": "uuid",
      "check_type": "consent",
      "status": "passed",
      "details": { "..." },
      "checked_at": "2026-03-03T14:30:00Z"
    }
  ],
  "meta": { "current_page": 1, "page_size": 50, "total": 150, "last_page": 3 }
}
```

**GET `/compliance/audit/export`** — Export audit trail as CSV.
**Authentication:** Required. Role: `admin`.
**Query params:** Same flat filters as above (no `page`/`page_size` — returns all matching records).
**Response:** Streams CSV directly. `Content-Disposition: attachment; filename="compliance_audit.csv"`.

### 2.4 Compliance Pipeline (Internal Service)

This is the internal service logic that runs before every call. It is NOT a public API — it is invoked by the Campaign Dialer service.

```python
# Pseudocode for compliance pipeline
def run_compliance_checks(lead: Lead, campaign: Campaign, org: Organization) -> ComplianceResult:
    checks = []

    # Step 1: Consent verification
    consent = get_valid_consent(lead.id, org.id)
    if not consent:
        checks.append(ComplianceCheck(type='consent', status='failed', details={...}))
        return ComplianceResult(allowed=False, checks=checks, block_reason='NO_CONSENT')
    checks.append(ComplianceCheck(type='consent', status='passed', details={...}))

    # Step 2: DNC check
    dnc_hit = check_dnc(lead.phone_number, org.id)
    if dnc_hit:
        checks.append(ComplianceCheck(type='dnc', status='failed', details={...}))
        return ComplianceResult(allowed=False, checks=checks, block_reason='DNC_BLOCKED')
    checks.append(ComplianceCheck(type='dnc', status='passed', details={...}))

    # Step 3: Calling window check
    now_in_lead_tz = convert_to_timezone(utc_now(), lead.timezone or org.timezone)
    if not is_within_calling_window(now_in_lead_tz, campaign.schedule):
        checks.append(ComplianceCheck(type='calling_window', status='failed', details={...}))
        return ComplianceResult(allowed=False, checks=checks, block_reason='OUTSIDE_CALLING_WINDOW')
    checks.append(ComplianceCheck(type='calling_window', status='passed', details={...}))

    # All checks passed
    return ComplianceResult(allowed=True, checks=checks, block_reason=None)
```

### 2.5 Real-Time Opt-Out Detection (AI Service)

The Python AI service monitors every active call for opt-out phrases in real-time.

**Opt-out phrases (configurable per org, default set):**

Swedish: `"sluta ringa"`, `"ring inte mer"`, `"avregistrera"`, `"ta bort mig"`, `"jag vill inte bli kontaktad"`, `"stoppa"`, `"nej tack, ring inte igen"`

English: `"stop"`, `"stop calling"`, `"unsubscribe"`, `"remove me"`, `"do not call"`, `"take me off your list"`, `"I don't want to be called"`, `"don't call again"`

**Detection flow:**
1. STT transcription runs in real-time during call.
2. Each transcription segment is checked against opt-out phrases (fuzzy matching, case-insensitive).
3. On match → immediately:
   a. Flag lead status as `dnc` in leads table.
   b. Create `dnc_registry` entry with source `internal_optout`.
   c. Create `compliance_checks` entry with type `optout_detection`.
   d. Signal the AI conversation engine to acknowledge the opt-out politely and end the call.
   e. The AI says: "I understand. I've noted your request and we will not contact you again. Thank you for your time. Goodbye."
4. Total time from phrase detection to system response: **< 2 seconds**.

### 2.6 Acceptance Criteria

| ID | Criterion | How to Verify |
|---|---|---|
| AC-CMP-01 | A call cannot be placed for a lead without a valid consent record | Attempt to dial lead with no consent → call blocked with reason logged |
| AC-CMP-02 | A call cannot be placed to a number on the DNC registry | Add number to DNC → attempt dial → blocked |
| AC-CMP-03 | A call cannot be placed outside the configured calling window | Configure window 09:00–17:00 → attempt dial at 20:00 → blocked |
| AC-CMP-04 | Recording disclosure plays before AI conversation begins | Listen to call recording → disclosure is first audio heard |
| AC-CMP-05 | Saying "stop calling" during a call triggers immediate opt-out | Say phrase → lead flagged DNC + call gracefully ended within 2s |
| AC-CMP-06 | Every call has a complete audit trail with all compliance checks | Query audit for any call → all 5 check types present |
| AC-CMP-07 | Audit trail records are immutable (no UPDATE or DELETE possible) | Attempt to modify audit record via API → fails |
| AC-CMP-08 | Audit export produces valid CSV with all required fields | Export → open CSV → verify all columns present |
| AC-CMP-09 | DNC sync updates the registry from national provider | Trigger sync → verify new entries appear |
| AC-CMP-10 | Opt-out phrases work in both Swedish and English | Test both language sets → all trigger correctly |

---

## 3. MODULE: Telephony

**PRD References:** TEL-001 through TEL-005
**Priority:** CRITICAL
**Owner:** Backend (NestJS) + AI Services (Python)

### 3.1 Overview

The telephony module handles the physical act of placing, managing, and recording outbound calls. It uses **Telnyx** as the primary provider and **Twilio** as failover. The system abstracts telephony providers behind a unified interface so switching or failover is transparent.

### 3.2 Data Models

#### Table: `calls`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | FK → organizations.id, NOT NULL | |
| `campaign_id` | VARCHAR(255) | NOT NULL | FK to campaigns (future module) |
| `lead_id` | VARCHAR(255) | NOT NULL | FK to leads (future module) |
| `provider` | ENUM('telnyx', 'twilio') | NOT NULL | Which telephony provider was used |
| `provider_call_id` | VARCHAR(255) | NULLABLE | Provider's call SID/ID |
| `from_number` | VARCHAR(20) | NOT NULL | Caller ID (E.164) |
| `to_number` | VARCHAR(20) | NOT NULL | Lead phone (E.164) |
| `status` | ENUM('queued', 'ringing', 'answered', 'completed', 'failed', 'no_answer', 'busy', 'voicemail', 'cancelled') | NOT NULL | Current call state |
| `direction` | ENUM('outbound') | NOT NULL | Always outbound for Phase 1A |
| `started_at` | TIMESTAMP | NULLABLE | When call was answered |
| `ended_at` | TIMESTAMP | NULLABLE | When call ended |
| `duration_seconds` | INTEGER | NULLABLE | Call duration (answered to end) |
| `recording_url` | VARCHAR(500) | NULLABLE | Cloud Storage URL for recording |
| `recording_duration_seconds` | INTEGER | NULLABLE | Recording length |
| `amd_result` | ENUM('human', 'voicemail', 'unknown', 'not_checked') | DEFAULT 'not_checked' | Answering machine detection result |
| `voicemail_action` | ENUM('hung_up', 'left_message', 'retry_scheduled') | NULLABLE | What happened when voicemail detected |
| `disconnect_reason` | VARCHAR(255) | NULLABLE | Why call ended |
| `cost_amount` | DECIMAL(10,4) | NULLABLE | Call cost in SEK |
| `cost_currency` | VARCHAR(3) | DEFAULT 'SEK' | |
| `intent_result` | ENUM('interested', 'not_interested', 'callback_requested', 'dnc_requested', 'undetermined') | NULLABLE | AI-classified outcome |
| `sentiment_score` | DECIMAL(3,2) | NULLABLE | -1.00 to +1.00 |
| `transcript_url` | VARCHAR(500) | NULLABLE | Cloud Storage URL for transcript JSON |
| `compliance_result` | ENUM('passed', 'blocked') | NOT NULL | Whether compliance checks passed |
| `compliance_block_reason` | VARCHAR(100) | NULLABLE | If blocked: NO_CONSENT, DNC_BLOCKED, OUTSIDE_CALLING_WINDOW |
| `metadata` | JSON | NULLABLE | Additional provider-specific data |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |

**Indexes:** `(org_id, status)`, `(org_id, campaign_id)`, `(org_id, lead_id)`

### 3.3 Telephony Provider Abstraction

```typescript
// Interface that both Telnyx and Twilio adapters implement
interface ITelephonyProvider {
  placeCall(from: string, to: string, options: Record<string, any>): Promise<CallResult>;
  hangUp(providerCallId: string): Promise<void>;
  getCallStatus(providerCallId: string): Promise<ProviderCallStatus>;
  startRecording(providerCallId: string): Promise<string>; // returns recording ID
  stopRecording(providerCallId: string): Promise<void>;
  playAudio(providerCallId: string, audioUrl: string): Promise<void>;
  sendDTMF(providerCallId: string, digits: string): Promise<void>;
  transferCall(providerCallId: string, toNumber: string): Promise<void>;
}
```

**Failover logic:**
1. Attempt call via Telnyx.
2. If Telnyx throws an error → retry via Twilio.
3. If Twilio also fails → mark call as `failed`, log both errors.
4. All failover events logged with provider, error details, and timestamps.

### 3.4 Call Lifecycle

```
1. Campaign dialer selects lead
2. Compliance pipeline runs → PASS or BLOCK
3. If PASS → Telephony places call via provider
4. Call state: QUEUED → RINGING
5. Provider reports call answered → state: ANSWERED
   OR no answer after 30s → state: NO_ANSWER
   OR busy signal → state: BUSY
6. If ANSWERED → AMD runs (< 3s detection)
   a. If VOICEMAIL → execute voicemail_action (hang up / leave message / schedule retry)
   b. If HUMAN → start recording → play disclosure → hand off to AI conversation engine
7. AI conversation runs (see Module 4)
8. Call ends → state: COMPLETED
9. Post-call processing:
   a. Save recording to Cloud Storage
   b. Generate transcript
   c. Classify intent
   d. Update lead status
   e. Log audit trail
   f. Fire webhooks
```

### 3.5 API Endpoints

**GET `/calls`** — List calls with filters.
**Authentication:** Required. Role: `admin`, `manager`.

**Query params:**
```
?campaign_id=uuid
&lead_id=uuid
&status=completed,answered
&intent_result=interested,callback_requested
&date_from=2026-03-01
&date_to=2026-03-31
&sort=-started_at
&include=complianceChecks
&page=1
&page_size=50
```
**Allowed filters:** `campaign_id` (exact), `lead_id` (exact), `status` (comma-separated), `intent_result` (comma-separated), `date_from` (`>=`), `date_to` (`<=`).
**Allowed sorts:** `started_at`, `ended_at`, `duration_seconds`, `status`, `intent_result`.
**Allowed includes:** `complianceChecks`.

**GET `/calls/:id`** — Get call details including compliance checks.
**Authentication:** Required. Role: `admin`, `manager`.

**GET `/calls/:id/recording`** — Get a pre-signed URL for call recording playback (expires in 1 hour).
**Authentication:** Required. Role: `admin`, `manager`.

**Response:**
```json
{ "url": "https://...", "expires_at": "2026-03-31T10:00:00Z" }
```

**GET `/calls/:id/transcript`** — Get call transcript metadata.
**Authentication:** Required. Role: `admin`, `manager`.

**Response:**
```json
{
  "call_id": "uuid",
  "transcript_url": "https://...",
  "duration_seconds": 120
}
```

### 3.6 Webhook Events

The telephony module publishes webhook events to client systems (see Module 8 for webhook delivery):

| Event | Trigger | Payload Includes |
|---|---|---|
| `call.started` | Call answered by human | call_id, campaign_id, lead_id, from, to, started_at |
| `call.completed` | Call ended | call_id, duration, status, intent_result, recording_url |
| `call.failed` | Call could not connect | call_id, failure_reason, provider |
| `call.voicemail` | Voicemail detected | call_id, amd_result, voicemail_action |
| `call.optout` | Opt-out detected during call | call_id, lead_id, detected_phrase |

### 3.7 Acceptance Criteria

| ID | Criterion | How to Verify |
|---|---|---|
| AC-TEL-01 | Calls are placed via Telnyx and call state transitions are tracked | Place call → verify status changes from queued → ringing → answered → completed |
| AC-TEL-02 | If Telnyx fails, system automatically falls back to Twilio | Simulate Telnyx failure → call placed via Twilio |
| AC-TEL-03 | Caller ID is configurable per campaign | Set different caller IDs on 2 campaigns → verify each uses correct ID |
| AC-TEL-04 | AMD correctly detects voicemail vs human | Call voicemail number → verify AMD result = voicemail; call human → AMD = human |
| AC-TEL-05 | All calls are recorded and recordings are playable | Complete call → get recording URL → play back → audio is complete |
| AC-TEL-06 | Call setup time is < 3 seconds (dial to ringing) | Measure time from API call to first ring event → < 3s |
| AC-TEL-07 | Webhook events fire for all call state changes | Set up webhook listener → place call → verify all events received |

---

## 4. MODULE: AI Voice Pipeline

**PRD References:** AI-001 through AI-005
**Priority:** CRITICAL
**Owner:** AI Services (Python) + Backend (NestJS — utility endpoints only)

### 4.1 Overview

The AI Voice Pipeline is the brain of every call. It converts speech to text, generates contextually appropriate responses using an LLM, and converts those responses back to speech — all in real-time with < 800ms end-to-end latency at P50.

**Note:** The STT/LLM/TTS pipeline runs entirely in the Python AI service. The NestJS backend exposes only 3 utility endpoints (voices, preview, script validation).

### 4.2 Pipeline Architecture

```
Lead speaks → Audio stream
    → STT (Deepgram Nova-3, < 300ms)
        → Text
            → LLM (GPT-4o, 150-300ms TTFT)
                → Response text
                    → TTS (Cartesia Sonic, 50-100ms)
                        → Audio stream → Lead hears response
```

| Component | Target | Primary | Failover |
|---|---|---|---|
| STT | < 300ms | Deepgram Nova-3 | AssemblyAI |
| LLM | 150–300ms TTFT | GPT-4o / GPT-4o-mini | Claude Haiku |
| TTS | 50–100ms | Cartesia Sonic | ElevenLabs Flash |
| Total E2E | P50 < 600ms, P95 < 800ms, P99 < 1200ms | | |

### 4.3 STT Specification

Primary: Deepgram Nova-3 (streaming WebSocket). Failover: AssemblyAI (real-time WebSocket).

Failover trigger: WebSocket fails to establish within 3s, or drops mid-call with >2 reconnect failures.

### 4.4 LLM Conversation Engine

System prompt structure:
```
[SYSTEM CONTEXT] — org name, campaign objective, agent name
[COMPLIANCE RULES — NEVER OVERRIDE] — opt-out handling, no financial advice
[CAMPAIGN SCRIPT] — with variables resolved
[LEAD CONTEXT] — name, account, custom fields
[CONVERSATION RULES] — response length, AI identity disclosure, intent classification
```

Variable resolution: All `{variable}` placeholders in the campaign script are resolved from lead data before the call starts.

Conversation memory: Full transcript sent as context each turn. Max 8,000 tokens; earlier turns summarized if exceeded.

### 4.5 TTS Specification

Primary: Cartesia Sonic (streaming). Failover: ElevenLabs Flash v2.5.

Output format: `pcm_16000` (16kHz PCM for telephony). Voice is configurable per campaign.

### 4.6 Intent Classification

| Intent | Definition |
|---|---|
| `interested` | Lead shows willingness to engage |
| `not_interested` | Lead explicitly declines but doesn't opt out |
| `callback_requested` | Lead asks to be called at a different time |
| `dnc_requested` | Lead explicitly asks to not be contacted again |
| `undetermined` | Call ended before clear intent was expressed |

Classification happens real-time (for opt-out detection) and post-call (final `calls.intent_result`).

### 4.7 API Endpoints (NestJS)

**GET `/ai/voices`** — List available TTS voices. Role: all roles.

Response:
```json
{
  "data": [
    { "id": "sv-female-professional", "name": "Swedish Female — Professional", "language": "sv-SE", "gender": "female", "provider": "cartesia", "preview_available": false }
  ]
}
```

**GET `/ai/voices/:id/preview`** — Get voice preview URL (expires 1h). Role: all roles.
Stub until Cartesia API integrated — returns `preview_url: null`.

**POST `/ai/scripts/validate`** — Validate campaign script. Role: `admin`, `manager`.

Request: `{ "script": "Hello {lead_name}..." }`

Response:
```json
{
  "valid": true,
  "variables": ["lead_name", "organization_name"],
  "estimated_tokens": 420,
  "errors": []
}
```

### 4.8 Acceptance Criteria

| ID | Criterion | How to Verify |
|---|---|---|
| AC-AI-01 | E2E voice latency P50 < 600ms | Load test: 50 concurrent calls → measure P50 latency |
| AC-AI-02 | E2E voice latency P95 < 800ms | Same load test → measure P95 |
| AC-AI-03 | E2E voice latency P99 < 1200ms | Same load test → measure P99 |
| AC-AI-04 | STT failover works when Deepgram is unavailable | Block Deepgram → call proceeds via AssemblyAI |
| AC-AI-05 | LLM failover works when GPT-4o is unavailable | Block OpenAI → call proceeds via Claude Haiku |
| AC-AI-06 | TTS failover works when Cartesia is unavailable | Block Cartesia → call proceeds via ElevenLabs |
| AC-AI-07 | AI follows campaign script correctly | Run test calls → verify script flow |
| AC-AI-08 | AI handles objections naturally | Script includes objection handling → AI responds appropriately |
| AC-AI-09 | Intent classification accuracy > 85% | Run 100 test calls with known intents → measure accuracy |
| AC-AI-10 | Variables in scripts are correctly resolved | Script with variables → call uses actual lead data |
| AC-AI-11 | AI honestly identifies itself as AI when asked | Ask "Are you a robot?" → AI confirms honestly |

---

## 5. MODULE: Campaign Management

**PRD References:** CAM-001 through CAM-004
**Priority:** CRITICAL
**Owner:** Backend (NestJS) + Frontend (Next.js)

### 5.1 Data Models

#### Table: `campaigns`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | FK → organizations.id, NOT NULL | |
| `name` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | NULLABLE | |
| `status` | ENUM('draft', 'active', 'paused', 'completed', 'archived') | NOT NULL, DEFAULT 'draft' | |
| `script` | TEXT | NOT NULL | System prompt / conversation script |
| `voice_id` | VARCHAR(100) | NOT NULL | TTS voice identifier |
| `language` | VARCHAR(10) | NOT NULL, DEFAULT 'sv' | |
| `caller_id` | VARCHAR(20) | NOT NULL | Outbound caller ID (E.164) |
| `disclosure_id` | UUID | FK → recording_disclosures.id, NOT NULL | |
| `schedule_timezone` | VARCHAR(50) | NOT NULL, DEFAULT 'Europe/Stockholm' | |
| `schedule_start_time` | VARCHAR(5) | NOT NULL | HH:MM e.g. "09:00" |
| `schedule_end_time` | VARCHAR(5) | NOT NULL | HH:MM e.g. "17:00" |
| `schedule_days` | JSON | NOT NULL | Array of weekdays [1,2,3,4,5] (1=Mon, 7=Sun) |
| `max_concurrent_calls` | INTEGER | DEFAULT 10 | |
| `max_attempts_per_lead` | INTEGER | DEFAULT 3 | |
| `retry_interval_minutes` | INTEGER | DEFAULT 60 | |
| `amd_action` | ENUM('hang_up', 'leave_message', 'retry_later') | DEFAULT 'hang_up' | |
| `voicemail_script` | TEXT | NULLABLE | Required when amd_action = leave_message |
| `created_by` | UUID | FK → users.id, NOT NULL | |
| `started_at` | TIMESTAMP | NULLABLE | When campaign was first activated |
| `completed_at` | TIMESTAMP | NULLABLE | When all leads processed |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| `deleted_at` | TIMESTAMP | NULLABLE | Soft delete |

#### Table: `leads`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | FK → organizations.id, NOT NULL | |
| `campaign_id` | UUID | FK → campaigns.id, NOT NULL | |
| `name` | VARCHAR(255) | NOT NULL | |
| `phone` | VARCHAR(20) | NOT NULL | E.164 format |
| `email` | VARCHAR(255) | NULLABLE | |
| `status` | ENUM('pending', 'in_progress', 'contacted', 'converted', 'dnc', 'failed', 'skipped') | DEFAULT 'pending' | |
| `attempt_count` | INTEGER | DEFAULT 0 | |
| `last_attempted_at` | TIMESTAMP | NULLABLE | |
| `custom_fields` | JSON | NULLABLE | Extra columns from CSV upload |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |

#### Table: `lead_uploads`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `org_id` | UUID | NOT NULL | |
| `campaign_id` | UUID | FK → campaigns.id, NOT NULL | |
| `status` | ENUM('processing', 'completed', 'failed') | DEFAULT 'processing' | |
| `total_rows` | INTEGER | DEFAULT 0 | |
| `valid_rows` | INTEGER | DEFAULT 0 | |
| `invalid_rows` | INTEGER | DEFAULT 0 | |
| `duplicate_rows` | INTEGER | DEFAULT 0 | |
| `errors` | JSON | NULLABLE | `[{row, field, error}]` |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |

### 5.2 API Endpoints

#### 5.2.1 CRUD

**POST `/campaigns`** — Create a campaign. Role: `admin`, `manager`.

**GET `/campaigns`** — List campaigns. Query params:
```
?status=active,paused
&search=payment
&sort=-created_at
&include=leadStats
&page=1
&page_size=25
```
**Allowed filters:** `status` (comma-separated), `search` (partial name/description match).
**Allowed sorts:** `name`, `status`, `created_at`, `updated_at`.
**Allowed includes:** `leadStats` → appends `{ total, contacted, converted }` counts.

**GET `/campaigns/:id`** — Get campaign details. Role: `admin`, `manager`.

**PUT `/campaigns/:id`** — Update campaign. Only allowed when status is `draft` or `paused`. Role: `admin`, `manager`.

**DELETE `/campaigns/:id`** — Soft delete. Only allowed when status is `draft` or `completed`. Role: `admin`.

#### 5.2.2 Campaign Actions

**POST `/campaigns/:id/activate`** — Activate campaign.
Preconditions: must be `draft` or `paused`; must have ≥1 lead; disclosure must exist.

**POST `/campaigns/:id/pause`** — Pause active campaign. In-progress calls complete; no new calls.

**POST `/campaigns/:id/resume`** — Resume paused campaign. Status → `active`.

#### 5.2.3 Lead Upload

**POST `/campaigns/:id/leads/upload`** — Upload leads via CSV.
Content-Type: `multipart/form-data`. Role: `admin`, `manager`. Max file size: 10MB.

Fields:
- `file` — CSV file
- `field_mapping` — JSON string: `{"name":"column_0","phone":"column_1","email":"column_2"}`
- `skip_first_row` — `"true"` or `"false"`

Phone normalization: Swedish `07XXXXXXXX` → `+467XXXXXXXX`; `00XX...` → `+XX...`; E.164 accepted as-is.

Response (202 Accepted):
```json
{ "data": { "upload_id": "uuid", "status": "processing", "total_rows": 0, "message": "..." } }
```

**GET `/campaigns/:id/leads/uploads/:upload_id`** — Poll upload status.

Response (completed):
```json
{
  "data": {
    "upload_id": "uuid",
    "status": "completed",
    "total_rows": 500,
    "valid_rows": 487,
    "invalid_rows": 13,
    "duplicate_rows": 5,
    "errors": [
      { "row": 15, "field": "phone", "error": "Invalid phone number format: 'not-a-phone'" }
    ]
  }
}
```

### 5.3 Campaign Dialer (Internal Service)

The Campaign Dialer is a background worker that processes active campaigns. Not implemented as an HTTP route — will be triggered by a job scheduler (future).

```typescript
// Internal method in CampaignsService (stub — to be wired to a scheduler)
async runDialerCycle(campaignId: string): Promise<void> {
  // 1. Check campaign is active and within schedule window
  // 2. Count active calls, calculate available slots
  // 3. Get next dialable leads (status=pending, attempt_count < max_attempts)
  // 4. For each lead: run compliance checks → if passed, call placeCall()
}
```

### 5.4 Acceptance Criteria

| ID | Criterion | How to Verify |
|---|---|---|
| AC-CAM-01 | Campaign can be created with all required fields | POST /campaigns with valid body → 201 |
| AC-CAM-02 | CSV upload correctly imports valid leads and flags invalid rows | Upload CSV with mix of valid/invalid → verify counts match |
| AC-CAM-03 | Campaign schedule prevents calls outside configured window | Enforced by compliance `callingWindowStart/End` from campaign schedule |
| AC-CAM-04 | Pausing a campaign stops new calls but doesn't drop active calls | Status → paused; Campaign Dialer skips paused campaigns |
| AC-CAM-05 | Resuming a paused campaign continues from where it left off | Status → active; remaining pending leads are dialed |
| AC-CAM-06 | Campaign cannot be activated without leads | Attempt activate with 0 leads → 400 |
| AC-CAM-07 | Campaign cannot be activated without a valid disclosure | Remove disclosure → attempt activate → 400 |

---
## Module 6 — Lead Management

### Overview

Leads represent individual contacts to be called within a campaign. Each lead has a lifecycle tracked via `LeadStatus`. This module exposes endpoints to view, filter, update, and export leads for a campaign.

### 6.1 Lead Status Lifecycle

```
new → queued → calling → contacted / interested / not_interested / callback_scheduled / failed / max_attempts_reached / dnc
```

| Status | Description |
|---|---|
| `new` | Just imported, not yet scheduled |
| `queued` | Scheduled by the dialer engine |
| `calling` | Active call in progress |
| `contacted` | Call connected, no definitive intent recorded |
| `interested` | Lead expressed interest |
| `not_interested` | Lead declined |
| `converted` | Lead converted to customer |
| `callback_scheduled` | Lead requested a callback |
| `dnc` | Do-Not-Call — permanent terminal state |
| `failed` | Technical failure during call |
| `max_attempts_reached` | Exhausted `max_attempts_per_lead` without contact |

**DNC rule:** Once a lead reaches `dnc`, it can NEVER be moved to any other status via the application. Attempting to update a `dnc` lead returns HTTP 403.

### 6.2 API Endpoints

| Method | Path | Role | Body / Query | Description |
|--------|------|------|-------------|-------------|
| GET | `/campaigns/:campaign_id/leads` | admin, manager | `?status=&search=&sort=&page=&page_size=` | List leads with filters + pagination |
| GET | `/campaigns/:campaign_id/leads/export` | admin, manager | same filters (no pagination) | Download leads as CSV |
| GET | `/campaigns/:campaign_id/leads/:id` | admin, manager | — | Get lead details + full call history |
| PUT | `/campaigns/:campaign_id/leads/:id` | admin, manager | `{ status?, callback_notes?, next_call_at?, callback_requested_at? }` | Update lead |

#### List / Export filters

| Field | Type | Notes |
|---|---|---|
| `status` | string | Comma-separated list of statuses |
| `search` | string | Searches name, phone_number, email |
| `sort` | string | Field name, prefix `-` for desc (e.g. `-created_at`) |
| `page` / `page_size` | int | Pagination (list only; export ignores these) |

#### `GET /:id` response shape

```json
{
  "data": {
    "id": "...",
    "name": "...",
    "phone_number": "+46701234567",
    "status": "callback_scheduled",
    "call_attempts": 2,
    "last_called_at": "...",
    "calls": [
      {
        "id": "...",
        "status": "completed",
        "started_at": "...",
        "ended_at": "...",
        "duration_seconds": 42,
        "intent_result": "callback_requested"
      }
    ]
  }
}
```

#### `PUT /:id` — writable statuses only

`dnc` and `max_attempts_reached` cannot be set via this endpoint. They are set by the dialer engine internally.

### 6.3 Lead Model (Module 6 schema)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| campaign_id | UUID FK → Campaign | |
| name | VARCHAR(255) | |
| phone_number | VARCHAR(20) | E.164 format (was `phone`) |
| email | VARCHAR(255) NULLABLE | |
| status | LeadStatus | default `new` |
| call_attempts | INT | default 0 (was `attempt_count`) |
| last_called_at | TIMESTAMP NULLABLE | (was `last_attempted_at`) |
| next_call_at | TIMESTAMP NULLABLE | Scheduled next dial time |
| callback_requested_at | TIMESTAMP NULLABLE | |
| callback_notes | TEXT NULLABLE | |
| custom_fields | JSON NULLABLE | |
| upload_id | VARCHAR(255) NULLABLE | LeadUpload reference |
| timezone | VARCHAR(50) NULLABLE | Lead's local timezone |
| created_at / updated_at / deleted_at | TIMESTAMP | soft delete |

### 6.4 Acceptance Criteria

| ID | Scenario | Expected |
|---|---|---|
| AC-LEAD-01 | List leads for a campaign | Returns paginated list scoped to org + campaign |
| AC-LEAD-02 | Search by phone number fragment | Returns matching leads |
| AC-LEAD-03 | Filter by multiple statuses | `?status=interested,callback_scheduled` returns only those |
| AC-LEAD-04 | Get lead with call history | Returns lead + `calls[]` array ordered by `created_at` desc |
| AC-LEAD-05 | Update lead status | Status changes persisted; audit log created |
| AC-LEAD-06 | Attempt to update a `dnc` lead | Returns 403 |
| AC-LEAD-07 | Attempt to set status to `dnc` via API | Returns 422 (validation — `dnc` not in enum) |
| AC-LEAD-08 | Export leads to CSV | CSV file with correct headers and all matching leads |
| AC-LEAD-09 | Access lead in wrong campaign | Returns 404 |

---

## Module 7 — Analytics Dashboard

**PRD References:** ANA-001 through ANA-005
**Priority:** HIGH

### 7.1 Overview

The analytics dashboard is Erik's primary tool for monitoring campaign performance. Two endpoints provide aggregated metrics — a main dashboard summary and a per-campaign drill-down — both scoped to org and filterable by date range.

### 7.2 API Endpoints

#### `GET /analytics/dashboard`

Main dashboard summary.

| Query param | Default | Description |
|---|---|---|
| `date_from` | today (00:00 UTC) | ISO 8601 date |
| `date_to` | today (23:59 UTC) | ISO 8601 date |

**Response:**
```json
{
  "data": {
    "active_campaigns": 3,
    "calls_today": 245,
    "calls_answered_today": 178,
    "connection_rate_today": 0.7265,
    "conversions_today": 23,
    "calls_by_hour": [
      { "hour": 9, "placed": 30, "answered": 22 },
      { "hour": 10, "placed": 45, "answered": 33 }
    ]
  }
}
```

#### `GET /analytics/campaigns/:id`

Campaign drill-down analytics.

| Query param | Default | Description |
|---|---|---|
| `date_from` | today | ISO 8601 date |
| `date_to` | today | ISO 8601 date |
| `granularity` | `day` | `hour`, `day`, `week`, or `month` |

**Response:**
```json
{
  "data": {
    "summary": {
      "total_calls": 1250,
      "total_answered": 908,
      "connection_rate": 0.7264,
      "total_conversions": 127,
      "conversion_rate": 0.1016,
      "average_duration_seconds": 95,
      "total_cost": 4375.50,
      "cost_per_call": 3.50,
      "cost_per_conversion": 34.45
    },
    "funnel": {
      "total_leads": 2000,
      "contacted": 908,
      "interested": 342,
      "converted": 127
    },
    "intent_distribution": {
      "interested": 342,
      "not_interested": 401,
      "callback_requested": 89,
      "dnc_requested": 34,
      "undetermined": 42
    },
    "calls_over_time": [
      { "date": "2026-03-01", "placed": 420, "answered": 305, "failed": 12 }
    ]
  }
}
```

### 7.3 Metric Definitions

| Metric | Calculation |
|---|---|
| `connection_rate` | `total_answered / total_calls` |
| `conversion_rate` | `total_conversions / total_calls` |
| `cost_per_call` | `total_cost / total_calls` |
| `cost_per_conversion` | `total_cost / total_conversions` |
| `funnel.contacted` | Leads with status in `contacted, interested, not_interested, converted, callback_scheduled` |
| `funnel.interested` | Leads with status in `interested, converted` |
| `calls_over_time.answered` | Calls with status `answered` or `completed` |
| `calls_over_time.failed` | Calls with status `failed` |

### 7.4 Acceptance Criteria

| ID | Criterion | How to Verify |
|---|---|---|
| AC-ANA-01 | Dashboard loads in < 2 seconds with 100K+ call records | Performance test with seeded data |
| AC-ANA-02 | Real-time metrics update within 30 seconds of a call completing | Complete call → dashboard reflects new data within 30s |
| AC-ANA-03 | Conversion funnel numbers are mathematically consistent | Verify: contacted ≥ interested ≥ converted |
| AC-ANA-04 | Cost tracking matches sum of individual call costs | Sum calls.cost_amount → compare to analytics total |
| AC-ANA-05 | Date range filter correctly scopes all metrics | Filter to 1 day → verify only that day's data shown |

---

## Module 8 — Integration & Webhooks

**PRD References:** INT-001, TEC-001
**Priority:** HIGH

### 8.1 Overview

The webhook system allows external systems to subscribe to Astos events (call completions, lead updates, campaign state changes) and receive real-time POST notifications. Each delivery is signed with HMAC-SHA256 so receivers can verify authenticity.

### 8.2 WebhookEndpoint Model

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| org_id | UUID FK → Organization | |
| url | VARCHAR(500) | HTTPS delivery URL |
| secret | VARCHAR(255) | 64-char hex signing secret (auto-generated) |
| events | JSON | Array of subscribed event strings |
| is_active | BOOLEAN | default true |
| created_at / updated_at | TIMESTAMP | |

### 8.3 API Endpoints

| Method | Path | Role | Body | Description |
|--------|------|------|------|-------------|
| POST | `/webhooks` | admin | `{ url, events[] }` | Register endpoint; secret auto-generated |
| GET | `/webhooks` | admin | — | List all org endpoints |
| GET | `/webhooks/:id` | admin | — | Get endpoint detail |
| PUT | `/webhooks/:id` | admin | `{ url?, events[]?, is_active? }` | Update endpoint |
| DELETE | `/webhooks/:id` | admin | — | Delete endpoint |
| POST | `/webhooks/:id/rotate-secret` | admin | — | Rotate signing secret |

### 8.4 Webhook Delivery

Every delivery is a POST to the registered URL with headers:

```
Content-Type: application/json
X-Astos-Signature: sha256=<HMAC-SHA256(body, secret)>
X-Astos-Event: call.completed
X-Astos-Delivery: <uuid>
X-Astos-Timestamp: 2026-03-03T14:30:00Z
```

**Retry policy:** 3 attempts, delays 10s → 60s → 300s. Per-attempt timeout: 10 seconds.

**Payload example (`call.completed`):**
```json
{
  "event": "call.completed",
  "timestamp": "2026-03-03T14:30:00Z",
  "data": {
    "call_id": "uuid",
    "campaign_id": "uuid",
    "lead_id": "uuid",
    "status": "completed",
    "duration_seconds": 120,
    "intent_result": "interested",
    "from_number": "+46812345678",
    "to_number": "+46701234567"
  }
}
```

### 8.5 Event Types

| Event | Trigger |
|---|---|
| `call.started` | Call begins |
| `call.completed` | Call ends with any terminal status |
| `call.failed` | Call fails (provider error) |
| `lead.updated` | Lead status or fields changed |
| `lead.converted` | Lead status set to `converted` |
| `campaign.activated` | Campaign status → active |
| `campaign.paused` | Campaign status → paused |
| `campaign.completed` | Campaign status → completed |

### 8.6 Acceptance Criteria

| ID | Criterion | How to Verify |
|---|---|---|
| AC-INT-01 | Webhooks are delivered within 5 seconds of event | Measure time from call completion to webhook receipt |
| AC-INT-02 | Webhook signature is verifiable by recipient | Compute HMAC on receiving end → matches `X-Astos-Signature` header |
| AC-INT-03 | Failed webhooks retry 3 times with backoff | Return 500 from webhook URL → verify 3 retries at 10s / 60s / 300s |
| AC-INT-04 | Rotating secret invalidates old signature | Rotate → old secret no longer verifies new deliveries |
| AC-INT-05 | Inactive endpoints receive no deliveries | Set `is_active=false` → dispatch fires → endpoint not called |

---

## Module 9 — Landing Page

**Frontend:** Next.js (not in this repo).

**Backend (NestJS — implemented):**

### 9.1 Demo Request API

**`POST /public/demo-request`**
- Authentication: none (public endpoint)
- Rate limit: 5 requests per IP per hour

**Request body:**
```json
{
  "company_name": "Stockholm Insurance AB",
  "contact_name": "Anna Svensson",
  "email": "anna@insurance.se",
  "phone": "+46701234567",
  "industry": "insurance",
  "message": "Interested in a pilot for outbound renewal calls.",
  "locale": "sv"
}
```

**Response:** `201 { "message": "Demo request received" }`

**Side effects:**
1. Stores record in `demo_requests` table (including requester IP)
2. Logs internal sales notification email (console — no SMTP yet)
3. Logs requester confirmation email (console — no SMTP yet)

### 9.2 DemoRequest Model

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| company_name | VARCHAR(255) | required |
| contact_name | VARCHAR(255) | required |
| email | VARCHAR(255) | required |
| phone | VARCHAR(30) NULLABLE | |
| industry | VARCHAR(100) NULLABLE | |
| message | TEXT NULLABLE | |
| locale | VARCHAR(10) | default sv |
| ip_address | VARCHAR(45) NULLABLE | captured from request |
| created_at | TIMESTAMP | |

### 9.3 Acceptance Criteria (backend)

| ID | Criterion | How to Verify |
|---|---|---|
| AC-LP-03 | Demo request stores to DB and logs notifications | POST form → check DemoRequest table + console |
| AC-LP-07 | Rate limit blocks > 5 requests/hr from same IP | Send 6 requests → 6th returns 429 |

---

## Module 10 — Security & Infrastructure

**Infrastructure/DevOps:** GKE, Cloud SQL, Redis — outside this repo.

**NestJS hardening (implemented):**

### 10.1 Security Headers

`helmet` middleware applied globally in `main.ts`. Adds:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy: no-referrer`
- `Content-Security-Policy` (default helmet config)

### 10.2 CORS

```typescript
app.enableCors({ origin: FRONTEND_URL, credentials: true })
```
Origin controlled via `FRONTEND_URL` env var.

### 10.3 Rate Limiting

Global default: 60 requests/minute per IP via `ThrottlerModule`.
Per-endpoint overrides via `@Throttle()` decorator.
429 responses use standard error format (`error_code: "RATE_LIMITED"`).

### 10.4 Acceptance Criteria (NestJS)

| ID | Criterion | How to Verify |
|---|---|---|
| AC-SEC-01 | Security headers present on all responses | Check response headers for X-Content-Type-Options, X-Frame-Options |
| AC-SEC-03 | RBAC prevents unauthorized access | Test each role against PERMISSIONS matrix |
| AC-SEC-06 | Rate limiting returns 429 after limit | Exceed 60 req/min → verify 429 with error_code: "RATE_LIMITED" |

---

## Appendix A — Standard Error Response Format

All API errors follow this format (implemented via `HttpExceptionFilter`):

```json
{
  "message": "Human-readable error message",
  "errors": {
    "field_name": ["Specific validation error message"]
  },
  "error_code": "MACHINE_READABLE_CODE",
  "timestamp": "2026-03-03T14:30:00Z",
  "trace_id": "uuid-for-debugging"
}
```

Note: `errors` field is only present for validation failures.

**Error code mapping:**

| error_code | HTTP Status | Trigger |
|---|---|---|
| `VALIDATION_ERROR` | 400 / 422 | ValidationPipe failures |
| `BAD_REQUEST` | 400 | Generic bad request |
| `UNAUTHENTICATED` | 401 | Missing or invalid JWT |
| `UNAUTHORIZED` | 403 | Insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate / state conflict |
| `RATE_LIMITED` | 429 | Throttler limit exceeded |
| `SERVER_ERROR` | 500+ | Unhandled exception |

---

## Appendix B: Environment Variables

| Variable | Description | Example |
|---|---|---|
| `APP_ENV` | Environment | production, staging |
| `APP_URL` | NestJS API base URL | https://api.astos.ai |
| `FRONTEND_URL` | Next.js app URL | https://app.astos.ai |
| `DB_CONNECTION` | Database driver | pgsql |
| `DB_HOST` | Cloud SQL host | /cloudsql/project:region:instance |
| `DB_DATABASE` | Database name | astos_production |
| `REDIS_HOST` | Memorystore host | 10.0.0.5 |
| `TELNYX_API_KEY` | Telnyx API key | (from Secret Manager) |
| `TWILIO_ACCOUNT_SID` | Twilio SID | (from Secret Manager) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | (from Secret Manager) |
| `DEEPGRAM_API_KEY` | Deepgram API key | (from Secret Manager) |
| `OPENAI_API_KEY` | OpenAI API key | (from Secret Manager) |
| `CARTESIA_API_KEY` | Cartesia API key | (from Secret Manager) |
| `GCS_BUCKET_RECORDINGS` | Cloud Storage bucket | astos-recordings-prod |
| `GCS_BUCKET_UPLOADS` | Cloud Storage bucket | astos-uploads-prod |
| `SANCTUM_TOKEN_EXPIRATION` | Token TTL in minutes | 1440 (24 hours) |
| `MAIL_MAILER` | Email provider | smtp |

---

## Appendix C — Pagination & Query Parameter Standard

**NestJS uses flat params** (not Laravel/Spatie bracket notation):

```
GET /resource?page=1&page_size=25&sort=-created_at&status=active&search=keyword
```

| Parameter | Format | Example |
|---|---|---|
| Page number | `page=N` | `page=1` |
| Page size | `page_size=N` | `page_size=25` (max: 100, default: 25) |
| Sort ascending | `sort=field` | `sort=name` |
| Sort descending | `sort=-field` | `sort=-created_at` |
| Filter (exact) | `field=value` | `status=active` |
| Filter (multiple) | `field=v1,v2` | `status=active,paused` |
| Filter (search) | `search=value` | `search=erik` |
| Date range | `date_from=date` | `date_from=2026-03-01` |

Pagination response meta:
```json
{
  "meta": {
    "current_page": 1,
    "page_size": 25,
    "total": 100,
    "last_page": 4
  }
}
```

---
