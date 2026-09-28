import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    try {
      return await this.prisma.role.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `A role named "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.role.findMany({ include: { defaultRole: true } });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
        defaultRole: true,
      },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    try {
      return await this.prisma.role.update({ where: { id }, data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `A role named "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.role.delete({ where: { id } });
  }

  async attachPermission(roleId: string, permissionId: string) {
    await this.findOne(roleId);
    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  }

  async detachPermission(roleId: string, permissionId: string) {
    await this.prisma.rolePermission
      .delete({ where: { roleId_permissionId: { roleId, permissionId } } })
      .catch(() => undefined);
  }

  /** Makes `roleId` the single default role assigned to every user after the first. The
   * DefaultRole table is a pinned-primary-key singleton (id is always 1), so this upsert is
   * the only way this pointer is ever written — a second row can never exist. */
  async setDefault(roleId: string) {
    await this.findOne(roleId);
    return this.prisma.defaultRole.upsert({
      where: { id: 1 },
      update: { roleId },
      create: { id: 1, roleId },
    });
  }
}
