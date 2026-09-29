import { BadRequestException, Logger } from '@nestjs/common';
import {
  PermissionSyncService,
  PermissionStore,
} from './permission-sync.service';
import { PERMISSION_DEFINITIONS } from './access.config';
import { FakePermissionStore } from './testing/fake-permission-store';
import type { PrismaService } from '../prisma/prisma.service';

describe('PermissionSyncService', () => {
  let store: FakePermissionStore;
  let service: PermissionSyncService;
  let warn: jest.SpyInstance;

  const asStore = () => store as unknown as PermissionStore;

  beforeEach(() => {
    store = new FakePermissionStore();
    service = new PermissionSyncService(store as unknown as PrismaService);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it('creates a row for every configured permission on an empty database', async () => {
    await service.syncAll(asStore());

    expect(store.rows.map((row) => row.name).sort()).toEqual(
      PERMISSION_DEFINITIONS.map((d) => d.name).sort(),
    );
    const topUp = store.rows.find(
      (row) => row.name === 'transactions.topUpOwn',
    )!;
    expect(topUp).toMatchObject({
      action: 'create',
      subject: 'Transaction',
      conditions: { userId: '${user.id}' },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('is idempotent — a second sync writes nothing', async () => {
    await service.syncAll(asStore());
    const writesAfterFirst = store.writes;
    const idsAfterFirst = store.rows.map((row) => row.id);

    await service.syncAll(asStore());

    expect(store.writes).toBe(writesAfterFirst);
    expect(store.rows.map((row) => row.id)).toEqual(idsAfterFirst);
  });

  it('adopts a pre-config seeded row (same action, subject and conditions) instead of duplicating it, keeping its id', async () => {
    // Key order differs from the config on purpose — matching must be deep-equal, not textual.
    const legacy = store.seed({
      action: 'read',
      subject: 'ExamAttempt',
      conditions: { userId: '${user.id}' },
    });
    const legacyUnscoped = store.seed({ action: 'read', subject: 'Category' });

    await service.syncAll(asStore());

    expect(store.rows.find((row) => row.id === legacy.id)?.name).toBe(
      'examAttempts.viewOwn',
    );
    expect(store.rows.find((row) => row.id === legacyUnscoped.id)?.name).toBe(
      'categories.view',
    );
    expect(store.rows).toHaveLength(PERMISSION_DEFINITIONS.length);
  });

  it('does not adopt a row whose conditions differ, and warns about it without deleting it', async () => {
    const custom = store.seed({
      action: 'read',
      subject: 'ExamAttempt',
      conditions: { userId: '${user.id}', status: 'COMPLETED' },
    });

    await service.syncAll(asStore());

    expect(store.rows.find((row) => row.id === custom.id)).toMatchObject({
      name: null,
    });
    expect(store.rows).toHaveLength(PERMISSION_DEFINITIONS.length + 1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('1 permission row(s)'),
    );
  });

  it('warns about (but keeps) a named row that was removed from the config', async () => {
    store.seed({
      name: 'reports.export',
      action: 'read',
      subject: 'Transaction',
    });

    await service.syncAll(asStore());

    expect(store.rows.some((row) => row.name === 'reports.export')).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('reports.export'),
    );
  });

  describe('resolveNames', () => {
    it('rejects unknown permissions with a 400 that lists every one, before writing anything', async () => {
      const attempt = service.resolveNames(
        ['categories.view', 'categories.nuke', 'users.impersonate'],
        asStore(),
      );

      await expect(attempt).rejects.toThrow(BadRequestException);
      await expect(attempt).rejects.toThrow(
        /categories\.nuke, users\.impersonate/,
      );
      expect(store.writes).toBe(0);
    });

    it('creates missing permissions on demand and returns their ids', async () => {
      const ids = await service.resolveNames(
        ['roles.assign', 'categories.create', 'roles.assign'],
        asStore(),
      );

      expect(ids).toHaveLength(2);
      expect(
        ids.map((id) => store.rows.find((row) => row.id === id)?.name),
      ).toEqual(['roles.assign', 'categories.create']);
    });

    it('reuses the existing row when a concurrent writer created the name first', async () => {
      const original = store.permission.findUnique;
      let raced = false;
      // First lookup misses (as if another request hadn't committed yet), then the create
      // hits the unique index because the other request's row now exists.
      store.permission.findUnique = (args) => {
        if (!raced && args.where.name === 'categories.delete') {
          raced = true;
          store.seed({
            name: 'categories.delete',
            action: 'delete',
            subject: 'Category',
          });
          return Promise.resolve(null);
        }
        return original(args);
      };

      const [id] = await service.resolveNames(['categories.delete'], asStore());

      expect(
        store.rows.filter((row) => row.name === 'categories.delete'),
      ).toHaveLength(1);
      expect(store.rows.find((row) => row.id === id)?.name).toBe(
        'categories.delete',
      );
    });
  });
});
