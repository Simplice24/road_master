import type { MailMessage } from '../mail/mail.service';

// Mirrors the frontend's next-intl locales (frontend/src/i18n/routing.ts).
export const RESET_EMAIL_LOCALES = ['en', 'rw', 'fr'] as const;
export type ResetEmailLocale = (typeof RESET_EMAIL_LOCALES)[number];

const COPY: Record<
  ResetEmailLocale,
  {
    subject: string;
    greeting: (name: string) => string;
    body: (minutes: number) => string;
    cta: string;
    ignore: string;
  }
> = {
  en: {
    subject: 'Reset your Road Master password',
    greeting: (name) => `Hello ${name},`,
    body: (minutes) =>
      `We received a request to reset your Road Master password. Use the link below to choose a new one. It expires in ${minutes} minutes and can only be used once.`,
    cta: 'Reset password',
    ignore:
      "If you didn't request this, you can ignore this email — your password won't change.",
  },
  rw: {
    subject: "Hindura ijambo ry'ibanga rya Road Master",
    greeting: (name) => `Muraho ${name},`,
    body: (minutes) =>
      `Twakiriye icyifuzo cyo guhindura ijambo ry'ibanga rya konti yawe ya Road Master. Kanda ku murongo uri hasi uhitemo irindi rishya. Uyu murongo uzarangira mu minota ${minutes} kandi ukoreshwa rimwe gusa.`,
    cta: "Hindura ijambo ry'ibanga",
    ignore:
      "Niba atari wowe wabisabye, wirengagize iyi imeri — ijambo ry'ibanga ryawe ntirizahinduka.",
  },
  fr: {
    subject: 'Réinitialisez votre mot de passe Road Master',
    greeting: (name) => `Bonjour ${name},`,
    body: (minutes) =>
      `Nous avons reçu une demande de réinitialisation de votre mot de passe Road Master. Utilisez le lien ci-dessous pour en choisir un nouveau. Il expire dans ${minutes} minutes et ne peut être utilisé qu'une seule fois.`,
    cta: 'Réinitialiser le mot de passe',
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe ne changera pas.",
  },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPasswordResetEmail(input: {
  to: string;
  fullName: string;
  link: string;
  expiresInMinutes: number;
  locale: ResetEmailLocale;
}): MailMessage {
  const copy = COPY[input.locale];
  const greeting = copy.greeting(input.fullName);
  const body = copy.body(input.expiresInMinutes);
  const link = escapeHtml(input.link);

  return {
    to: input.to,
    subject: copy.subject,
    text: `${greeting}\n\n${body}\n\n${input.link}\n\n${copy.ignore}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111;max-width:480px">
  <p>${escapeHtml(greeting)}</p>
  <p>${escapeHtml(body)}</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(copy.cta)}</a></p>
  <p style="color:#555;font-size:12px;word-break:break-all">${link}</p>
  <p style="color:#555">${escapeHtml(copy.ignore)}</p>
</div>`,
  };
}
