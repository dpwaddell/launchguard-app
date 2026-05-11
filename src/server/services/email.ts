import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function emailProviderStatus() {
  if (env.RESEND_API_KEY) return { configured: true, provider: "resend", label: "Resend" };
  if (env.SMTP_HOST) return { configured: true, provider: "smtp", label: "SMTP" };
  return { configured: false, provider: null, label: null };
}

export async function sendEmail(payload: EmailPayload) {
  const provider = emailProviderStatus();
  if (!provider.configured) {
    logger.info({ to: payload.to, subject: payload.subject }, "email skipped — no provider configured");
    return;
  }

  if (provider.provider === "resend") {
    await sendViaResend(payload);
  } else {
    await sendViaSMTP(payload);
  }
}

async function sendViaResend(payload: EmailPayload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "LaunchGuard <no-reply@sample-guard.com>",
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    logger.warn({ status: response.status, body }, "resend email failed");
    throw new Error("Email send failed");
  }

  logger.info({ to: payload.to, subject: payload.subject }, "email sent via resend");
}

async function sendViaSMTP(payload: EmailPayload) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined
  });

  await transporter.sendMail({
    from: "LaunchGuard <no-reply@sample-guard.com>",
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });

  logger.info({ to: payload.to, subject: payload.subject }, "email sent via smtp");
}

export async function notifyOwner(subject: string, text: string) {
  if (!env.OWNER_NOTIFICATION_EMAIL) return;
  try {
    await sendEmail({ to: env.OWNER_NOTIFICATION_EMAIL, subject, text });
  } catch (error) {
    logger.warn({ err: error }, "owner notification email failed");
  }
}
