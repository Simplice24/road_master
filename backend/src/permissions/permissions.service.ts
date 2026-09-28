import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePermissionDto) {
    // No DB-level unique index covers (action, subject, conditions) — Json columns can't be
    // part of a unique index on MySQL — so exact-duplicate detection happens here: same
    // action + subject + deep-equal conditions is rejected, but the same action+subject with
    // *different* conditions (e.g. an unconditioned admin rule alongside an owner-scoped
    // client rule) is legitimate and allowed.
    const candidates = await this.prisma.permission.findMany({
      where: { action: dto.action, subject: dto.subject },
    });
    const duplicate = candidates.find(
      (candidate) =>
        this.canonicalize(candidate.conditions) ===
        this.canonicalize(dto.conditions ?? null),
    );
    if (duplicate) {
      throw new ConflictException(
        `A permission for action "${dto.action}" on subject "${dto.subject}" with the same conditions already exists`,
      );
    }

    return this.prisma.permission.create({
      data: {
        action: dto.action,
        subject: dto.subject,
        conditions: dto.conditions as Prisma.InputJsonValue | undefined,
        fields: dto.fields,
        description: dto.description,
      },
    });
  }

  findAll() {
    return this.prisma.permission.findMany();
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async update(id: string, dto: UpdatePermissionDto) {
    await this.findOne(id);
    return this.prisma.permission.update({
      where: { id },
      data: {
        conditions: dto.conditions as Prisma.InputJsonValue | undefined,
        fields: dto.fields,
        description: dto.description,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.permission.delete({ where: { id } });
  }

  private canonicalize(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value))
      return `[${value.map((item) => this.canonicalize(item)).join(',')}]`;
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => a.localeCompare(b),
      );
      return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${this.canonicalize(val)}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }
}
