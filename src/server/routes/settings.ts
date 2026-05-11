import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const settingsRouter = Router();

const settingsSchema = z.object({
  brandingEnabled: z.boolean().optional(),
  defaultTimezone: z.string().optional()
});

settingsRouter.put("/settings", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings" });
    return;
  }

  const shopId = req.adminAuth!.shopId;
  const settings = await prisma.shopSettings.upsert({
    where: { shopId },
    create: { shopId, ...parsed.data },
    update: parsed.data
  });

  res.json(settings);
});
