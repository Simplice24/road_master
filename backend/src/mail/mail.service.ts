import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Outbound email over SMTP (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM). With no
 * SMTP_HOST configured — local dev — messages are written to the log instead of sent, so flows
 * like password reset can be exercised without a mail server.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT ?? 587);
    this.from =
      process.env.SMTP_FROM?.trim() || 'Road Master <no-reply@localhost>';
    this.transporter = host
      ? createTransport({
          host,
          port,
          // 465 is implicit TLS; everything else upgrades via STARTTLS.
          secure: port === 465,
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        })
      : null;
    if (!this.transporter) {
      this.logger.warn(
        'SMTP_HOST is not set — emails will be logged instead of sent',
      );
    }
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[email not sent] to=${message.to} subject="${message.subject}"\n${message.text}`,
      );
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
