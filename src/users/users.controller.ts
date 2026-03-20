import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PERMISSIONS } from '../auth/permissions';
import { ChangeRoleDto } from './dto/change-role.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(...PERMISSIONS.USERS_LIST)
  @ApiOperation({ summary: 'List all users in the organisation (admin + manager)' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async listUsers(@Request() req: any, @Query() query: ListUsersDto) {
    return this.usersService.listUsers(req.user.orgId, query);
  }

  @Post('invite')
  @Roles(...PERMISSIONS.USERS_INVITE)
  @ApiOperation({ summary: 'Invite a new user to the organisation (admin only)' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  @ApiResponse({ status: 400, description: 'User already a member or invitation already pending' })
  async inviteUser(@Request() req: any, @Body() dto: InviteUserDto, @Ip() ip: string) {
    return this.usersService.inviteUser(req.user.orgId, req.user.userId, dto, ip);
  }

  @Put(':id/role')
  @Roles(...PERMISSIONS.USERS_CHANGE_ROLE)
  @ApiOperation({ summary: 'Change a user\'s role (admin only, cannot change own role)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 403, description: 'Cannot change own role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async changeRole(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @Ip() ip: string,
  ) {
    return this.usersService.changeRole(req.user.orgId, req.user.userId, id, dto, ip);
  }

  @Put(':id/deactivate')
  @Roles(...PERMISSIONS.USERS_DEACTIVATE)
  @ApiOperation({ summary: 'Deactivate a user — revokes all tokens + sessions (admin only)' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  @ApiResponse({ status: 403, description: 'Cannot deactivate self' })
  async deactivateUser(@Request() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.usersService.deactivateUser(req.user.orgId, req.user.userId, id, ip);
  }

  @Put(':id/activate')
  @Roles(...PERMISSIONS.USERS_ACTIVATE)
  @ApiOperation({ summary: 'Reactivate a deactivated user (admin only)' })
  @ApiResponse({ status: 200, description: 'User activated' })
  async activateUser(@Request() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.usersService.activateUser(req.user.orgId, req.user.userId, id, ip);
  }

  @Delete(':id/force-logout')
  @Roles(...PERMISSIONS.USERS_FORCE_LOGOUT)
  @ApiOperation({ summary: 'Force logout a user — revokes all tokens + sessions (admin only)' })
  @ApiResponse({ status: 200, description: 'User logged out' })
  async forceLogout(@Request() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.usersService.forceLogout(req.user.orgId, req.user.userId, id, ip);
  }
}
