import { Controller, Get, Param } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { getPermissionCatalog } from '../access/access.config';

// Read-only: permissions are defined in src/access/access.config.ts and synced into the
// database by PermissionSyncService — there is no API to create, edit or delete them.
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /** Modules + actions from the access config, for the role permission picker. */
  @Get('catalog')
  @RequirePermission('read', 'Role')
  catalog() {
    return getPermissionCatalog();
  }

  @Get()
  @RequirePermission('manage', 'Permission')
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @RequirePermission('manage', 'Permission')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }
}
