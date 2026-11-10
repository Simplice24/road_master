import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';

const USER_ID = 'user-1';
const CURRENT = 'current-pass-123';

async function setup(opts: { casCount?: number } = {}) {
  const passwordHash = await bcrypt.hash(CURRENT, 4);
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ passwordHash }),
      updateMany: jest.fn().mockResolvedValue({ count: opts.casCount ?? 1 }),
    },
    passwordResetToken: { deleteMany: jest.fn() },
  };
  const jwt = { sign: jest.fn().mockReturnValue('fresh-token') };
  const service = new AuthService(
    {} as UsersService,
    jwt as unknown as JwtService,
    prisma as unknown as PrismaService,
  );
  return { service, prisma, jwt, passwordHash };
}

describe('AuthService.changePassword', () => {
  it('stores a new hash via CAS on the old one, retires reset links and returns a fresh token', async () => {
    const { service, prisma, jwt, passwordHash } = await setup();

    const result = await service.changePassword(USER_ID, {
      currentPassword: CURRENT,
      newPassword: 'brand-new-pass',
    });

    expect(result).toEqual({ accessToken: 'fresh-token' });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: USER_ID });
    const [[call]] = prisma.user.updateMany.mock.calls as [
      [
        {
          where: unknown;
          data: { passwordHash: string; passwordChangedAt: Date };
        },
      ],
    ];
    expect(call.where).toEqual({ id: USER_ID, passwordHash });
    expect(await bcrypt.compare('brand-new-pass', call.data.passwordHash)).toBe(
      true,
    );
    expect(call.data.passwordChangedAt).toBeInstanceOf(Date);
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, usedAt: null },
    });
  });

  it('rejects a wrong current password without writing', async () => {
    const { service, prisma } = await setup();
    await expect(
      service.changePassword(USER_ID, {
        currentPassword: 'wrong-password',
        newPassword: 'brand-new-pass',
      }),
    ).rejects.toThrow(new BadRequestException('Current password is incorrect'));
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    const { service, prisma } = await setup();
    await expect(
      service.changePassword(USER_ID, {
        currentPassword: CURRENT,
        newPassword: CURRENT,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('fails if the password changed concurrently (CAS miss)', async () => {
    const { service, prisma, jwt } = await setup({ casCount: 0 });
    await expect(
      service.changePassword(USER_ID, {
        currentPassword: CURRENT,
        newPassword: 'brand-new-pass',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
