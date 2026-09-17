import { IsUUID } from 'class-validator';

export class AttachPermissionDto {
  @IsUUID()
  permissionId!: string;
}
