import "dotenv/config";
import { z } from "zod";

const rawEnv = {
  ...process.env,
  APP_URL: process.env.APP_URL ?? process.env.SHOPIFY_APP_URL,
  SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ?? process.env.APP_URL
};

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),
  SHOPIFY_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_SCOPES: z.string().min(1),
  SHOPIFY_APP_HANDLE: z.string().default("launchguard"),
  SESSION_COOKIE_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  OWNER_NOTIFICATION_EMAIL: z.string().optional(),
  CORS_ORIGINS: z.string().default("https://launchguard.sample-guard.com"),
  TRUST_PROXY: z.coerce.number().default(1)
}).superRefine((env, ctx) => {
  if (env.APP_URL !== env.SHOPIFY_APP_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SHOPIFY_APP_URL"],
      message: "SHOPIFY_APP_URL must match APP_URL"
    });
  }

  if (env.NODE_ENV === "production") {
    const hostname = new URL(env.APP_URL).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_URL"],
        message: "APP_URL must not use localhost in production"
      });
    }
  }
});

export const env = envSchema.parse(rawEnv);

export const allowedCorsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
