/**
 * Central RBAC permission matrix.
 * Every role assignment lives here — update this file to change access control.
 */
export const PERMISSIONS = {
  // ─── Users ────────────────────────────────────────────────────────────────
  USERS_LIST:         ['admin', 'manager'] as const,
  USERS_INVITE:       ['admin'] as const,
  USERS_CHANGE_ROLE:  ['admin'] as const,
  USERS_DEACTIVATE:   ['admin'] as const,
  USERS_ACTIVATE:     ['admin'] as const,
  USERS_FORCE_LOGOUT: ['admin'] as const,

  // ─── Organization ─────────────────────────────────────────────────────────
  ORG_SETTINGS:       ['admin'] as const,

  // ─── Audit ────────────────────────────────────────────────────────────────
  AUDIT_VIEW:         ['admin'] as const,

  // ─── Compliance ───────────────────────────────────────────────────────────
  COMPLIANCE_CONSENT_WRITE:     ['admin', 'manager'] as const,
  COMPLIANCE_DNC_READ:          ['admin', 'manager', 'agent'] as const,
  COMPLIANCE_DNC_WRITE:         ['admin', 'manager'] as const,
  COMPLIANCE_DNC_SYNC:          ['admin'] as const,
  COMPLIANCE_DISCLOSURES_READ:  ['admin', 'manager'] as const,
  COMPLIANCE_DISCLOSURES_WRITE: ['admin', 'manager'] as const,
  COMPLIANCE_AUDIT_READ:        ['admin'] as const,
  COMPLIANCE_AUDIT_EXPORT:      ['admin'] as const,

  // ─── Telephony ────────────────────────────────────────────────────────────
  CALLS_READ:      ['admin', 'manager'] as const,
  CALLS_RECORDING: ['admin', 'manager'] as const,

  // ─── Campaigns ────────────────────────────────────────────────────────────
  CAMPAIGNS_READ:         ['admin', 'manager'] as const,
  CAMPAIGNS_WRITE:        ['admin', 'manager'] as const,
  CAMPAIGNS_DELETE:       ['admin'] as const,
  CAMPAIGNS_LEADS_UPLOAD: ['admin', 'manager'] as const,

  // ─── AI Voice Pipeline ────────────────────────────────────────────────────
  AI_VOICES_READ:       ['admin', 'manager', 'agent'] as const,
  AI_SCRIPTS_VALIDATE:  ['admin', 'manager'] as const,
} as const;
