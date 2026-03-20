import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { DisableMfaDto } from './dto/disable-mfa.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { MfaChallengeDto } from './dto/mfa-challenge.dto';
import { MfaEmailChallengeDto } from './dto/mfa-email-challenge.dto';
import { MfaRecoverDto } from './dto/mfa-recover.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RevokeAllSessionsDto } from './dto/revoke-all-sessions.dto';
import { SendMfaEmailDto } from './dto/send-mfa-email.dto';
import { SetupMfaDto } from './dto/setup-mfa.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Login ────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @ApiOperation({ summary: 'Login with email + password' })
  @ApiResponse({ status: 201, description: 'Token pair, or mfa_required + mfa_token + mfa_method if MFA is needed' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account deactivated or email not verified' })
  @ApiResponse({ status: 429, description: 'Account locked after too many failed attempts' })
  async login(
    @Body() body: LoginDto,
    @Request() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(req.user, ip, userAgent, body.device_name);
  }

  // ─── Register ─────────────────────────────────────────────────────────────

  @Post('register')
  @ApiOperation({ summary: 'Create a new organisation + admin user account' })
  @ApiResponse({ status: 201, description: 'User created — verification email sent' })
  @ApiResponse({ status: 400, description: 'Email already in use or org name taken' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ─── Refresh tokens ───────────────────────────────────────────────────────

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token — returns new token pair' })
  @ApiResponse({ status: 201, description: 'New access_token + refresh_token' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refresh_token);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Session-ID', required: false, description: 'Current session ID to revoke' })
  @ApiOperation({ summary: 'Revoke refresh token and session (logout)' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Request() req: any,
    @Ip() ip: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.authService.logout(req.user.userId, req.user.orgId, dto.refresh_token, sessionId, ip);
  }

  // ─── Email verification ───────────────────────────────────────────────────

  @Post('email/verify/:id/:hash')
  @ApiOperation({ summary: 'Verify email address via signed link' })
  @ApiResponse({ status: 201, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or already-used link' })
  async verifyEmail(
    @Param('id') id: string,
    @Param('hash') hash: string,
    @Ip() ip: string,
  ) {
    return this.authService.verifyEmail(id, hash, ip);
  }

  @Post('email/resend-verification')
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 201, description: 'Verification email sent (if account exists and is unverified)' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  // ─── Password reset ───────────────────────────────────────────────────────

  @Post('forgot-password')
  @ApiOperation({ summary: 'Initiate password reset — sends email with reset link' })
  @ApiResponse({ status: 201, description: 'Reset email sent (always 200 to prevent enumeration)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Complete password reset with token from email' })
  @ApiResponse({ status: 201, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.email, dto.password);
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile (name, email, password)' })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  async updateMe(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateMe(req.user.userId, dto);
  }

  // ─── MFA setup ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP secret + QR code URI + 8 recovery codes (step 1)' })
  @ApiResponse({ status: 201, description: 'Returns secret, qr_code_uri, recovery_codes (shown once)' })
  @ApiResponse({ status: 400, description: 'MFA already enabled' })
  async mfaSetup(@Request() req: any, @Body() dto: SetupMfaDto) {
    return this.authService.setupMfa(req.user.userId, dto.current_password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/confirm')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm TOTP code and enable MFA (step 2)' })
  @ApiResponse({ status: 201, description: 'MFA enabled' })
  @ApiResponse({ status: 400, description: 'Invalid code or setup not started' })
  async mfaConfirm(@Request() req: any, @Body() dto: MfaVerifyDto) {
    return this.authService.confirmMfa(req.user.userId, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('mfa')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA (requires current password + valid TOTP code)' })
  @ApiResponse({ status: 200, description: 'MFA disabled' })
  async mfaDisable(@Request() req: any, @Body() dto: DisableMfaDto) {
    return this.authService.disableMfa(req.user.userId, dto.current_password, dto.code);
  }

  // ─── MFA login challenges ─────────────────────────────────────────────────

  @Post('mfa/challenge')
  @ApiOperation({ summary: 'Login step 2 (TOTP): submit authenticator code → full token pair' })
  @ApiResponse({ status: 201, description: 'Returns access_token + refresh_token + session_id' })
  @ApiResponse({ status: 401, description: 'Invalid or expired mfa_token / wrong TOTP code' })
  async mfaChallenge(
    @Body() dto: MfaChallengeDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.verifyMfaChallenge(dto.mfa_token, dto.code, ip, userAgent);
  }

  @Post('mfa/recover')
  @ApiOperation({ summary: 'Login step 2 (MFA): use a backup recovery code → full token pair' })
  @ApiResponse({ status: 201, description: 'Returns access_token + refresh_token; recovery code is consumed' })
  @ApiResponse({ status: 401, description: 'Invalid recovery code or expired mfa_token' })
  async mfaRecover(
    @Body() dto: MfaRecoverDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.recoverMfa(dto.mfa_token, dto.recovery_code, ip, userAgent);
  }

  @Post('mfa/send-email')
  @ApiOperation({ summary: "Send a 6-digit OTP to the user's email (for email MFA flow)" })
  @ApiResponse({ status: 201, description: 'OTP sent' })
  @ApiResponse({ status: 401, description: 'Invalid or expired mfa_token' })
  async mfaSendEmail(@Body() dto: SendMfaEmailDto) {
    return this.authService.sendMfaEmailOtp(dto.mfa_token);
  }

  @Post('mfa/challenge/email')
  @ApiOperation({ summary: 'Login step 2 (email OTP): submit emailed code → full token pair' })
  @ApiResponse({ status: 201, description: 'Returns access_token + refresh_token + session_id' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP code or mfa_token' })
  async mfaChallengeEmail(
    @Body() dto: MfaEmailChallengeDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.verifyMfaEmailChallenge(dto.mfa_token, dto.code, ip, userAgent);
  }

  // ─── Invitation ───────────────────────────────────────────────────────────

  @Get('accept-invite/:token')
  @ApiOperation({ summary: 'Get invitation details (email, org, role) before accepting' })
  @ApiResponse({ status: 200, description: 'Invitation info' })
  @ApiResponse({ status: 400, description: 'Invitation expired or already used' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async getInvitation(@Param('token') token: string) {
    return this.authService.getInvitation(token);
  }

  @Post('accept-invite')
  @ApiOperation({ summary: 'Accept invitation — creates account and returns token pair' })
  @ApiResponse({ status: 201, description: 'Account created, returns access_token + refresh_token + session_id' })
  @ApiResponse({ status: 400, description: 'Invitation expired, already used, or passwords mismatch' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.acceptInvite(dto, ip, userAgent);
  }

  // ─── Session management ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Session-ID', required: false, description: 'Current session ID (marks which session is current)' })
  @ApiOperation({ summary: 'List all active sessions for the current user' })
  async getSessions(
    @Request() req: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.authService.getSessions(req.user.userId, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(@Request() req: any, @Param('id') id: string) {
    return this.authService.revokeSession(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Session-ID', required: false, description: 'Current session ID to preserve' })
  @ApiOperation({ summary: 'Revoke all sessions except the current one (requires password)' })
  @ApiResponse({ status: 200, description: 'All other sessions revoked' })
  async revokeAllSessions(
    @Request() req: any,
    @Body() dto: RevokeAllSessionsDto,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.authService.revokeAllSessions(req.user.userId, req.user.orgId, dto.current_password, sessionId);
  }
}
