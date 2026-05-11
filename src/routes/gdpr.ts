import { Router } from "express";

export const gdprRouter = Router();

gdprRouter.post("/customers/data_request", async (_req, res) => {
  return res.status(200).send("ok");
});

gdprRouter.post("/customers/redact", async (_req, res) => {
  return res.status(200).send("ok");
});

gdprRouter.post("/shop/redact", async (_req, res) => {
  return res.status(200).send("ok");
});
