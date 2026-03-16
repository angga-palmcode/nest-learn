import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeRoleDto } from './dto/change-role.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ListUsersDto } from './dto/list-users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  // ─── List users (admin + manager, scoped to org) ──────────────────────────

  async listUsers(orgId: string, query: ListUsersDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 25;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Record<string, unknown> = {
      org_id: orgId,
      deleted_at: null,
    };

    if (query.role) where.role = query.role;
    if (query.is_active !== undefined) where.is_active = query.is_active === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Sort
    const allowedSorts = ['name', 'email', 'role', 'created_at', 'last_login_at'];
    let orderBy: Record<string, string> = { created_at: 'desc' };
    if (query.sort) {
      const dir = query.sort.startsWith('-') ? 'desc' : 'asc';
      const field = query.sort.replace(/^-/, '');
      if (allowedSorts.includes(field)) {
        orderBy = { [field]: dir };
      }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          is_active: true,
          mfa_enabled: true,
          last_login_at: true,
          created_at: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        current_page: page,
        page_size: pageSize,
        total,
        last_page: Math.ceil(total / pageSize),
      },
    };
  }

  // ─── Invite user ──────────────────────────────────────────────────────────

  async inviteUser(orgId: string, inviterId: string, dto: InviteUserDto, ip?: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

    // Check not already a member
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, org_id: orgId, deleted_at: null },
    });
    if (existing) throw new BadRequestException('User with this email is already a member of this organisation');

    // Check for pending invitation
    const pendingInvite = await this.prisma.userInvitation.findFirst({
      where: { email: dto.email, org_id: orgId, accepted_at: null, expires_at: { gt: new Date() } },
    });
    if (pendingInvite) throw new BadRequestException('An invitation has already been sent to this email');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.userInvitation.create({
      data: {
        org_id: orgId,
        email: dto.email,
        role: dto.role,
        invited_by: inviterId,
        token,
        expires_at: expiresAt,
      },
    });

    const inviter = await this.prisma.user.findUniqueOrThrow({ where: { id: inviterId } });
    this.mail.sendInvitationEmail(dto.email, token, inviter.name, org.name);

    await this.audit.log({
      orgId,
      userId: inviterId,
      action: 'user.invited',
      metadata: { email: dto.email, role: dto.role },
      ipAddress: ip,
    });

    return { message: `Invitation sent to ${dto.email}` };
  }

  // ─── Change role ──────────────────────────────────────────────────────────

  async changeRole(orgId: string, adminId: string, targetUserId: string, dto: ChangeRoleDto, ip?: string) {
    if (adminId === targetUserId) throw new ForbiddenException('You cannot change your own role');

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, org_id: orgId, deleted_at: null },
    });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.user.update({ where: { id: targetUserId }, data: { role: dto.role } });

    await this.audit.log({
      orgId,
      userId: adminId,
      action: 'user.role_changed',
      resourceType: 'User',
      resourceId: targetUserId,
      metadata: { old_role: target.role, new_role: dto.role },
      ipAddress: ip,
    });

    return { message: 'Role updated successfully' };
  }

  // ─── Deactivate user ──────────────────────────────────────────────────────

  async deactivateUser(orgId: string, adminId: string, targetUserId: string, ip?: string) {
    if (adminId === targetUserId) throw new ForbiddenException('You cannot deactivate your own account');

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, org_id: orgId, deleted_at: null },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!target.is_active) throw new BadRequestException('User is already inactive');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: targetUserId }, data: { is_active: false } }),
      this.prisma.refreshToken.updateMany({
        where: { user_id: targetUserId, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
      this.prisma.userSession.deleteMany({ where: { user_id: targetUserId } }),
    ]);

    await this.audit.log({
      orgId,
      userId: adminId,
      action: 'user.deactivated',
      resourceType: 'User',
      resourceId: targetUserId,
      ipAddress: ip,
    });

    return { message: 'User deactivated successfully' };
  }

  // ─── Activate user ────────────────────────────────────────────────────────

  async activateUser(orgId: string, adminId: string, targetUserId: string, ip?: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, org_id: orgId, deleted_at: null },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.is_active) throw new BadRequestException('User is already active');

    await this.prisma.user.update({ where: { id: targetUserId }, data: { is_active: true } });

    await this.audit.log({
      orgId,
      userId: adminId,
      action: 'user.activated',
      resourceType: 'User',
      resourceId: targetUserId,
      ipAddress: ip,
    });

    return { message: 'User activated successfully' };
  }

  // ─── Force logout ─────────────────────────────────────────────────────────

  async forceLogout(orgId: string, adminId: string, targetUserId: string, ip?: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, org_id: orgId, deleted_at: null },
    });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { user_id: targetUserId, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
      this.prisma.userSession.deleteMany({ where: { user_id: targetUserId } }),
    ]);

    await this.audit.log({
      orgId,
      userId: adminId,
      action: 'user.force_logout',
      resourceType: 'User',
      resourceId: targetUserId,
      ipAddress: ip,
    });

    return { message: 'User has been forcefully logged out' };
  }
}
