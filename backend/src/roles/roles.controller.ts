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

@Controller('roles')
@RequirePermission('manage', 'Role')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions')
  attachPermission(@Param('id') id: string, @Body() dto: AttachPermissionDto) {
    return this.rolesService.attachPermission(id, dto.permissionId);
  }

  @Delete(':id/permissions/:permissionId')
  detachPermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolesService.detachPermission(id, permissionId);
  }

  @Post(':id/default')
  setDefault(@Param('id') id: string) {
    return this.rolesService.setDefault(id);
  }
}
