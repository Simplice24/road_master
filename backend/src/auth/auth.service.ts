import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    return this.buildTokenResponse(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findCredentialsByLogin(dto.identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Only revealed after a correct password, so it can't be used to probe which phone
    // numbers/emails have (deactivated) accounts.
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    return this.buildTokenResponse(user.id);
  }

  /**
   * Changes the caller's own password after re-checking the current one. Like a reset, it sets
   * `passwordChangedAt`, so every other session is logged out; the caller gets a fresh token
   * (issued after the change, so `JwtStrategy` accepts it) to stay signed in here.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    // 400 rather than 401: the session is valid, only the submitted field is wrong — and a 401
    // would read as "signed out" to the client.
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const now = new Date();
    // Compare-and-swap on the hash we just verified against: if a concurrent change (or reset)
    // got in first, the old password no longer applies and this one must not overwrite it.
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, passwordHash: user.passwordHash },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        passwordChangedAt: now,
      },
    });
    if (updated.count !== 1) {
      throw new BadRequestException('Current password is incorrect');
    }
    // A reset link emailed earlier would otherwise still let someone set a different password.
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    });

    return this.buildTokenResponse(userId);
  }

  private buildTokenResponse(userId: string) {
    return { accessToken: this.jwtService.sign({ sub: userId }) };
  }
}
