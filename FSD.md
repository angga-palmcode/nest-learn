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

---

## Tech Stack Reference

All implementations in this FSD use the following stack. AI agents and developers must use these technologies unless explicitly noted otherwise.

| Layer | Technology | Version / Notes |
|---|---|---|
| Frontend | Next.js (React) | Latest stable. App Router. TypeScript required. |
| Backend API | Laravel (PHP) | Latest stable (11.x+). RESTful JSON API only. |
| Authentication | Laravel Sanctum | Stateless API token authentication (Bearer tokens). |
| AI Services | Python (FastAPI) | Voice pipeline, STT/TTS orchestration, LLM engine. |
| Database | PostgreSQL 15+ | Hosted on GCP Cloud SQL. Multi-AZ replication. |
| Cache | Redis (GCP Memorystore) | Sessions, agent config, active call state. |
| Message Queue | GCP Pub/Sub + Redis Streams | Real-time events + analytics pipeline. |
| Cloud | Google Cloud Platform (GCP) | GKE, Cloud SQL, Cloud Storage, Memorystore, Pub/Sub. |
| Storage | GCP Cloud Storage | Call recordings, CSV uploads, exports. Lifecycle policies. |
| CI/CD | GitHub Actions + Cloud Build | Blue-green deployment to GKE. >80% test coverage gate. |
| Monitoring | Prometheus + Grafana | Metrics. Cloud Monitoring + Cloud Logging for GCP-native. OpenTelemetry + Jaeger for tracing. |

### Coding Conventions

- **API format:** All API responses use JSON. All endpoints are prefixed with `/api/` (no versioning).
- **Query Builder:** All list/index endpoints use [Spatie Laravel Query Builder](https://spatie.be/docs/laravel-query-builder). Query parameters follow the JSON API specification:
  - **Filtering:** `?filter[field]=value` — e.g., `?filter[status]=active&filter[role]=admin`
  - **Sorting:** `?sort=field` (ascending) or `?sort=-field` (descending) — e.g., `?sort=-created_at,name`
  - **Including relations:** `?include=relation1,relation2` — e.g., `?include=organization,sessions`
  - **Sparse fields:** `?fields[resource]=field1,field2` — e.g., `?fields[users]=id,name,email`
  - **Appends:** `?append=computed1,computed2` — for computed/accessor attributes
  - **Pagination:** `?page[number]=1&page[size]=25` (JSON API spec)
  - All allowed filters, sorts, includes, and fields must be explicitly declared using `allowedFilters()`, `allowedSorts()`, `allowedIncludes()`, and `allowedFields()` on the QueryBuilder instance. Any parameter not explicitly allowed is silently ignored (security by default).
- **Timestamps:** All timestamps are stored and returned in ISO 8601 UTC format (`2026-03-03T14:30:00Z`).
- **UUIDs:** All primary keys use UUIDv4 (not auto-increment integers). This applies to all tables.
- **Soft deletes:** All models use soft deletes (`deleted_at` column). No hard deletes except for GDPR right-to-deletion requests.
- **Multi-tenancy:** Every database table that stores tenant data must include an `org_id` column. Every query must scope by `org_id`. Row-level security enforced at the database level.
- **Validation:** All input validation happens at the Laravel API layer using Form Request classes. The frontend performs client-side validation for UX but never trusts it for security.
- **Error format:** All API errors return a consistent JSON structure (see Section 2.10).
- **Language:** All code comments, variable names, API field names, and documentation are in English. User-facing UI text supports Swedish (primary) and English.

---

## 1. MODULE: Authentication & User Management

**PRD References:** AUTH-001 through AUTH-008, SEC-001, SEC-002
**Priority:** CRITICAL
**Owner:** Backend (Laravel) + Frontend (Next.js)

### 1.1 Overview

Authentication is the first system a user interacts with. It controls access to every other module. The system uses **Laravel Sanctum in stateless API token mode**. The Next.js frontend communicates with the Laravel API exclusively via authenticated API calls using Bearer tokens.

**Authentication mode: Stateless API Tokens (Bearer tokens only).**
- On successful login, the API issues a plaintext token. The frontend stores it securely (e.g., in memory or a secure cookie managed by the frontend).
- Every API request includes the token in the `Authorization: Bearer {token}` header.
- No server-side session state. No CSRF tokens needed. No cookie-based auth.
- Tokens are validated on every request by hashing the provided token and matching against the `personal_access_tokens` table.
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
| `invited_by` | UUID | FK → users.id, NULLABLE | Who invited this user |
| `invited_at` | TIMESTAMP | NULLABLE | When invitation was sent |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |
| `deleted_at` | TIMESTAMP | NULLABLE | Soft delete |

#### Table: `personal_access_tokens` (Sanctum default)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Token ID |
| `tokenable_type` | VARCHAR(255) | NOT NULL | Polymorphic type (App\Models\User) |
| `tokenable_id` | UUID | NOT NULL | User ID |
| `name` | VARCHAR(255) | NOT NULL | Token name (e.g., 'web-session', 'api-key') |
| `token` | VARCHAR(64) | UNIQUE, NOT NULL | SHA-256 hash of the token |
| `abilities` | JSON | NULLABLE | Token abilities/scopes |
| `last_used_at` | TIMESTAMP | NULLABLE | |
| `expires_at` | TIMESTAMP | NULLABLE | Token expiration |
| `created_at` | TIMESTAMP | NOT NULL | |
| `updated_at` | TIMESTAMP | NOT NULL | |

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

#### 1.3.1 POST `/api/auth/register`

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

#### 1.3.2 POST `/api/auth/login`

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
4. Verify password using `Hash::check()`. If wrong → increment fail counter → 401.
5. If fail counter >= 5 within 15 minutes → 429 with lockout message + send lockout notification email.
6. If `organizations.mfa_enforced` is true OR `users.mfa_enabled` is true → return 200 with `mfa_required: true` (do NOT issue token yet).
7. If MFA not required → issue Sanctum token, create `user_sessions` record, update `last_login_at` and `last_login_ip`.

**Success response — no MFA (200 OK):**
```json
{
  "data": {
    "token": "1|abc123def456...",
    "token_type": "Bearer",
    "expires_at": "2026-03-04T14:30:00Z",
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
}
```

**Success response — MFA required (200 OK):**
```json
{
  "data": {
    "mfa_required": true,
    "mfa_token": "temporary-mfa-token-uuid",
    "mfa_methods": ["totp", "email"],
    "message": "Multi-factor authentication required."
  }
}
```

**Error responses:**
| Status | Condition | Body |
|---|---|---|
| 401 | Invalid credentials | `{ "message": "Invalid email or password." }` |
| 403 | Account deactivated | `{ "message": "Your account has been deactivated. Contact your administrator." }` |
| 403 | Email not verified | `{ "message": "Please verify your email before logging in.", "action": "resend_verification" }` |
| 429 | Rate limited (lockout) | `{ "message": "Too many failed attempts. Account locked for 15 minutes.", "retry_after": 900, "locked_until": "2026-03-03T14:45:00Z" }` |

---

#### 1.3.3 POST `/api/auth/mfa/verify`

**Purpose:** Verify MFA code after login.
**Authentication:** Requires `mfa_token` from login response.
**Rate limit:** 5 attempts per mfa_token.

**Request body:**
```json
{
  "mfa_token": "temporary-mfa-token-uuid",
  "code": "123456",
  "method": "totp"
}
```

**Flow logic:**
1. Validate `mfa_token` exists and has not expired (5-minute TTL stored in Redis).
2. If `method` is `totp` → verify code against user's `mfa_secret` using TOTP algorithm (30-second window, allow ±1 period drift).
3. If `method` is `email` → verify code against the OTP sent via email (6-digit, 10-minute TTL).
4. If code is a recovery code → mark recovery code as used, verify match.
5. On success → issue Sanctum token, create session, delete mfa_token from Redis.
6. On failure → increment attempt counter. After 5 failures, invalidate mfa_token.

**Success response (200 OK):** Same as login success (token + user object).

**Error responses:**
| Status | Condition | Body |
|---|---|---|
| 401 | Invalid or expired MFA code | `{ "message": "Invalid verification code." }` |
| 401 | MFA token expired | `{ "message": "MFA session expired. Please log in again." }` |
| 429 | Too many attempts | `{ "message": "Too many failed MFA attempts. Please log in again." }` |

---

#### 1.3.4 POST `/api/auth/logout`

**Purpose:** Revoke the current session token.
**Authentication:** Required (Bearer token).

**Request body:** None.

**Flow logic:**
1. Revoke the current Sanctum token.
2. Delete the corresponding `user_sessions` record.
3. Log `user.logout` to `audit_logs`.

**Success response (200 OK):**
```json
{
  "message": "Successfully logged out."
}
```

---

#### 1.3.5 POST `/api/auth/forgot-password`

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
2. If user exists → generate signed reset token (60-minute TTL), store hash in `password_reset_tokens` table, send reset email with link.
3. Reset link format: `{FRONTEND_URL}/auth/reset-password?token={token}&email={email}`

**Success response (200 OK):**
```json
{
  "message": "If an account with that email exists, we have sent a password reset link."
}
```

---

#### 1.3.6 POST `/api/auth/reset-password`

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
4. Delete all existing tokens for this user (Sanctum tokens + reset tokens).
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

#### 1.3.7 POST `/api/auth/email/verify/{id}/{hash}`

**Purpose:** Verify user email address.
**Authentication:** None (signed URL).

**Flow logic:**
1. Validate the signed URL (signature + expiration check via Laravel's `URL::hasValidSignature()`).
2. Set `email_verified_at` to current timestamp.
3. Log `user.email_verified` to `audit_logs`.

**Success response:** Redirect to `{FRONTEND_URL}/auth/login?verified=true`.

---

#### 1.3.8 POST `/api/auth/email/resend-verification`

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

#### 1.3.9 GET `/api/auth/me`

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

#### 1.3.10 PUT `/api/auth/me`

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

**POST `/api/auth/mfa/setup`** — Generate TOTP secret and QR code URI.
**Authentication:** Required. Requires `current_password` in body for verification.

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

**POST `/api/auth/mfa/confirm`** — Confirm MFA setup by verifying a TOTP code.
**Request:** `{ "code": "123456" }`
**Flow:** Verify code against the secret. If valid → set `mfa_enabled = true`, encrypt and store secret + recovery codes. Log `user.mfa_enabled`.

**DELETE `/api/auth/mfa`** — Disable MFA.
**Request:** `{ "current_password": "...", "code": "123456" }`
**Flow:** Verify password + TOTP code. If valid → set `mfa_enabled = false`, null out `mfa_secret` and `mfa_recovery_codes`. Log `user.mfa_disabled`.

---

#### 1.3.12 Session Management Endpoints

**GET `/api/auth/sessions`** — List active sessions for current user.
**Authentication:** Required.

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

**DELETE `/api/auth/sessions/{id}`** — Revoke a specific session.
**Authentication:** Required. User can revoke own sessions. Admins can revoke any session in their org.

**DELETE `/api/auth/sessions`** — Revoke all sessions except current.
**Authentication:** Required. Request body: `{ "current_password": "..." }`.

---

#### 1.3.13 User Management Endpoints (Admin Only)

**GET `/api/users`** — List all users in the organization.
**Authentication:** Required. Role: `admin` or `manager` (managers get read-only).
**Query params (Spatie Query Builder):**
```
?filter[role]=manager
&filter[search]=erik
&filter[is_active]=true
&sort=-created_at
&include=organization
&page[number]=1
&page[size]=25
```
**Allowed filters:** `role` (exact), `search` (partial — matches `name` and `email`), `is_active` (exact).
**Allowed sorts:** `name`, `email`, `role`, `created_at`, `last_login_at`.
**Allowed includes:** `organization`.

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

**POST `/api/users/invite`** — Invite a new user.
**Authentication:** Required. Role: `admin`.

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

**PUT `/api/users/{id}/role`** — Change a user's role.
**Authentication:** Required. Role: `admin`. Cannot change own role.

**Request:** `{ "role": "agent" }`

**PUT `/api/users/{id}/deactivate`** — Deactivate a user.
**Authentication:** Required. Role: `admin`. Cannot deactivate self.

**Flow:**
1. Set `is_active = false`.
2. Revoke ALL Sanctum tokens for this user.
3. Delete all `user_sessions` for this user.
4. Log `user.deactivated`.

**PUT `/api/users/{id}/activate`** — Reactivate a user.
**Authentication:** Required. Role: `admin`.

**DELETE `/api/users/{id}/force-logout`** — Force logout a user.
**Authentication:** Required. Role: `admin`.
**Flow:** Revoke all tokens + delete all sessions for the target user.

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

**Implementation:** Create a Laravel middleware `CheckRole` and use Laravel Policies for resource-level authorization.

```php
// Example middleware usage in routes
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::post('/users/invite', [UserController::class, 'invite']);
});

// Example policy
public function update(User $authUser, Campaign $campaign): bool
{
    if ($authUser->role === 'admin') return true;
    if ($authUser->role === 'manager' && $campaign->org_id === $authUser->org_id) return true;
    return false;
}
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
2. On submit → show loading spinner on button → call POST `/api/auth/login`.
3. If success with no MFA → store token, redirect to `/dashboard`.
4. If success with MFA → redirect to `/auth/mfa-verify` with `mfa_token` in state.
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
1. If method is `email` and page loads → auto-send email OTP via POST `/api/auth/mfa/send-email`.
2. On submit → call POST `/api/auth/mfa/verify`.
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
2. On submit → call POST `/api/auth/register`.
3. On success → redirect to `/auth/verify-email` with success message.
4. On 422 → show field-level errors.

#### Password Reset Flow

**Page 1 (`/auth/forgot-password`):** Email input + submit. Always shows success message.
**Page 2 (`/auth/reset-password?token=...&email=...`):** New password + confirm + submit. On success → redirect to login.

#### Accept Invitation Page (`/auth/accept-invite?token=...`)

**Fields:** Name (pre-filled if provided), password, confirm password.
**Flow:** Call POST `/api/auth/accept-invite` → on success → redirect to login.

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