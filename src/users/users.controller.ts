import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/roles')
  @RequirePermission('read', 'Role')
  listRoles(@Param('id') id: string) {
    return this.usersService.listRoles(id);
  }

  @Post(':id/roles')
  @RequirePermission('manage', 'Role')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(id, dto.roleId);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission('manage', 'Role')
  unassignRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.usersService.unassignRole(id, roleId);
  }

  @Get(':id/effective-permissions')
  @RequirePermission('read', 'Role')
  getEffectivePermissions(@Param('id') id: string) {
    return this.usersService.getEffectivePermissions(id);
  }
}
