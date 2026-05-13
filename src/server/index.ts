import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allowedCorsOrigins, env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { storefrontRouter } from "./routes/storefront.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { startLaunchScheduler } from "./scheduler/launchScheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);

app.use(
  helmet({
    xFrameOptions: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["https://admin.shopify.com", "https://*.myshopify.com"],
        scriptSrc: ["'self'", "https://cdn.shopify.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://*.myshopify.com", "https://*.shopify.com", "https://admin.shopify.com"],
        objectSrc: ["'none'"]
      }
    }
  })
);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    }
  })
);

app.use(compression());
app.use("/webhooks", express.raw({ type: "*/*", limit: "100kb" }), webhooksRouter);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(
  pinoHttp({
    logger,
    genReqId(req, res) {
      const existing = req.headers["x-request-id"];
      const requestId = typeof existing === "string" ? existing : crypto.randomUUID();
      res.setHeader("x-request-id", requestId);
      return requestId;
    }
  })
);

app.use(healthRouter);
app.use(authRouter);
app.use(storefrontRouter);
app.use(express.static(path.resolve(__dirname, "web"), { index: false }));
app.use(adminRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "request failed");
  if (typeof err === "object" && err && "name" in err && err.name === "ZodError") {
    res.status(400).json({ error: "Invalid request", details: "issues" in err ? err.issues : undefined });
    return;
  }

  const statusCode = typeof err === "object" && err && "statusCode" in err && typeof err.statusCode === "number" ? err.statusCode : 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err instanceof Error ? err.message : "Request failed",
    code: typeof err === "object" && err && "code" in err ? err.code : undefined,
    upgradeRequired: typeof err === "object" && err && "upgradeRequired" in err ? err.upgradeRequired : undefined,
    requiredPlan: typeof err === "object" && err && "requiredPlan" in err ? err.requiredPlan : undefined
  });
});

const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info({ appUrl: env.APP_URL, port: env.PORT, environment: env.NODE_ENV }, "LaunchGuard server listening");
  startLaunchScheduler();
});

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, "shutdown requested");
  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, "server shutdown failed");
      process.exit(1);
    }
    await prisma.$disconnect();
    logger.info("shutdown complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
