import { Global, Module } from '@nestjs/common';
import { PermissionSyncService } from './permission-sync.service';

// Global like CaslModule: roles, users and permissions all need the sync service, and its
// onApplicationBootstrap hook must run exactly once per app instance.
@Global()
@Module({
  providers: [PermissionSyncService],
  exports: [PermissionSyncService],
})
export class AccessModule {}
