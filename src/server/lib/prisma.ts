import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "warn" },
    { emit: "event", level: "error" }
  ]
});

prisma.$on("warn", (e) => logger.warn({ msg: e.message }, "prisma warning"));
prisma.$on("error", (e) => logger.error({ msg: e.message }, "prisma error"));
