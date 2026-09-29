import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AttachPermissionDto } from './dto/attach-permission.dto';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';

// Per-route checks map onto the roles.* permissions in access.config.ts (view/create/update/
// delete). Assigning roles to users lives on UsersController under roles.assign.
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermission('create', 'Role')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @RequirePermission('read', 'Role')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequirePermission('read', 'Role')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('update', 'Role')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('delete', 'Role')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions')
  @RequirePermission('update', 'Role')
  attachPermission(@Param('id') id: string, @Body() dto: AttachPermissionDto) {
    return this.rolesService.attachPermission(id, dto.permissionId);
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermission('update', 'Role')
  detachPermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolesService.detachPermission(id, permissionId);
  }

  @Post(':id/default')
  @RequirePermission('update', 'Role')
  setDefault(@Param('id') id: string) {
    return this.rolesService.setDefault(id);
  }
}
