import { Injectable } from '@nestjs/common';
import { AbilityBuilder } from '@casl/ability';
import { createPrismaAbility, PrismaAbility } from '@casl/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

// The only two literal-string domains the codebase is allowed to hardcode: CASL's verb
// vocabulary, and the set of Prisma models (kept in sync automatically by Prisma.ModelName —
// never hand-maintained). No role or permission *name* ever appears as a type or a literal.
export type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
export type Subjects = Prisma.ModelName | 'all';
export type AppAbility = PrismaAbility<[Actions, Subjects]>;

type PermissionRow = {
  action: string;
  subject: string;
  conditions: Prisma.JsonValue | null;
  fields: Prisma.JsonValue | null;
};

@Injectable()
export class CaslAbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(user: { id: string }): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

    const userWithRoles = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    const roles = userWithRoles.userRoles.map((userRole) => userRole.role);

    // SuperAdmin short-circuit: a role with isSuperAdmin=true grants everything and never
    // needs Permission rows of its own — isSuperAdmin is the one flag the app is allowed to
    // branch on directly.
    if (roles.some((role) => role.isSuperAdmin)) {
      can('manage', 'all');
      return build();
    }

    const permissions: PermissionRow[] = roles.flatMap((role) =>
      role.rolePermissions.map((rolePermission) => rolePermission.permission),
    );

    for (const permission of permissions) {
      const fields = Array.isArray(permission.fields)
        ? (permission.fields as string[])
        : undefined;
      const conditions = permission.conditions
        ? (this.interpolate(permission.conditions, userWithRoles) as Record<
            string,
            unknown
          >)
        : undefined;

      this.addRule(
        can,
        permission.action as Actions,
        permission.subject as Subjects,
        fields,
        conditions,
      );
    }

    return build();
  }

  private addRule(
    can: AbilityBuilder<AppAbility>['can'],
    action: Actions,
    subject: Subjects,
    fields: string[] | undefined,
    conditions: Record<string, unknown> | undefined,
  ): void {
    // AbilityBuilder#can's overloads are designed for static, literal call sites; permission
    // rows here are runtime data loaded from the database, so we bridge through a narrow
    // function type instead of fighting the generics at every call.
    const dynamicCan = can as unknown as (
      action: Actions,
      subject: Subjects,
      fields?: string[],
      conditions?: Record<string, unknown>,
    ) => void;

    dynamicCan(action, subject, fields, conditions);
  }

  // Resolves `${user.path.to.field}` placeholders inside stored `conditions` JSON against the
  // real user record — this is how a row like { subject: "ExamAttempt", conditions: { userId:
  // "${user.id}" } } becomes a live "own records only" CASL condition with no code change.
  private interpolate(value: unknown, user: Record<string, unknown>): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.interpolate(item, user));
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, val]) => [
          key,
          this.interpolate(val, user),
        ]),
      );
    }
    if (typeof value === 'string') {
      const match = /^\$\{user\.([\w.]+)\}$/.exec(value);
      if (match) {
        return match[1]
          .split('.')
          .reduce<unknown>(
            (acc, key) =>
              acc && typeof acc === 'object'
                ? (acc as Record<string, unknown>)[key]
                : undefined,
            user,
          );
      }
    }
    return value;
  }
}
