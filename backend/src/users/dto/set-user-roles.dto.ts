import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetUserRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roleIds!: string[];
}
