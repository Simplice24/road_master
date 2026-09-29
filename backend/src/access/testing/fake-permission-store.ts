import { Prisma } from '../../../generated/prisma/client';

export interface FakePermissionRow {
  id: string;
  name: string | null;
  action: string;
  subject: string;
  conditions: Prisma.JsonValue | null;
  fields: Prisma.JsonValue | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory stand-in for the `permission` delegate — just the calls PermissionSyncService
 * makes — so sync behaviour can be unit tested without a database. Enforces the unique
 * `name` index like MySQL would.
 */
export class FakePermissionStore {
  rows: FakePermissionRow[] = [];
  private nextId = 1;
  writes = 0;

  seed(
    row: Partial<FakePermissionRow> &
      Pick<FakePermissionRow, 'action' | 'subject'>,
  ) {
    const full: FakePermissionRow = {
      id: `seeded-${this.nextId++}`,
      name: null,
      conditions: null,
      fields: null,
      description: null,
      createdAt: new Date(2026, 0, this.nextId),
      updatedAt: new Date(),
      ...row,
    };
    this.rows.push(full);
    return full;
  }

  // Delegate methods return promises (like Prisma's) and surface constraint violations as
  // rejections, never synchronous throws.
  permission = {
    findUnique: ({ where }: { where: { name?: string; id?: string } }) =>
      Promise.resolve(
        this.rows.find((row) =>
          where.name !== undefined
            ? row.name === where.name
            : row.id === where.id,
        ) ?? null,
      ),

    findMany: (args?: {
      where?: { action?: string; subject?: string; name?: null };
    }) => {
      const where = args?.where ?? {};
      return Promise.resolve(
        this.rows.filter(
          (row) =>
            (where.action === undefined || row.action === where.action) &&
            (where.subject === undefined || row.subject === where.subject) &&
            (!('name' in where) || row.name === where.name),
        ),
      );
    },

    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: { name: string };
    }) =>
      Promise.resolve().then(() => {
        this.assertNameFree(data.name);
        const row = this.rows.find((candidate) => candidate.id === where.id)!;
        row.name = data.name;
        this.writes++;
        return row;
      }),

    create: ({
      data,
    }: {
      data: {
        name: string;
        action: string;
        subject: string;
        conditions?: Prisma.JsonValue;
        description?: string;
      };
    }) =>
      Promise.resolve().then(() => {
        this.assertNameFree(data.name);
        const row = this.seed({
          ...data,
          id: `created-${this.nextId}`,
          conditions: data.conditions ?? null,
          description: data.description ?? null,
        });
        this.writes++;
        return row;
      }),
  };

  private assertNameFree(name: string) {
    if (this.rows.some((row) => row.name === name)) {
      throw new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );
    }
  }
}
