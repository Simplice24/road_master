import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppAbility } from '../casl/casl-ability.factory';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('read', 'User')
  listUsers(@CurrentAbility() abilityParam: unknown) {
    return this.usersService.listUsers(abilityParam as AppAbility);
  }

  @Post()
  @RequirePermission('create', 'User')
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentAbility() abilityParam: unknown,
    @CurrentUser() caller: Express.User,
  ) {
    return this.usersService.adminCreate(
      dto,
      abilityParam as AppAbility,
      caller.id,
    );
  }

  @Get(':id')
  @RequirePermission('read', 'User')
  userProfile(
    @Param('id') id: string,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.usersService.userProfile(id, abilityParam as AppAbility);
  }

  @Put(':id')
  @RequirePermission('update', 'User')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.usersService.updateUser(id, dto, abilityParam as AppAbility);
  }

  @Patch(':id/status')
  @RequirePermission('update', 'User')
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentAbility() abilityParam: unknown,
    @CurrentUser() caller: Express.User,
  ) {
    return this.usersService.setStatus(
      id,
      dto.isActive,
      abilityParam as AppAbility,
      caller.id,
    );
  }

  @Get(':id/roles')
  @RequirePermission('read', 'Role')
  listRoles(@Param('id') id: string, @CurrentAbility() abilityParam: unknown) {
    return this.usersService.listRoles(id, abilityParam as AppAbility);
  }

  @Put(':id/roles')
  @RequirePermission('manage', 'UserRole')
  setRoles(
    @Param('id') id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() caller: Express.User,
  ) {
    return this.usersService.setRoles(id, dto.roleIds, caller.id);
  }

  @Post(':id/roles')
  @RequirePermission('manage', 'UserRole')
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() caller: Express.User,
  ) {
    return this.usersService.assignRole(id, dto.roleId, caller.id);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission('manage', 'UserRole')
  unassignRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser() caller: Express.User,
  ) {
    return this.usersService.unassignRole(id, roleId, caller.id);
  }

  @Get(':id/effective-permissions')
  @RequirePermission('read', 'Role')
  getEffectivePermissions(@Param('id') id: string) {
    return this.usersService.getEffectivePermissions(id);
  }
}
