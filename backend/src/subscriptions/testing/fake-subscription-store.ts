/**
 * In-memory stand-in for the slice of Prisma that SubscriptionAccessService uses, so the access
 * rules can be unit-tested without a database. Supports only the filter/order shapes that
 * service actually issues. Concurrency is covered separately by the e2e suite.
 */
export interface FakeSubscription {
  id: string;
  userId: string;
  planId: string | null;
  planName: unknown;
  price: number;
  currency: string;
  accessType: 'ATTEMPTS' | 'TIME';
  attemptLimit: number | null;
  durationDays: number | null;
  attemptsRemaining: number | null;
  status: string;
  source: string;
  startsAt: Date;
  expiresAt: Date | null;
  transactionId?: string;
  grantedById?: string;
  note?: string;
  createdAt: Date;
}

type Where = Record<string, unknown>;

function matchesField(value: unknown, filter: unknown): boolean {
  if (filter === null || typeof filter !== 'object' || filter instanceof Date) {
    return value instanceof Date && filter instanceof Date
      ? value.getTime() === filter.getTime()
      : value === filter;
  }
  const f = filter as Record<string, unknown>;
  const cmp = (a: unknown) => (a instanceof Date ? a.getTime() : (a as number));
  if ('gt' in f && !(value !== null && cmp(value) > cmp(f.gt))) return false;
  if ('gte' in f && !(value !== null && cmp(value) >= cmp(f.gte))) return false;
  if ('lte' in f && !(value !== null && cmp(value) <= cmp(f.lte))) return false;
  if ('notIn' in f && (f.notIn as unknown[]).includes(value)) return false;
  if ('not' in f && value === f.not) return false;
  return true;
}

function matches(row: FakeSubscription, where: Where): boolean {
  return Object.entries(where).every(([key, filter]) =>
    matchesField((row as unknown as Record<string, unknown>)[key], filter),
  );
}

function sortRows(
  rows: FakeSubscription[],
  orderBy: unknown,
): FakeSubscription[] {
  const keys = (
    Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []
  ) as Record<string, 'asc' | 'desc'>[];
  return [...rows].sort((a, b) => {
    for (const key of keys) {
      const [field, dir] = Object.entries(key)[0];
      const av = (a as unknown as Record<string, unknown>)[field];
      const bv = (b as unknown as Record<string, unknown>)[field];
      const an = av instanceof Date ? av.getTime() : (av as number | string);
      const bn = bv instanceof Date ? bv.getTime() : (bv as number | string);
      if (an < bn) return dir === 'asc' ? -1 : 1;
      if (an > bn) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

export class FakeSubscriptionStore {
  rows: FakeSubscription[] = [];
  hasUsedFreeExam = true;
  private seq = 0;

  add(
    row: Partial<FakeSubscription> & Pick<FakeSubscription, 'accessType'>,
  ): FakeSubscription {
    this.seq++;
    const full: FakeSubscription = {
      id: `sub-${String(this.seq).padStart(3, '0')}`,
      userId: 'user-1',
      planId: null,
      planName: {},
      price: 0,
      currency: 'RWF',
      attemptLimit: null,
      durationDays: null,
      attemptsRemaining: null,
      status: 'ACTIVE',
      source: 'PURCHASE',
      startsAt: new Date(0),
      expiresAt: null,
      createdAt: new Date(this.seq * 1000),
      ...row,
    };
    this.rows.push(full);
    return full;
  }

  get(id: string) {
    return this.rows.find((row) => row.id === id)!;
  }

  readonly userSubscription = {
    findFirst: jest.fn(
      ({ where, orderBy }: { where: Where; orderBy?: unknown }) =>
        Promise.resolve(
          sortRows(
            this.rows.filter((r) => matches(r, where)),
            orderBy,
          )[0] ?? null,
        ),
    ),
    findMany: jest.fn(
      ({ where, orderBy }: { where: Where; orderBy?: unknown }) =>
        Promise.resolve(
          sortRows(
            this.rows.filter((r) => matches(r, where)),
            orderBy,
          ),
        ),
    ),
    updateMany: jest.fn(
      ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const hit = this.rows.filter((r) => matches(r, where));
        for (const row of hit) {
          for (const [key, value] of Object.entries(data)) {
            const record = row as unknown as Record<string, unknown>;
            if (value && typeof value === 'object' && 'decrement' in value) {
              record[key] =
                (record[key] as number) -
                (value as { decrement: number }).decrement;
            } else {
              record[key] = value;
            }
          }
        }
        return Promise.resolve({ count: hit.length });
      },
    ),
    create: jest.fn(
      ({
        data,
      }: {
        data: Partial<FakeSubscription> & Pick<FakeSubscription, 'accessType'>;
      }) => Promise.resolve(this.add(data)),
    ),
  };

  readonly user = {
    findUnique: jest.fn(() =>
      Promise.resolve({ hasUsedFreeExam: this.hasUsedFreeExam }),
    ),
  };

  readonly $queryRaw = jest.fn(() => Promise.resolve([]));
}
