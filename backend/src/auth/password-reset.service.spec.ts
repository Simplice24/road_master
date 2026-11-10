import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PasswordResetService } from './password-reset.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MailMessage, MailService } from '../mail/mail.service';

const USER = {
  id: 'user-1',
  fullName: 'Jean Uwimana',
  email: 'jean@gmail.com',
  isActive: true,
};

/** Minimal Prisma fake; `$transaction` runs callbacks against the same delegates and resolves
 * arrays of already-started promises, like the real client. */
function setup(
  opts: {
    user?: typeof USER | null;
    latestTokenAt?: Date | null;
    claimCount?: number;
    tokenUserActive?: boolean;
  } = {},
) {
  const delegates = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.user === undefined ? USER : opts.user),
      update: jest.fn(),
    },
    passwordResetToken: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opts.latestTokenAt ? { createdAt: opts.latestTokenAt } : null,
        ),
      findUnique: jest.fn().mockResolvedValue({
        userId: USER.id,
        user: { isActive: opts.tokenUserActive ?? true },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma = {
    ...delegates,
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof delegates) => Promise<unknown>)(delegates)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  const sent: MailMessage[] = [];
  const mail = {
    send: jest.fn((message: MailMessage) => {
      sent.push(message);
      return Promise.resolve();
    }),
  };
  const service = new PasswordResetService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
  );
  return { service, delegates, sent };
}

/** requestReset runs in the background — let its promise chain settle. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('PasswordResetService.requestReset', () => {
  it('stores only the token hash and emails a localized link with the raw token', async () => {
    const { service, delegates, sent } = setup();
    service.requestReset('  jean@gmail.com ', 'fr');
    await flush();

    expect(delegates.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'jean@gmail.com' } }),
    );
    expect(sent).toHaveLength(1);
    const token = /reset-password\?token=([0-9a-f]{64})/.exec(sent[0].text)![1];
    expect(sent[0].text).toContain(`/fr/reset-password?token=${token}`);
    expect(sent[0].subject).toMatch(/Réinitialisez/);
    const created = (
      delegates.passwordResetToken.create.mock.calls as unknown[][]
    )[0][0] as {
      data: { tokenHash: string };
    };
    expect(created.data.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
  });

  it.each([
    ['no account has the email', null],
    ['the account is deactivated', { ...USER, isActive: false }],
  ])('sends nothing when %s', async (_, user) => {
    const { service, delegates, sent } = setup({ user });
    service.requestReset('jean@gmail.com');
    await flush();
    expect(sent).toHaveLength(0);
    expect(delegates.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('enforces a cooldown between emails to the same account', async () => {
    const { service, sent } = setup({ latestTokenAt: new Date() });
    service.requestReset('jean@gmail.com');
    await flush();
    expect(sent).toHaveLength(0);
  });
});

describe('PasswordResetService.resetPassword', () => {
  const token = 'a'.repeat(64);

  it('sets the new password hash and passwordChangedAt', async () => {
    const { service, delegates } = setup();
    await service.resetPassword(token, 'new-password');

    const update = (delegates.user.update.mock.calls as unknown[][])[0][0] as {
      where: { id: string };
      data: { passwordHash: string; passwordChangedAt: Date };
    };
    expect(update.where).toEqual({ id: USER.id });
    expect(update.data.passwordChangedAt).toBeInstanceOf(Date);
    await expect(
      bcrypt.compare('new-password', update.data.passwordHash),
    ).resolves.toBe(true);
  });

  it.each([
    ['the token is unknown, used or expired', { claimCount: 0 }],
    ['the account is deactivated', { tokenUserActive: false }],
  ])('rejects when %s', async (_, opts) => {
    const { service, delegates } = setup(opts);
    await expect(service.resetPassword(token, 'new-password')).rejects.toThrow(
      BadRequestException,
    );
    expect(delegates.user.update).not.toHaveBeenCalled();
  });
});
