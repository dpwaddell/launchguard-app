import { Router } from "express";

export const legalRouter = Router();

legalRouter.get("/privacy", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>LaunchGuard Privacy Policy</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6;color:#17212f;max-width:860px;margin:0 auto;padding:48px 24px;background:#f6f8f8}
    main{background:#fff;border:1px solid #dfe5e7;border-radius:18px;padding:34px;box-shadow:0 10px 30px rgba(6,26,46,.06)}
    h1{margin-top:0;color:#061a2e} h2{margin-top:28px;color:#061a2e} a{color:#067d94}
  </style>
</head>
<body>
<main>
  <h1>LaunchGuard Privacy Policy</h1>
  <p><strong>Last updated:</strong> 13 May 2026</p>

  <p>LaunchGuard is a Shopify app that helps merchants schedule product launches, control storefront availability, show countdown messaging, manage VIP access, and apply launch controls.</p>

  <h2>Information we access</h2>
  <p>When a merchant installs LaunchGuard, we may access store information needed to operate the app, including the shop domain, merchant contact details, product information selected for launch campaigns, campaign settings, customer tags used for VIP access rules, and app usage or audit events.</p>

  <h2>Information we store</h2>
  <p>We store the minimum information required to provide the app, including store details, launch campaign configuration, selected product identifiers, launch timing, storefront messaging, access rules, purchase limit settings, support requests, and audit logs.</p>

  <h2>Customer data</h2>
  <p>LaunchGuard does not sell customer data. Customer tags may be used to determine VIP access where a merchant configures that feature. The app does not use customer data for advertising or unrelated profiling.</p>

  <h2>How we use information</h2>
  <p>We use information to provide LaunchGuard functionality, authenticate the merchant’s store, display launch controls, operate storefront launch messaging, provide support, maintain security, and comply with Shopify platform requirements.</p>

  <h2>Sharing information</h2>
  <p>We do not sell personal information. We may share limited information with service providers that help us operate the app, such as hosting, logging, database, email, and infrastructure providers, only where needed to provide the service.</p>

  <h2>Data retention</h2>
  <p>We retain app data while LaunchGuard is installed and for a reasonable period afterwards for operational, support, compliance, and security purposes. Merchants may request deletion of app data by contacting us.</p>

  <h2>Security</h2>
  <p>We use reasonable technical and organisational measures to protect app data, including HTTPS, Shopify authentication, webhook verification, and access controls.</p>

  <h2>Contact</h2>
  <p>For privacy questions or data requests, contact: <a href="mailto:contact@danwaddell.co.uk">contact@danwaddell.co.uk</a></p>
</main>
</body>
</html>`);
});
