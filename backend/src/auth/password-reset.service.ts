import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  buildPasswordResetEmail,
  type ResetEmailLocale,
} from './password-reset.email';

const TOKEN_TTL_MINUTES = 30;
/** Minimum gap between two reset emails to the same account, so the endpoint can't be used to
 * flood someone's inbox. */
const RESEND_COOLDOWN_MS = 60_000;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Always resolves immediately with no hint of whether the email matched an account — the
   * lookup, token issue and send run in the background so neither the response body nor its
   * timing can be used to enumerate registered emails.
   */
  requestReset(email: string, locale: ResetEmailLocale = 'en') {
    void this.issueAndSend(email.trim(), locale).catch((err: unknown) =>
      this.logger.error(
        'Failed to issue/send password reset email',
        err instanceof Error ? err.stack : String(err),
      ),
    );
  }

  private async issueAndSend(email: string, locale: ResetEmailLocale) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true, email: true, isActive: true },
    });
    if (!user?.email || !user.isActive) return;

    const latest = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    // Only the newest link works: issuing one retires every earlier unused token.
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
        },
      }),
    ]);

    const frontendUrl = (
      process.env.FRONTEND_URL?.trim() || 'http://localhost:3001'
    ).replace(/\/+$/, '');
    await this.mail.send(
      buildPasswordResetEmail({
        to: user.email,
        fullName: user.fullName,
        link: `${frontendUrl}/${locale}/reset-password?token=${token}`,
        expiresInMinutes: TOKEN_TTL_MINUTES,
        locale,
      }),
    );
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = hashToken(token);
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Compare-and-swap claim: under concurrent submits of the same link only one request
      // matches `usedAt: null`, so a token can never reset the password twice.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      const row =
        claimed.count === 1
          ? await tx.passwordResetToken.findUnique({
              where: { tokenHash },
              select: { userId: true, user: { select: { isActive: true } } },
            })
          : null;
      if (!row || !row.user.isActive) {
        throw new BadRequestException(
          'This reset link is invalid or has expired',
        );
      }

      // passwordChangedAt also invalidates every JWT issued before now (see JwtStrategy).
      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash, passwordChangedAt: now },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: row.userId, usedAt: null },
      });
    });
  }
}
