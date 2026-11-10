import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MailModule } from '../mail/mail.module';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    UsersModule,
    SubscriptionsModule,
    MailModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      // @nestjs/jwt types expiresIn as a template-literal duration string; env vars are
      // always plain strings, so a cast is unavoidable here.
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as `${number}d`,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordResetService, JwtStrategy],
})
export class AuthModule {}
