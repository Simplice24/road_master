import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CaslAbilityFactory,
  AppAbility,
} from '../src/casl/casl-ability.factory';
import { PermissionSyncService } from '../src/access/permission-sync.service';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { SubscriptionAccessService } from '../src/subscriptions/subscription-access.service';
import { ExamAttemptsService } from '../src/exam-attempts/exam-attempts.service';

/**
 * Real-database checks for what unit fakes can't prove: wallet purchase atomicity, and that
 * concurrent requests can't over-consume attempts or overlap queued time plans.
 * Requires DATABASE_URL to point at a migrated database whose name contains "test".
 */
describe('Subscriptions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let subscriptions: SubscriptionsService;
  let access: SubscriptionAccessService;
  let examAttempts: ExamAttemptsService;
  let abilities: CaslAbilityFactory;
  let clientRoleId: string;
  let examConfigId: string;
  let phoneSeq = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    subscriptions = app.get(SubscriptionsService);
    access = app.get(SubscriptionAccessService);
    examAttempts = app.get(ExamAttemptsService);
    abilities = app.get(CaslAbilityFactory);

    await prisma.examAttemptAnswerOption.deleteMany();
    await prisma.examAttemptAnswer.deleteMany();
    await prisma.examAttemptQuestion.deleteMany();
    await prisma.examAttempt.deleteMany();
    await prisma.userSubscription.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.defaultRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.option.deleteMany();
    await prisma.question.deleteMany();
    await prisma.category.deleteMany();
    await prisma.examConfig.deleteMany();

    const permissionIds = await app
      .get(PermissionSyncService)
      .resolveNames([
        'subscriptions.purchaseOwn',
        'subscriptions.viewOwn',
        'examAttempts.start',
        'examAttempts.viewOwn',
      ]);
    const clientRole = await prisma.role.create({
      data: {
        name: 'client',
        rolePermissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
    });
    clientRoleId = clientRole.id;

    const category = await prisma.category.create({ data: { name: 'Signs' } });
    await prisma.question.create({
      data: {
        categoryId: category.id,
        text: 'What does a red light mean?',
        options: {
          create: [
            { text: 'Stop', isCorrect: true, position: 0 },
            { text: 'Go', isCorrect: false, position: 1 },
          ],
        },
      },
    });
    const config = await prisma.examConfig.create({
      data: { name: 'One question', numberOfQuestions: 1, durationMinutes: 20 },
    });
    examConfigId = config.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createClient(walletBalance = 0, hasUsedFreeExam = true) {
    phoneSeq++;
    const user = await prisma.user.create({
      data: {
        fullName: `Client ${phoneSeq}`,
        phone: `07800000${String(phoneSeq).padStart(2, '0')}`,
        passwordHash: 'x',
        walletBalance,
        hasUsedFreeExam,
        userRoles: { create: { roleId: clientRoleId } },
      },
    });
    const ability: AppAbility = await abilities.createForUser(user);
    return { user, ability };
  }

  function createPlan(data: {
    price: number;
    accessType: 'ATTEMPTS' | 'TIME';
    attemptLimit?: number;
    durationDays?: number;
  }) {
    return prisma.subscriptionPlan.create({
      data: { name: { en: 'Test plan' }, ...data },
    });
  }

  describe('wallet purchase', () => {
    it('debits the price, records PLAN_PURCHASE and creates the subscription together', async () => {
      const plan = await createPlan({
        price: 500,
        accessType: 'ATTEMPTS',
        attemptLimit: 5,
      });
      const { user, ability } = await createClient(1200);

      const sub = await subscriptions.purchase(
        user.id,
        { planId: plan.id },
        ability,
      );

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(after.walletBalance.toNumber()).toBe(700);
      expect(sub).toMatchObject({
        status: 'ACTIVE',
        attemptsRemaining: 5,
        price: 500,
        source: 'PURCHASE',
      });
      const ledger = await prisma.transaction.findUniqueOrThrow({
        where: { id: sub.transactionId! },
      });
      expect(ledger).toMatchObject({
        type: 'PLAN_PURCHASE',
        status: 'SUCCESS',
        userId: user.id,
      });
      expect(ledger.amount.toNumber()).toBe(500);
    });

    it('rolls everything back with INSUFFICIENT_FUNDS when the wallet is short', async () => {
      const plan = await createPlan({
        price: 8000,
        accessType: 'TIME',
        durationDays: 30,
      });
      const { user, ability } = await createClient(7999);

      const error = await subscriptions
        .purchase(user.id, { planId: plan.id }, ability)
        .catch((e: BadRequestException) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'INSUFFICIENT_FUNDS',
      });
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(after.walletBalance.toNumber()).toBe(7999);
      expect(
        await prisma.userSubscription.count({ where: { userId: user.id } }),
      ).toBe(0);
      expect(
        await prisma.transaction.count({ where: { userId: user.id } }),
      ).toBe(0);
    });

    it('refuses inactive plans', async () => {
      const plan = await createPlan({
        price: 100,
        accessType: 'ATTEMPTS',
        attemptLimit: 1,
      });
      await prisma.subscriptionPlan.update({
        where: { id: plan.id },
        data: { isActive: false },
      });
      const { user, ability } = await createClient(1000);

      await expect(
        subscriptions.purchase(user.id, { planId: plan.id }, ability),
      ).rejects.toThrow(/no longer available/);
    });

    it('keeps the purchase snapshot when the plan is edited afterwards', async () => {
      const plan = await createPlan({
        price: 500,
        accessType: 'ATTEMPTS',
        attemptLimit: 5,
      });
      const { user, ability } = await createClient(500);
      const sub = await subscriptions.purchase(
        user.id,
        { planId: plan.id },
        ability,
      );

      await prisma.subscriptionPlan.update({
        where: { id: plan.id },
        data: { price: 900, attemptLimit: 10, name: { en: 'Renamed' } },
      });

      const row = await prisma.userSubscription.findUniqueOrThrow({
        where: { id: sub.id },
      });
      expect(row).toMatchObject({
        price: 500,
        attemptLimit: 5,
        attemptsRemaining: 5,
        planName: { en: 'Test plan' },
      });
    });

    it('does not let a client use the grant endpoint on themselves', async () => {
      const { user, ability } = await createClient();
      await expect(
        subscriptions.grant(
          user.id,
          {
            userId: user.id,
            accessType: 'ATTEMPTS',
            attemptLimit: 99,
            note: 'free',
          },
          ability,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('concurrency', () => {
    it('never over-consumes a bundle under concurrent exam starts (access check)', async () => {
      const { user } = await createClient();
      const bundle = await prisma.userSubscription.create({
        data: {
          userId: user.id,
          planName: {},
          price: 0,
          accessType: 'ATTEMPTS',
          attemptLimit: 3,
          attemptsRemaining: 3,
          startsAt: new Date(),
        },
      });

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          prisma.$transaction(async (tx) => {
            await access.lockUser(tx, user.id);
            return access.consumeForExamStart(tx, user.id);
          }),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(5);
      const row = await prisma.userSubscription.findUniqueOrThrow({
        where: { id: bundle.id },
      });
      expect(row).toMatchObject({ attemptsRemaining: 0, status: 'EXHAUSTED' });
    });

    it('lets exactly one of several concurrent real exam starts through on a 1-attempt bundle', async () => {
      const { user, ability } = await createClient();
      await prisma.userSubscription.create({
        data: {
          userId: user.id,
          planName: {},
          price: 0,
          accessType: 'ATTEMPTS',
          attemptLimit: 1,
          attemptsRemaining: 1,
          startsAt: new Date(),
        },
      });

      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          examAttempts.startAttempt(user.id, { examConfigId }, ability),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        await prisma.examAttempt.count({ where: { userId: user.id } }),
      ).toBe(1);
    });

    it('chains concurrent time-plan purchases back to back with no overlap', async () => {
      const plan = await createPlan({
        price: 100,
        accessType: 'TIME',
        durationDays: 7,
      });
      const { user, ability } = await createClient(1000);

      await Promise.all(
        Array.from({ length: 3 }, () =>
          subscriptions.purchase(user.id, { planId: plan.id }, ability),
        ),
      );

      const rows = await prisma.userSubscription.findMany({
        where: { userId: user.id },
        orderBy: { startsAt: 'asc' },
      });
      expect(rows).toHaveLength(3);
      expect(rows[1].startsAt).toEqual(rows[0].expiresAt);
      expect(rows[2].startsAt).toEqual(rows[1].expiresAt);
      const wallet = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(wallet.walletBalance.toNumber()).toBe(700);
    });
  });

  describe('exam start', () => {
    it('gives a new user their free first exam without consuming a subscription', async () => {
      const { user, ability } = await createClient(0, false);

      const attempt = await examAttempts.startAttempt(
        user.id,
        { examConfigId },
        ability,
      );

      expect(attempt).toMatchObject({ isFree: true, userSubscriptionId: null });
    });

    it('denies a user with no free exam and no plan with SUBSCRIPTION_REQUIRED', async () => {
      const { user, ability } = await createClient(5000);

      const error = await examAttempts
        .startAttempt(user.id, { examConfigId }, ability)
        .catch((e: ForbiddenException) => e);

      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_REQUIRED',
      });
      // The wallet is never charged for an exam any more.
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(after.walletBalance.toNumber()).toBe(5000);
    });

    it('returns options in their stored position order', async () => {
      const { user, ability } = await createClient(0, false);
      const attempt = await examAttempts.startAttempt(
        user.id,
        { examConfigId },
        ability,
      );
      expect(attempt.questions[0].question.options.map((o) => o.text)).toEqual([
        'Stop',
        'Go',
      ]);
    });
  });
});
