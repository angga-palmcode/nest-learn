import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  NobleCryptoPlugin,
  ScureBase32Plugin,
  generateSecret as totpGenerateSecret,
  generateURI as totpGenerateURI,
  verify as totpVerify,
} from 'otplib';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtPayload } from './strategies/jwt.strategy';

// Shared otplib plugin instances
const otpCrypto = new NobleCryptoPlugin();
const otpBase32 = new ScureBase32Plugin();
const otpOptions = { crypto: otpCrypto, base32: otpBase32, strategy: 'totp' as const };

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

interface MfaPendingPayload {
  sub: string;
  type: 'mfa_pending';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  // ─── Validate credentials (used by LocalStrategy) ────────────────────────

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { org: true },
    });

    if (!user || !user.is_active || user.deleted_at) {
      return null;
    }

    // Check lockout
    if (user.locked_until && user.locked_until > new Date()) {
      throw new HttpException(
        'Account is temporarily locked due to too many failed login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      const newAttempts = user.failed_login_attempts + 1;
      const isLocked = newAttempts >= LOGIN_MAX_ATTEMPTS;
      const lockedUntil = isLocked
        ? new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failed_login_attempts: newAttempts,
          ...(isLocked ? { locked_until: lockedUntil } : {}),
        },
      });

      if (isLocked) {
        this.mail.sendAccountLockedEmail(user.email, lockedUntil!);
      }

      return null;
    }

    // Reset on successful password check
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failed_login_attempts: 0, locked_until: null },
      });
    }

    return user;
  }

  // ─── Issue both access + refresh tokens ──────────────────────────────────

  private async generateTokens(user: { id: string; org_id: string; role: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      orgId: user.org_id,
      role: user.role as 'admin' | 'manager' | 'agent',
    };

    const access_token = await this.jwtService.signAsync(payload);

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { token: rawRefreshToken, user_id: user.id, expires_at: expiresAt },
    });

    return { access_token, refresh_token: rawRefreshToken };
  }

  // ─── Login (called after LocalStrategy validates) ─────────────────────────

  async login(
    user: { id: string; org_id: string; role: string; mfa_enabled: boolean; email_verified_at: Date | null; org: { mfa_enforced: boolean } },
    ip?: string,
    userAgent?: string,
    deviceName?: string,
  ) {
    if (!user.email_verified_at) {
      throw new ForbiddenException({
        message: 'Please verify your email before logging in.',
        action: 'resend_verification',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date(), last_login_ip: ip ?? null },
    });

    // MFA required if user has it enabled OR org enforces it
    if (user.mfa_enabled || user.org.mfa_enforced) {
      const mfaPayload: MfaPendingPayload = { sub: user.id, type: 'mfa_pending' };
      const mfa_token = await this.jwtService.signAsync(mfaPayload, { expiresIn: '5m' });
      // mfa_method tells the frontend which challenge flow to use
      const mfa_method = user.mfa_enabled ? 'totp' : 'email';
      return { mfa_required: true, mfa_token, mfa_method };
    }

    const tokens = await this.generateTokens(user);

    // Track session
    const session = await this.createSession(user.id, ip ?? '', userAgent ?? '', deviceName);

    await this.audit.log({
      orgId: user.org_id,
      userId: user.id,
      action: 'user.login',
      ipAddress: ip,
      metadata: { device_name: deviceName },
    });

    return { ...tokens, session_id: session.id };
  }

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(data: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email already in use');

    // Generate org slug from name
    const slug = data.organization_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const slugExists = await this.prisma.organization.findUnique({ where: { slug } });
    if (slugExists) throw new BadRequestException('Organization name already taken');

    const hashed = await bcrypt.hash(data.password, 10);

    const org = await this.prisma.organization.create({
      data: {
        name: data.organization_name,
        slug,
        industry: data.industry ?? null,
        locale: data.locale ?? 'sv',
      },
    });

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: 'admin',
        org_id: org.id,
      },
    });

    // Send verification email
    const hash = this.makeEmailVerificationHash(user.id, user.email);
    this.mail.sendVerificationEmail(user.email, user.id, hash);

    await this.audit.log({
      orgId: org.id,
      userId: user.id,
      action: 'user.registered',
      resourceType: 'User',
      resourceId: user.id,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        email_verified: false,
        organization: { id: org.id, name: org.name, slug: org.slug },
      },
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  // ─── Refresh tokens ───────────────────────────────────────────────────────

  async refreshTokens(rawRefreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: rawRefreshToken },
      include: { user: true },
    });

    if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    if (!stored.user.is_active || stored.user.deleted_at) {
      throw new UnauthorizedException('Account is inactive');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked_at: new Date() },
    });

    return this.generateTokens({
      id: stored.user.id,
      org_id: stored.user.org_id,
      role: stored.user.role,
    });
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(userId: string, orgId: string, rawRefreshToken: string, sessionId?: string, ip?: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token: rawRefreshToken } });
    if (stored && !stored.revoked_at) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revoked_at: new Date() },
      });
    }

    if (sessionId) {
      await this.prisma.userSession.deleteMany({ where: { id: sessionId, user_id: userId } });
    }

    await this.audit.log({ orgId, userId, action: 'user.logout', ipAddress: ip });

    return { message: 'Successfully logged out.' };
  }

  // ─── Email verification ───────────────────────────────────────────────────

  async verifyEmail(userId: string, hash: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.email_verified_at) throw new BadRequestException('Email already verified');

    const expectedHash = this.makeEmailVerificationHash(userId, user.email);
    if (hash !== expectedHash) throw new BadRequestException('Invalid verification link');

    await this.prisma.user.update({
      where: { id: userId },
      data: { email_verified_at: new Date() },
    });

    await this.audit.log({
      orgId: user.org_id,
      userId: user.id,
      action: 'user.email_verified',
      ipAddress: ip,
    });

    return { message: 'Email verified successfully.' };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.email_verified_at && !user.deleted_at) {
      const hash = this.makeEmailVerificationHash(user.id, user.email);
      this.mail.sendVerificationEmail(user.email, user.id, hash);
    }
    return { message: 'If an unverified account with that email exists, we have sent a verification link.' };
  }

  // ─── Forgot / Reset password ──────────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.deleted_at) {
      // Invalidate any existing tokens
      await this.prisma.passwordResetToken.deleteMany({ where: { email } });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.passwordResetToken.create({ data: { email, token, expires_at: expiresAt } });
      this.mail.sendPasswordResetEmail(email, token);
    }
    return { message: 'If an account with that email exists, we have sent a password reset link.' };
  }

  async resetPassword(token: string, email: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { token, email },
    });

    if (!record || record.expires_at < new Date()) {
      throw new BadRequestException('This password reset link is invalid or has expired.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('This password reset link is invalid or has expired.');

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
      this.prisma.refreshToken.updateMany({
        where: { user_id: user.id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
      this.prisma.userSession.deleteMany({ where: { user_id: user.id } }),
      this.prisma.passwordResetToken.deleteMany({ where: { email } }),
    ]);

    this.mail.sendPasswordChangedEmail(email);

    await this.audit.log({
      orgId: user.org_id,
      userId: user.id,
      action: 'user.password_reset',
    });

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  // ─── MFA: generate secret + recovery codes ────────────────────────────────

  async setupMfa(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfa_enabled) throw new BadRequestException('MFA is already enabled');

    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) throw new UnauthorizedException('Current password is incorrect');

    const secret = totpGenerateSecret({ base32: otpBase32 });
    const qr_code_uri = totpGenerateURI({ issuer: 'Astos', label: user.email, secret });

    const recoveryCodes: string[] = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex'),
    );
    const hashedCodes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, 10)));

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfa_secret: secret, mfa_recovery_codes: hashedCodes },
    });

    return { secret, qr_code_uri, recovery_codes: recoveryCodes };
  }

  // ─── MFA: confirm TOTP and enable ────────────────────────────────────────

  async confirmMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfa_secret) throw new BadRequestException('Call /auth/mfa/setup first');
    if (user.mfa_enabled) throw new BadRequestException('MFA is already enabled');

    const result = await totpVerify({ token: code, secret: user.mfa_secret, ...otpOptions });
    if (!result.valid) throw new BadRequestException('Invalid TOTP code');

    await this.prisma.user.update({ where: { id: userId }, data: { mfa_enabled: true } });

    await this.audit.log({ orgId: user.org_id, userId: user.id, action: 'user.mfa_enabled' });

    return { success: true, message: 'MFA enabled successfully' };
  }

  // ─── MFA: disable ────────────────────────────────────────────────────────

  async disableMfa(userId: string, currentPassword: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfa_enabled) throw new BadRequestException('MFA is not enabled');

    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) throw new UnauthorizedException('Current password is incorrect');

    if (!user.mfa_secret) throw new BadRequestException('MFA not configured');
    const result = await totpVerify({ token: code, secret: user.mfa_secret, ...otpOptions });
    if (!result.valid) throw new UnauthorizedException('Invalid TOTP code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfa_enabled: false, mfa_secret: null, mfa_recovery_codes: undefined },
    });

    await this.audit.log({ orgId: user.org_id, userId: user.id, action: 'user.mfa_disabled' });

    return { success: true, message: 'MFA disabled successfully' };
  }

  // ─── MFA: login step 2 — TOTP challenge ──────────────────────────────────

  async verifyMfaChallenge(mfaToken: string, code: string, ip?: string, userAgent?: string, deviceName?: string) {
    const payload = await this.decodeMfaToken(mfaToken);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      include: { org: true },
    });
    if (!user.mfa_secret) throw new UnauthorizedException('MFA not configured');

    const result = await totpVerify({ token: code, secret: user.mfa_secret, ...otpOptions });
    if (!result.valid) throw new UnauthorizedException('Invalid TOTP code');

    const tokens = await this.generateTokens({ id: user.id, org_id: user.org_id, role: user.role });
    const session = await this.createSession(user.id, ip ?? '', userAgent ?? '', deviceName);

    await this.audit.log({
      orgId: user.org_id,
      userId: user.id,
      action: 'user.login',
      metadata: { mfa_method: 'totp' },
      ipAddress: ip,
    });

    return { ...tokens, session_id: session.id };
  }

  // ─── MFA: login step 2 — recovery code ───────────────────────────────────

  async recoverMfa(mfaToken: string, recoveryCode: string, ip?: string, userAgent?: string, deviceName?: string) {
    const payload = await this.decodeMfaToken(mfaToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });

    const storedHashes = (user.mfa_recovery_codes as string[]) ?? [];
    let matchedIndex = -1;

    for (let i = 0; i < storedHashes.length; i++) {
      if (await bcrypt.compare(recoveryCode, storedHashes[i])) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) throw new UnauthorizedException('Invalid recovery code');

    const updatedCodes = storedHashes.filter((_, i) => i !== matchedIndex);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfa_recovery_codes: updatedCodes },
    });

    const tokens = await this.generateTokens({ id: user.id, org_id: user.org_id, role: user.role });
    const session = await this.createSession(user.id, ip ?? '', userAgent ?? '', deviceName);

    await this.audit.log({
      orgId: user.org_id,
      userId: user.id,
      action: 'user.login',
      metadata: { mfa_method: 'recovery_code' },
      ipAddress: ip,
    });

    return { ...tokens, session_id: session.id };
  }

  // ─── MFA: send email OTP ──────────────────────────────────────────────────

  async sendMfaEmailOtp(mfaToken: string) {
    const payload = await this.decodeMfaToken(mfaToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });

    // Invalidate any previous email OTP for this user
    await this.prisma.mfaEmailToken.deleteMany({ where: { user_id: user.id } });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.mfaEmailToken.create({
      data: { user_id: user.id, code_hash: codeHash, expires_at: expiresAt },
    });

    this.mail.sendMfaEmailOtp(user.email, code);

    return { message: 'OTP sent to your email.' };
  }

  // ─── MFA: login step 2 — email OTP challenge ─────────────────────────────

  async verifyMfaEmailChallenge(mfaToken: string, code: string, ip?: string, userAgent?: string, deviceName?: string) {
    const payload = await this.decodeMfaToken(mfaToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const emailToken = await this.prisma.mfaEmailToken.findFirst({
      where: { user_id: user.id, expires_at: { gt: new Date() } },
    });

    if (!emailToken || emailToken.code_hash !== codeHash) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    // Consume the token
    await this.prisma.mfaEmailToken.delete({ where: { id: emailToken.id } });

    const tokens = await this.generateTokens({ id: user.id, org_id: user.org_id, role: user.role });
    const session = await this.createSession(user.id, ip ?? '', userAgent ?? '', deviceName);

    await this.audit.log({
      orgId: user.org_id,
      userId: user.id,
      action: 'user.login',
      metadata: { mfa_method: 'email_otp' },
      ipAddress: ip,
    });

    return { ...tokens, session_id: session.id };
  }

  // ─── Invitation: get info ─────────────────────────────────────────────────

  async getInvitation(token: string) {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { token },
      include: { org: true },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.expires_at < new Date()) throw new BadRequestException('Invitation has expired');
    if (invitation.accepted_at) throw new BadRequestException('Invitation has already been used');

    return {
      email: invitation.email,
      role: invitation.role,
      org: { name: invitation.org.name, slug: invitation.org.slug },
    };
  }

  // ─── Invitation: accept ───────────────────────────────────────────────────

  async acceptInvite(dto: AcceptInviteDto, ip?: string, userAgent?: string) {
    if (dto.password !== dto.password_confirmation) {
      throw new BadRequestException('Passwords do not match');
    }

    const invitation = await this.prisma.userInvitation.findUnique({
      where: { token: dto.token },
      include: { org: true },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.expires_at < new Date()) throw new BadRequestException('Invitation has expired');
    if (invitation.accepted_at) throw new BadRequestException('Invitation has already been used');

    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) throw new BadRequestException('An account with this email already exists');

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: invitation.email,
        password: hashed,
        role: invitation.role,
        org_id: invitation.org_id,
        email_verified_at: new Date(), // auto-verified via invite
        invited_by: invitation.invited_by,
        invited_at: invitation.created_at,
      },
    });

    await this.prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { accepted_at: new Date() },
    });

    await this.audit.log({
      orgId: invitation.org_id,
      userId: user.id,
      action: 'user.registered',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { via: 'invitation' },
    });

    const tokens = await this.generateTokens({ id: user.id, org_id: user.org_id, role: user.role });
    const session = await this.createSession(user.id, ip ?? '', userAgent ?? '');

    await this.audit.log({
      orgId: user.org_id,
      userId: user.id,
      action: 'user.login',
      ipAddress: ip,
      metadata: { via: 'accept_invite' },
    });

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      session_id: session.id,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        email_verified_at: true,
        mfa_enabled: true,
        is_active: true,
        last_login_at: true,
        created_at: true,
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            mfa_enforced: true,
            industry: true,
            timezone: true,
            locale: true,
          },
        },
      },
    });
    return {
      ...user,
      email_verified: !!user.email_verified_at,
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const updateData: Record<string, unknown> = {};

    if (dto.name) updateData.name = dto.name;

    if (dto.password) {
      if (!dto.current_password) {
        throw new BadRequestException('current_password is required to change password');
      }
      const passwordValid = await bcrypt.compare(dto.current_password, user.password);
      if (!passwordValid) throw new UnauthorizedException('Current password is incorrect');
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new BadRequestException('Email already in use');
      updateData.email = dto.email;
      updateData.email_verified_at = null;
      const hash = this.makeEmailVerificationHash(userId, dto.email);
      this.mail.sendVerificationEmail(dto.email, userId, hash);
    }

    await this.prisma.user.update({ where: { id: userId }, data: updateData });
    return this.getMe(userId);
  }

  // ─── Session management ───────────────────────────────────────────────────

  async getSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { user_id: userId, expires_at: { gt: new Date() } },
      orderBy: { last_active_at: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      ip_address: s.ip_address,
      device_name: s.device_name,
      last_active_at: s.last_active_at,
      is_current: s.id === currentSessionId,
      created_at: s.created_at,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, user_id: userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.userSession.delete({ where: { id: sessionId } });
    return { message: 'Session revoked.' };
  }

  async revokeAllSessions(userId: string, orgId: string, currentPassword: string, currentSessionId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) throw new UnauthorizedException('Current password is incorrect');

    await this.prisma.userSession.deleteMany({
      where: {
        user_id: userId,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
    });

    await this.audit.log({ orgId, userId, action: 'user.sessions_revoked' });
    return { message: 'All other sessions revoked.' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async decodeMfaToken(mfaToken: string): Promise<MfaPendingPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<MfaPendingPayload>(mfaToken);
      if (payload.type !== 'mfa_pending') throw new Error('Wrong token type');
      return payload;
    } catch {
      throw new UnauthorizedException('MFA token is invalid or expired');
    }
  }

  private makeEmailVerificationHash(userId: string, email: string): string {
    const secret = this.config.get<string>('JWT_SECRET', 'change-me');
    return crypto.createHmac('sha256', secret).update(`${userId}:${email}`).digest('hex');
  }

  private async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
    deviceName?: string,
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return this.prisma.userSession.create({
      data: { user_id: userId, ip_address: ipAddress, user_agent: userAgent, device_name: deviceName ?? null, expires_at: expiresAt },
    });
  }
}
