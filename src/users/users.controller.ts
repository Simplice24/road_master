import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { AppAbility } from '../casl/casl-ability.factory';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


  @Get()
  @RequirePermission('read', 'User')
  listUsers(@CurrentAbility() abilityParam: unknown) {
    return this.usersService.listUsers(abilityParam as AppAbility);
  }

  @Get(':id')
  @RequirePermission('read', 'User')
  userProfile(@Param('id') id: string, @CurrentAbility() abilityParam: unknown) {
    return this.usersService.userProfile(id, abilityParam as AppAbility);
  }

  @Get(':id/roles')
  @RequirePermission('read', 'Role')
  listRoles(@Param('id') id: string,  @CurrentAbility() abilityParam: unknown) {
    return this.usersService.listRoles(id, abilityParam as AppAbility);
  }

  @Post(':id/roles')
  @RequirePermission('manage', 'Role')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto, @CurrentAbility() abilityParam: unknown) {
    return this.usersService.assignRole(id, dto.roleId, abilityParam as AppAbility);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission('manage', 'Role')
  unassignRole(@Param('id') id: string, @Param('roleId') roleId: string, @CurrentAbility() abilityParam: unknown) {
    return this.usersService.unassignRole(id, roleId, abilityParam as AppAbility);
  }

  @Get(':id/effective-permissions')
  @RequirePermission('read', 'Role')
  getEffectivePermissions(@Param('id') id: string, @CurrentAbility() abilityParam: unknown) {
    return this.usersService.getEffectivePermissions(id);
  }
}
