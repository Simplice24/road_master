import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERMISSION_DEFINITIONS,
  PermissionDefinition,
  getPermissionDefinition,
} from './access.config';
import { canonicalJson } from './canonical-json';

/** The subset of the Prisma client this service needs — satisfied by both PrismaService and an
 * interactive-transaction client, so callers can sync inside their own transaction. */
export type PermissionStore = Pick<Prisma.TransactionClient, 'permission'>;

/**
 * Keeps the `permissions` table in line with ACCESS_CONFIG. Rows are only ever created or
 * given a name — never deleted or rewritten — so no existing role assignment can be lost:
 *
 * - A config entry with a named row: nothing to do.
 * - A config entry with no named row but an *unnamed* row with the same action + subject +
 *   conditions (a pre-config seeded row): that row is adopted by setting its name, keeping
 *   every role_permissions link that points at it.
 * - Otherwise: a new row is created.
 *
 * Rows that end up matching no config entry (unnamed legacy rows, or rows whose name was
 * removed from the config) stay in place and stay enforced for roles that already hold them —
 * silently revoking access on deploy would be worse — but are logged as a warning, excluded
 * from the catalog, and rejected by resolveNames() so they can't be newly assigned.
 */
@Injectable()
export class PermissionSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.syncAll();
  }

  async syncAll(store: PermissionStore = this.prisma): Promise<void> {
    for (const definition of PERMISSION_DEFINITIONS) {
      await this.ensure(definition, store);
    }

    const configured = new Set<string>(
      PERMISSION_DEFINITIONS.map((d) => d.name),
    );
    const orphans = (await store.permission.findMany()).filter(
      (row) => row.name === null || !configured.has(row.name),
    );
    if (orphans.length > 0) {
      this.logger.warn(
        `${orphans.length} permission row(s) are not defined in access.config.ts and can't be ` +
          `newly assigned (still enforced for roles that hold them): ` +
          orphans
            .map(
              (row) => row.name ?? `${row.action} ${row.subject} [${row.id}]`,
            )
            .join(', '),
      );
    }
  }

  /**
   * Validates `names` against the config (rejecting every unknown one in a single 400), makes
   * sure each has a row, and returns their permission ids in input order.
   */
  async resolveNames(
    names: string[],
    store: PermissionStore = this.prisma,
  ): Promise<string[]> {
    const unique = [...new Set(names)];
    const unknown = unique.filter((name) => !getPermissionDefinition(name));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown permission(s): ${unknown.join(', ')}. Permissions must be defined in the access config.`,
      );
    }

    const ids: string[] = [];
    for (const name of unique) {
      ids.push(await this.ensure(getPermissionDefinition(name)!, store));
    }
    return ids;
  }

  private async ensure(
    definition: PermissionDefinition,
    store: PermissionStore,
  ): Promise<string> {
    const named = await store.permission.findUnique({
      where: { name: definition.name },
    });
    if (named) return named.id;

    const { action, subject, conditions } = definition.rule;
    const wanted = canonicalJson(conditions ?? null);
    const adoptable = (
      await store.permission.findMany({
        where: { action, subject, name: null },
        orderBy: { createdAt: 'asc' },
      })
    ).find((row) => canonicalJson(row.conditions) === wanted);

    try {
      if (adoptable) {
        await store.permission.update({
          where: { id: adoptable.id },
          data: { name: definition.name },
        });
        return adoptable.id;
      }
      const created = await store.permission.create({
        data: {
          name: definition.name,
          action,
          subject,
          conditions: conditions as Prisma.InputJsonValue | undefined,
          description: `${definition.module}: ${definition.label}`,
        },
      });
      return created.id;
    } catch (error) {
      // A concurrent sync (another instance booting, or two role saves at once) claimed the
      // name first — the row exists now, which is all we need.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const row = await store.permission.findUnique({
          where: { name: definition.name },
        });
        if (row) return row.id;
      }
      throw error;
    }
  }
}
