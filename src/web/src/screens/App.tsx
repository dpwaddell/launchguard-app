import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  EmptyState,
  FormLayout,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Select,
  Tabs,
  Text,
  TextField,
  Toast
} from "@shopify/polaris";
import launchGuardLogo from "../assets/launchguard-logo.svg";
import { adminFetch } from "../lib/adminFetch";

const tabs = [
  { id: "dashboard", content: "Control centre" },
  { id: "campaigns", content: "Campaigns" },
  { id: "new-campaign", content: "Create launch" },
  { id: "plans", content: "Plans" },
  { id: "settings", content: "Settings" },
  { id: "support", content: "Support" },
  { id: "activity", content: "Audit trail" }
];

type Campaign = {
  id: string;
  name: string;
  status: string;
  isEnabled: boolean;
  timezone: string;
  publicLaunchAt: string;
  vipAccessStartsAt: string | null;
  endsAt: string | null;
  seoSuppressionEnabled: boolean;
  countdownTitle: string;
  countdownBody: string;
  lockedMessage: string;
  vipMessage: string;
  brandingEnabled: boolean;
  schedulerError: string | null;
  products: Array<{ id: string; shopifyProductId: string; shopifyProductHandle: string; shopifyProductTitle: string }>;
  accessRules: Array<{ id: string; customerTag: string }>;
  purchaseLimits: Array<{ id: string; limitType: string; maxQuantity: number; enabled: boolean; validationMessage: string }>;
};

type PlanEntitlements = {
  activeLaunchLimit: number | null;
  productsPerLaunch: number | null;
  vipAccess: boolean;
  purchaseLimits: boolean;
  seoSuppression: boolean;
  hiddenProductControls: boolean;
  brandingEnabled: boolean;
};

type Plan = {
  key: string;
  name: string;
  price: number;
  interval: string;
  badge?: string;
  description: string;
  features: string[];
  entitlements: PlanEntitlements;
  current?: boolean;
};

const timezoneOptions = [
  { label: "Europe/London", value: "Europe/London" },
  { label: "UTC", value: "UTC" },
  { label: "America/New_York", value: "America/New_York" },
  { label: "America/Chicago", value: "America/Chicago" },
  { label: "America/Denver", value: "America/Denver" },
  { label: "America/Los_Angeles", value: "America/Los_Angeles" },
  { label: "Europe/Paris", value: "Europe/Paris" },
  { label: "Europe/Berlin", value: "Europe/Berlin" },
  { label: "Asia/Dubai", value: "Asia/Dubai" },
  { label: "Australia/Sydney", value: "Australia/Sydney" }
];

type Bootstrap = {
  shop: null | {
    domain: string;
    planName: string;
    plan: Plan;
    plans: Plan[];
    entitlements: PlanEntitlements;
    settings: { brandingEnabled: boolean; defaultTimezone: string } | null;
    campaigns: Campaign[];
    auditLogs: Array<{ id: string; action: string; severity: string; message: string; createdAt: string; campaignId: string | null }>;
    dashboard: {
      totalCampaigns: number;
      activeCampaigns: number;
      liveCampaigns: number;
      nextScheduledLaunch: { id: string; name: string; publicLaunchAt: string } | null;
    };
    diagnostics: {
      emailProvider: { configured: boolean; provider: string | null; label: string | null };
      appUrl: string;
      appVersion: string;
      billing: {
        currentPlan: string;
        status: string;
        planName: string;
        manageUrl: string | null;
        test: boolean;
        refreshFailed?: boolean;
      };
    };
  };
};

const defaultPlans: Plan[] = [
  { key: "FREE", name: "Free", price: 0, interval: "month", description: "Test a launch with one product.", features: [], entitlements: { activeLaunchLimit: 1, productsPerLaunch: 1, vipAccess: false, purchaseLimits: false, seoSuppression: false, hiddenProductControls: false, brandingEnabled: true } },
  { key: "STARTER", name: "Starter", price: 9, interval: "month", badge: "Best for small stores", description: "10 launches, VIP access, SEO suppression.", features: [], entitlements: { activeLaunchLimit: 10, productsPerLaunch: 10, vipAccess: true, purchaseLimits: false, seoSuppression: true, hiddenProductControls: true, brandingEnabled: false } },
  { key: "GROWTH", name: "Growth", price: 29, interval: "month", badge: "Most popular", description: "Unlimited launches with purchase limits.", features: [], entitlements: { activeLaunchLimit: null, productsPerLaunch: null, vipAccess: true, purchaseLimits: true, seoSuppression: true, hiddenProductControls: true, brandingEnabled: false } },
  { key: "SCALE", name: "Scale", price: 79, interval: "month", badge: "Coming soon", description: "Advanced controls — coming soon.", features: [], entitlements: { activeLaunchLimit: null, productsPerLaunch: null, vipAccess: true, purchaseLimits: true, seoSuppression: true, hiddenProductControls: true, brandingEnabled: false } }
];

export function App() {
  const [selected, setSelected] = useState(0);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const shop = params.get("shop") ?? "";

  const reload = useCallback(async () => {
    if (!shop) return;
    const response = await adminFetch(`/api/admin/bootstrap?shop=${encodeURIComponent(shop)}`);
    if (!response.ok) throw new Error("Bootstrap failed");
    setData(await response.json());
  }, [shop]);

  useEffect(() => {
    reload().catch(() => setData({ shop: null }));
  }, [reload]);

  async function runAction(action: () => Promise<void>, success: string) {
    setLoading(true);
    try {
      await action();
      await reload();
      setToast(success);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function openEditCampaign(campaign: Campaign) {
    setEditingCampaign(campaign);
    setSelected(2);
  }

  function clearEdit() {
    setEditingCampaign(null);
  }

  const shopData = data?.shop ?? null;

  return (
    <Page>
      {toast ? <Toast content={toast} onDismiss={() => setToast("")} /> : null}
      <div className="lg-app">
        <Layout>
          <Layout.Section>
            <div className="lg-admin-header">
              <InlineStack gap="300" blockAlign="center" wrap={false}>
                <img src={launchGuardLogo} alt="" className="lg-admin-header__logo" />
                <BlockStack gap="050">
                  <Text as="h1" variant="headingLg">LaunchGuard</Text>
                  <Text as="p" tone="subdued">Schedule launches, control access, enforce fair limits.</Text>
                </BlockStack>
              </InlineStack>
              <Button variant="primary" onClick={() => { clearEdit(); setSelected(2); }}>Create launch</Button>
            </div>
            <div className="lg-tabs">
              <Tabs tabs={tabs} selected={selected} onSelect={(idx) => { if (idx !== 2) clearEdit(); setSelected(idx); }}>
                <Box paddingBlockStart="400">
                  {selected === 0 && <DashboardPanel data={shopData} loading={loading} goToTab={setSelected} runAction={runAction} shop={shop} />}
                  {selected === 1 && <CampaignsPanel data={shopData} loading={loading} runAction={runAction} onEdit={openEditCampaign} onNew={() => { clearEdit(); setSelected(2); }} />}
                  {selected === 2 && <CampaignEditorPanel data={shopData} loading={loading} runAction={runAction} editingCampaign={editingCampaign} onSaved={() => { clearEdit(); setSelected(1); }} onUpgrade={() => setSelected(3)} />}
                  {selected === 3 && <PlansPanel data={shopData} loading={loading} runAction={runAction} />}
                  {selected === 4 && <SettingsPanel data={shopData} loading={loading} runAction={runAction} />}
                  {selected === 5 && <SupportPanel data={shopData} loading={loading} runAction={runAction} />}
                  {selected === 6 && <ActivityPanel auditLogs={shopData?.auditLogs ?? []} />}
                </Box>
              </Tabs>
            </div>
          </Layout.Section>
        </Layout>
      </div>
    </Page>
  );
}

function DashboardPanel({ data, loading, goToTab, runAction, shop }: { data: Bootstrap["shop"]; loading: boolean; goToTab: (i: number) => void; runAction: (action: () => Promise<void>, success: string) => Promise<void>; shop: string }) {
  const metrics = [
    { label: "Total campaigns", value: data?.dashboard.totalCampaigns ?? 0, detail: "All time" },
    { label: "Active launches", value: data?.dashboard.activeCampaigns ?? 0, detail: "Scheduled, VIP or live" },
    { label: "Live right now", value: data?.dashboard.liveCampaigns ?? 0, detail: "Currently publicly available" },
    { label: "Current plan", value: data?.plan.name ?? "Free", detail: "Managed by Shopify" }
  ];

  const next = data?.dashboard.nextScheduledLaunch;

  return (
    <BlockStack gap="400">
      <div className="lg-hero">
        <div className="lg-hero__content">
          <img src={launchGuardLogo} alt="" className="lg-hero__logo" />
          <BlockStack gap="200">
            <Text as="h2" variant="headingXl">Launch control center</Text>
            <Text as="p">Schedule drops, control early access, and enforce fair limits — all from one place.</Text>
            {next ? (
              <Text as="p">Next scheduled launch: <strong>{next.name}</strong> — {formatDate(next.publicLaunchAt)}</Text>
            ) : (
              <Text as="p" tone="subdued">No upcoming launches scheduled.</Text>
            )}
          </BlockStack>
        </div>
      </div>

      <InlineGrid columns={{ xs: 1, md: 4 }} gap="300">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <div className="lg-metric-card">
              <BlockStack gap="150">
                <Text as="p" tone="subdued">{metric.label}</Text>
                <Text as="p" variant="headingLg">{metric.value}</Text>
                <Text as="p" tone="subdued">{metric.detail}</Text>
              </BlockStack>
            </div>
          </Card>
        ))}
      </InlineGrid>

      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">Get started</Text>
          </InlineStack>
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
            <Button onClick={() => goToTab(2)}>Create your first controlled launch</Button>
            <Button onClick={() => goToTab(5)}>Need help with a launch?</Button>
            <Button onClick={() => goToTab(3)}>View plans</Button>
          </InlineGrid>
        </BlockStack>
      </Card>

      <OnboardingChecklist
        hasCampaigns={Boolean(data?.campaigns?.length)}
        onNew={() => goToTab(2)}
        onPlans={() => goToTab(3)}
        shop={shop}
      />

      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">Launch templates</Text>
          <Text as="p" tone="subdued">Start from a common launch setup, then adjust timing, VIP tags and limits.</Text>
          <LaunchTemplateCards onNew={() => goToTab(2)} />
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">How LaunchGuard protects a launch</Text>
          <FeatureEducationStrip />
        </BlockStack>
      </Card>

      {data?.dashboard.activeCampaigns === 0 && (
        <Card>
          <div className="lg-empty-card">
            <EmptyState heading="No active launch campaigns" action={{ content: "Create a campaign", onAction: () => goToTab(2) }} image="">
              <p>Create a launch campaign to start scheduling drops, controlling VIP access, and enforcing purchase limits.</p>
            </EmptyState>
          </div>
        </Card>
      )}

      {(data?.campaigns ?? []).filter(c => ["SCHEDULED", "VIP_ACTIVE", "LIVE"].includes(c.status) && c.isEnabled).slice(0, 5).map((campaign) => (
        <Card key={campaign.id}>
          <div className="lg-campaign-card">
            <InlineStack align="space-between" blockAlign="start">
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm">{campaign.name}</Text>
                <InlineStack gap="150">
                  <CampaignStatusBadge status={campaign.status} />
                  <Text as="p" tone="subdued">{campaign.products.length} product(s) · {formatDate(campaign.publicLaunchAt)}</Text>
                </InlineStack>
                {campaign.schedulerError ? <Text as="p" tone="critical">{campaign.schedulerError}</Text> : null}
              </BlockStack>
            </InlineStack>
          </div>
        </Card>
      ))}
    </BlockStack>
  );
}

function CampaignsPanel({ data, loading, runAction, onEdit, onNew }: { data: Bootstrap["shop"]; loading: boolean; runAction: (action: () => Promise<void>, success: string) => Promise<void>; onEdit: (campaign: Campaign) => void; onNew: () => void }) {
  const campaigns = data?.campaigns ?? [];

  async function toggleCampaign(campaign: Campaign) {
    const response = await adminFetch(`/api/admin/campaigns/${campaign.id}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !campaign.isEnabled })
    });
    if (!response.ok) throw new Error(await errorMessage(response, "Toggle failed"));
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!window.confirm(`Delete campaign "${campaign.name}"?`)) return;
    const response = await adminFetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await errorMessage(response, "Delete failed"));
  }

  async function hideProducts(campaign: Campaign) {
    const response = await adminFetch(`/api/admin/campaigns/${campaign.id}/hide-products`, { method: "POST" });
    if (!response.ok) throw new Error(await errorMessage(response, "Could not queue product hide"));
  }

  if (!campaigns.length) {
    return (
      <BlockStack gap="400">
        <SectionHeader title="Campaigns" description="Manage all launch campaigns for this store." />
        <Card>
          <div className="lg-empty-card">
            <EmptyState heading="No launch campaigns yet" action={{ content: "Create your first campaign", onAction: onNew }} image="">
              <p>Create a campaign to schedule a product drop, control VIP access, and set purchase limits.</p>
            </EmptyState>
          </div>
        </Card>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="400">
      <SectionHeader title="Campaigns" description="All launch campaigns for this store." />
      <InlineStack align="end">
        <Button variant="primary" onClick={onNew}>Create launch</Button>
      </InlineStack>
      {campaigns.map((campaign) => (
        <Card key={campaign.id}>
          <div className="lg-campaign-card">
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="start" wrap={false}>
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">{campaign.name}</Text>
                  <InlineStack gap="150" wrap>
                    <CampaignStatusBadge status={campaign.status} />
                    <Text as="p" tone="subdued">{campaign.products.length} product(s)</Text>
                    <Text as="p" tone="subdued">Launches {formatDate(campaign.publicLaunchAt)}</Text>
                    {campaign.vipAccessStartsAt ? <Text as="p" tone="subdued">VIP from {formatDate(campaign.vipAccessStartsAt)}</Text> : null}
                  </InlineStack>
                  {campaign.schedulerError ? (
                    <Text as="p" tone="critical">Scheduler error: {campaign.schedulerError}</Text>
                  ) : null}
                </BlockStack>
                <Badge tone={campaign.isEnabled ? "success" : undefined}>{campaign.isEnabled ? "Enabled" : "Disabled"}</Badge>
              </InlineStack>
              <InlineStack gap="200" wrap>
                <Button onClick={() => onEdit(campaign)}>Edit</Button>
                <Button loading={loading} onClick={() => runAction(() => toggleCampaign(campaign), campaign.isEnabled ? "Campaign disabled." : "Campaign enabled.")}>
                  {campaign.isEnabled ? "Disable" : "Enable"}
                </Button>
                {data?.entitlements.hiddenProductControls ? (
                  <Button loading={loading} onClick={() => runAction(() => hideProducts(campaign), "Product visibility update queued.")}>Hide products now</Button>
                ) : null}
                <Button variant="plain" tone="critical" loading={loading} onClick={() => runAction(() => deleteCampaign(campaign), "Campaign deleted.")}>Delete</Button>
              </InlineStack>
            </BlockStack>
          </div>
        </Card>
      ))}
    </BlockStack>
  );
}

type CampaignFormState = {
  name: string;
  timezone: string;
  publicLaunchAt: string;
  vipAccessStartsAt: string;
  endsAt: string;
  seoSuppressionEnabled: boolean;
  countdownTitle: string;
  countdownBody: string;
  lockedMessage: string;
  vipMessage: string;
  brandingEnabled: boolean;
  isEnabled: boolean;
  products: Array<{ shopifyProductId: string; shopifyProductHandle: string; shopifyProductTitle: string }>;
  vipTagInput: string;
  accessRules: Array<{ customerTag: string }>;
  perOrderLimitEnabled: boolean;
  perOrderMax: string;
  perOrderMessage: string;
  perCustomerLimitEnabled: boolean;
  perCustomerMax: string;
  perCustomerMessage: string;
};

const defaultForm: CampaignFormState = {
  name: "",
  timezone: "UTC",
  publicLaunchAt: "",
  vipAccessStartsAt: "",
  endsAt: "",
  seoSuppressionEnabled: false,
  countdownTitle: "Coming soon",
  countdownBody: "This product will be available soon.",
  lockedMessage: "This product is not yet available.",
  vipMessage: "You have early access. Enjoy the launch!",
  brandingEnabled: true,
  isEnabled: true,
  products: [],
  vipTagInput: "",
  accessRules: [],
  perOrderLimitEnabled: false,
  perOrderMax: "1",
  perOrderMessage: "This launch is limited to {max} per order.",
  perCustomerLimitEnabled: false,
  perCustomerMax: "1",
  perCustomerMessage: "This launch is limited to {max} per customer."
};

function campaignToForm(c: Campaign): CampaignFormState {
  const perOrder = c.purchaseLimits.find(l => l.limitType === "PER_ORDER");
  const perCustomer = c.purchaseLimits.find(l => l.limitType === "PER_CUSTOMER");
  return {
    name: c.name,
    timezone: c.timezone,
    publicLaunchAt: toDatetimeLocal(c.publicLaunchAt),
    vipAccessStartsAt: c.vipAccessStartsAt ? toDatetimeLocal(c.vipAccessStartsAt) : "",
    endsAt: c.endsAt ? toDatetimeLocal(c.endsAt) : "",
    seoSuppressionEnabled: c.seoSuppressionEnabled,
    countdownTitle: c.countdownTitle,
    countdownBody: c.countdownBody,
    lockedMessage: c.lockedMessage,
    vipMessage: c.vipMessage,
    brandingEnabled: c.brandingEnabled,
    isEnabled: c.isEnabled,
    products: c.products.map(p => ({ shopifyProductId: p.shopifyProductId, shopifyProductHandle: p.shopifyProductHandle, shopifyProductTitle: p.shopifyProductTitle })),
    vipTagInput: "",
    accessRules: c.accessRules.map(r => ({ customerTag: r.customerTag })),
    perOrderLimitEnabled: Boolean(perOrder?.enabled),
    perOrderMax: String(perOrder?.maxQuantity ?? 1),
    perOrderMessage: perOrder?.validationMessage ?? "This launch is limited to {max} per order.",
    perCustomerLimitEnabled: Boolean(perCustomer?.enabled),
    perCustomerMax: String(perCustomer?.maxQuantity ?? 1),
    perCustomerMessage: perCustomer?.validationMessage ?? "This launch is limited to {max} per customer."
  };
}

function CampaignEditorPanel({ data, loading, runAction, editingCampaign, onSaved, onUpgrade }: { data: Bootstrap["shop"]; loading: boolean; runAction: (action: () => Promise<void>, success: string) => Promise<void>; editingCampaign: Campaign | null; onSaved: () => void; onUpgrade: () => void }) {
  const [form, setForm] = useState<CampaignFormState>(editingCampaign ? campaignToForm(editingCampaign) : defaultForm);
  const [error, setError] = useState("");
  const [pickerError, setPickerError] = useState("");
  const entitlements = data?.entitlements;

  useEffect(() => {
    setForm(editingCampaign ? campaignToForm(editingCampaign) : defaultForm);
    setError("");
  }, [editingCampaign]);

  function update<K extends keyof CampaignFormState>(key: K, value: CampaignFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function pickProduct() {
    if (!window.shopify?.resourcePicker) {
      setPickerError("Resource picker unavailable. Enter product ID manually.");
      return;
    }
    const result = await window.shopify.resourcePicker({ type: "product", action: "select", multiple: false, filter: { variants: false } });
    const sel = firstPickerSelection(result);
    if (!sel) return;
    if (!sel.handle || !sel.id) {
      setPickerError("Selected product did not include required data.");
      return;
    }
    setPickerError("");
    const productId = sel.id.includes("gid://") ? sel.id : `gid://shopify/Product/${sel.id}`;
    if (form.products.find(p => p.shopifyProductId === productId)) return;
    update("products", [...form.products, { shopifyProductId: productId, shopifyProductHandle: sel.handle, shopifyProductTitle: sel.title ?? "" }]);
  }

  function removeProduct(productId: string) {
    update("products", form.products.filter(p => p.shopifyProductId !== productId));
  }

  function addVipTag() {
    const tag = form.vipTagInput.trim();
    if (!tag) return;
    if (form.accessRules.find(r => r.customerTag === tag)) {
      update("vipTagInput", "");
      return;
    }
    update("accessRules", [...form.accessRules, { customerTag: tag }]);
    update("vipTagInput", "");
  }

  function removeVipTag(tag: string) {
    update("accessRules", form.accessRules.filter(r => r.customerTag !== tag));
  }

  async function saveCampaign() {
    if (!form.name.trim()) { setError("Campaign name is required."); return; }
    if (!form.publicLaunchAt) { setError("Public launch date/time is required."); return; }
    if (form.products.length === 0) { setError("Add at least one product to the campaign."); return; }

    if (!entitlements?.vipAccess && form.accessRules.length > 0) {
      setError("VIP access requires the Starter plan or higher.");
      return;
    }
    if (!entitlements?.purchaseLimits && (form.perOrderLimitEnabled || form.perCustomerLimitEnabled)) {
      setError("Purchase limits require the Growth plan.");
      return;
    }
    if (!entitlements?.seoSuppression && form.seoSuppressionEnabled) {
      setError("SEO suppression requires the Starter plan or higher.");
      return;
    }

    const purchaseLimits = [];
    if (form.perOrderLimitEnabled) {
      purchaseLimits.push({ limitType: "PER_ORDER", maxQuantity: parseInt(form.perOrderMax) || 1, enabled: true, validationMessage: form.perOrderMessage });
    }
    if (form.perCustomerLimitEnabled) {
      purchaseLimits.push({ limitType: "PER_CUSTOMER", maxQuantity: parseInt(form.perCustomerMax) || 1, enabled: true, validationMessage: form.perCustomerMessage });
    }

    const payload = {
      name: form.name,
      timezone: form.timezone,
      publicLaunchAt: toISO(form.publicLaunchAt),
      vipAccessStartsAt: form.vipAccessStartsAt ? toISO(form.vipAccessStartsAt) : null,
      endsAt: form.endsAt ? toISO(form.endsAt) : null,
      seoSuppressionEnabled: form.seoSuppressionEnabled,
      countdownTitle: form.countdownTitle,
      countdownBody: form.countdownBody,
      lockedMessage: form.lockedMessage,
      vipMessage: form.vipMessage,
      brandingEnabled: entitlements?.brandingEnabled ? true : form.brandingEnabled,
      isEnabled: form.isEnabled,
      products: form.products,
      accessRules: form.accessRules,
      purchaseLimits
    };

    const url = editingCampaign ? `/api/admin/campaigns/${editingCampaign.id}` : "/api/admin/campaigns";
    const method = editingCampaign ? "PUT" : "POST";
    const response = await adminFetch(url, { method, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(await errorMessage(response, "Campaign save failed"));
    onSaved();
  }

  return (
    <BlockStack gap="400">
      <SectionHeader
        title={editingCampaign ? `Edit: ${editingCampaign.name}` : "New launch campaign"}
        description="Set up the products, timing, access rules, and storefront experience for this launch."
      />

      {error ? <Banner tone="critical"><Text as="p">{error}</Text></Banner> : null}

      {/* Step 1: Products */}
      <Card>
        <div className="lg-form-card">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">1. Choose launch product</Text>
            {pickerError ? <Banner tone="warning"><Text as="p">{pickerError}</Text></Banner> : null}
            {form.products.map((product) => (
              <InlineStack key={product.shopifyProductId} align="space-between" blockAlign="center" gap="200">
                <BlockStack gap="050">
                  <Text as="p" variant="headingSm">{product.shopifyProductTitle || product.shopifyProductHandle}</Text>
                  <Text as="p" tone="subdued">{product.shopifyProductHandle}</Text>
                </BlockStack>
                <Button variant="plain" tone="critical" onClick={() => removeProduct(product.shopifyProductId)}>Remove</Button>
              </InlineStack>
            ))}
            {entitlements && entitlements.productsPerLaunch !== null && form.products.length >= entitlements.productsPerLaunch ? (
              <Banner tone="warning">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p">Product limit reached for your plan ({entitlements.productsPerLaunch} products).</Text>
                  <Button onClick={onUpgrade}>Upgrade</Button>
                </InlineStack>
              </Banner>
            ) : (
              <Button onClick={pickProduct}>Choose product</Button>
            )}
          </BlockStack>
        </div>
      </Card>

      {/* Step 2: Timing */}
      <Card>
        <div className="lg-form-card">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">2. Set launch timing</Text>
            <FormLayout>
              <TextField label="Campaign name" value={form.name} onChange={v => update("name", v)} autoComplete="off" placeholder="Summer Drop 2026" />
              <TextField label="Public launch date & time (local)" type="datetime-local" value={form.publicLaunchAt} onChange={v => update("publicLaunchAt", v)} autoComplete="off" />
              <Select label="Timezone" options={timezoneOptions} value={form.timezone} onChange={v => update("timezone", v)} helpText="Used for launch timing." />
              <TextField label="VIP early access start (optional)" type="datetime-local" value={form.vipAccessStartsAt} onChange={v => update("vipAccessStartsAt", v)} autoComplete="off" helpText="Leave blank for no VIP window." disabled={!entitlements?.vipAccess} />
              {!entitlements?.vipAccess && <Text as="p" tone="subdued">VIP early access is available on Starter and higher. Use it for private customer drops and early-access launches. <Button variant="plain" onClick={onUpgrade}>Upgrade</Button></Text>}
              <TextField label="Campaign end date & time (optional)" type="datetime-local" value={form.endsAt} onChange={v => update("endsAt", v)} autoComplete="off" helpText="Leave blank to run indefinitely." />
            </FormLayout>
          </BlockStack>
        </div>
      </Card>

      {/* Step 3: Access */}
      <Card>
        <div className="lg-form-card">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">3. Configure access</Text>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">VIP customer tags</Text>
              <Text as="p" tone="subdued">Customers with these tags can access during the VIP window. Requires Starter or higher.</Text>
              {form.accessRules.map((rule) => (
                <InlineStack key={rule.customerTag} gap="200" blockAlign="center">
                  <span className="lg-pill">{rule.customerTag}</span>
                  <Button variant="plain" tone="critical" onClick={() => removeVipTag(rule.customerTag)}>Remove</Button>
                </InlineStack>
              ))}
              <InlineStack gap="200" blockAlign="center">
                <TextField label="Add tag" value={form.vipTagInput} onChange={v => update("vipTagInput", v)} autoComplete="off" placeholder="vip-2026" disabled={!entitlements?.vipAccess} />
                <Button disabled={!entitlements?.vipAccess || !form.vipTagInput.trim()} onClick={addVipTag}>Add</Button>
              </InlineStack>
            </BlockStack>

            <BlockStack gap="200">
              <Checkbox
                label="Enable SEO suppression before launch"
                checked={form.seoSuppressionEnabled}
                onChange={v => update("seoSuppressionEnabled", v)}
                disabled={!entitlements?.seoSuppression}
              />
              <Text as="p" tone="subdued">Suppresses search engine indexing before launch. Search engines may take time to respect changes. Requires Starter or higher.</Text>
            </BlockStack>
          </BlockStack>
        </div>
      </Card>

      {/* Step 4: Purchase limits */}
      <Card>
        <div className="lg-form-card">
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">4. Purchase limits</Text>
              {!entitlements?.purchaseLimits ? <Button onClick={onUpgrade}>Upgrade to Growth</Button> : null}
            </InlineStack>
            {!entitlements?.purchaseLimits ? (
              <Banner tone="info"><Text as="p">Purchase limits require the Growth plan. Per-order and per-customer quantity controls become available after upgrading.</Text></Banner>
            ) : (
              <FormLayout>
                <Checkbox label="Enable per-order quantity limit" checked={form.perOrderLimitEnabled} onChange={v => update("perOrderLimitEnabled", v)} />
                {form.perOrderLimitEnabled && (
                  <>
                    <TextField label="Max quantity per order" type="number" value={form.perOrderMax} onChange={v => update("perOrderMax", v)} autoComplete="off" />
                    <TextField label="Checkout error message" value={form.perOrderMessage} onChange={v => update("perOrderMessage", v)} autoComplete="off" helpText="Use {max} for the limit number." />
                  </>
                )}
                <Checkbox label="Enable per-customer quantity limit (cross-order)" checked={form.perCustomerLimitEnabled} onChange={v => update("perCustomerLimitEnabled", v)} />
                {form.perCustomerLimitEnabled && (
                  <>
                    <TextField label="Max quantity per customer" type="number" value={form.perCustomerMax} onChange={v => update("perCustomerMax", v)} autoComplete="off" />
                    <TextField label="Checkout error message" value={form.perCustomerMessage} onChange={v => update("perCustomerMessage", v)} autoComplete="off" helpText="Use {max} for the limit number." />
                    <Banner tone="warning"><Text as="p">Per-customer cross-order enforcement requires the Checkout Validation Function to be deployed and configured. Until then, per-cart limits apply only.</Text></Banner>
                  </>
                )}
              </FormLayout>
            )}
          </BlockStack>
        </div>
      </Card>

      {/* Step 5: Storefront */}
      <Card>
        <div className="lg-form-card">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">5. Storefront message</Text>
              <StorefrontPreviewCard />
            <FormLayout>
              <TextField label="Countdown title" value={form.countdownTitle} onChange={v => update("countdownTitle", v)} autoComplete="off" />
              <TextField label="Countdown body" value={form.countdownBody} onChange={v => update("countdownBody", v)} multiline={2} autoComplete="off" />
              <TextField label="Locked message (non-VIP before launch)" value={form.lockedMessage} onChange={v => update("lockedMessage", v)} multiline={2} autoComplete="off" />
              <TextField label="VIP access message" value={form.vipMessage} onChange={v => update("vipMessage", v)} multiline={2} autoComplete="off" />
              {entitlements?.brandingEnabled ? (
                <Text as="p" tone="subdued">LaunchGuard branding is included on the Free plan. Upgrade to remove it.</Text>
              ) : (
                <Checkbox label="Show LaunchGuard branding" checked={form.brandingEnabled} onChange={v => update("brandingEnabled", v)} />
              )}
            </FormLayout>
          </BlockStack>
        </div>
      </Card>

      {/* Step 6: Review */}
      <Card>
        <div className="lg-form-card">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">6. Review and schedule</Text>
            <FormLayout>
              <Checkbox label="Campaign is active" checked={form.isEnabled} onChange={v => update("isEnabled", v)} helpText="Disabled campaigns are saved as drafts and will not transition automatically." />
            </FormLayout>
            <InlineStack gap="200">
              <Button variant="primary" loading={loading} onClick={() => runAction(saveCampaign, editingCampaign ? "Campaign updated." : "Campaign created and scheduled.")}>{editingCampaign ? "Save changes" : "Create and schedule"}</Button>
              {editingCampaign ? <Button onClick={onSaved}>Cancel</Button> : null}
            </InlineStack>
          </BlockStack>
        </div>
      </Card>
    </BlockStack>
  );
}

function PlansPanel({ data, loading, runAction }: { data: Bootstrap["shop"]; loading: boolean; runAction: (action: () => Promise<void>, success: string) => Promise<void> }) {
  const plans = data?.plans?.length ? data.plans : defaultPlans.map(p => ({ ...p, current: p.key === "FREE" }));

  async function refreshPlan() {
    const response = await adminFetch("/api/admin/billing/refresh", { method: "POST" });
    if (!response.ok) throw new Error(await errorMessage(response, "Plan refresh failed."));
  }

  function openManagedPricing() {
    const url = data?.diagnostics.billing.manageUrl;
    if (!url) throw new Error("Managed pricing not available yet.");
    window.open(url, "_top");
  }

  return (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center" gap="300">
          <Text as="h2" variant="headingXl">Plans</Text>
          <Badge tone="info">{`Current: ${data?.plan.name ?? "Free"}`}</Badge>
        </InlineStack>
        <Text as="p" tone="subdued">Start free, upgrade when you're ready for VIP access, purchase limits, and more powerful launches.</Text>
      </BlockStack>
      <InlineGrid columns={{ xs: 1, md: 2, lg: 4 }} gap="400">
        {plans.map((plan) => (
          <Card key={plan.key}>
            <div className={`lg-plan-card ${plan.current ? "lg-plan-card-current" : ""} ${plan.key === "GROWTH" ? "lg-plan-card-growth" : ""}`}>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="050">
                      <Text as="p" tone="subdued">{plan.badge ?? plan.key}</Text>
                      <Text as="h3" variant="headingLg">{plan.name}</Text>
                    </BlockStack>
                    {plan.current ? <Badge tone="info">Current</Badge> : plan.key === "GROWTH" ? <Badge tone="attention">Popular</Badge> : null}
                  </InlineStack>
                  <div className="lg-plan-price-row">
                    <span className="lg-plan-price">${plan.price}</span>
                    <span className="lg-plan-price-interval">/{plan.interval}</span>
                  </div>
                  <Text as="p" tone="subdued">{plan.description}</Text>
                  {plan.key !== "FREE" && plan.key !== "SCALE" ? <span className="lg-trial-pill">14-day free trial</span> : null}
                </BlockStack>
                <div className="lg-plan-card__body">
                  <ul className="lg-feature-list">
                    {planFeatures(plan).map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
                <Button
                  variant={plan.key !== "FREE" && plan.key !== "SCALE" ? "primary" : undefined}
                  loading={loading}
                  disabled={plan.current || plan.key === "FREE" || plan.key === "SCALE" || !data?.diagnostics.billing.manageUrl}
                  onClick={() => runAction(async () => openManagedPricing(), "Opening Shopify billing.")}
                  fullWidth
                >
                  {plan.current || plan.key === "FREE" ? "Current plan" : plan.key === "SCALE" ? "Coming soon" : "Start free trial"}
                </Button>
              </BlockStack>
            </div>
          </Card>
        ))}
      </InlineGrid>
      <div className="lg-plans-footer">
        <InlineStack align="center" gap="200">
          <Text as="p" tone="subdued">Plan changes are securely handled by Shopify.</Text>
          <Button variant="plain" loading={loading} onClick={() => runAction(refreshPlan, "Plan refreshed.")}>Recently upgraded? Refresh plan</Button>
        </InlineStack>
      </div>
    </BlockStack>
  );
}

function SettingsPanel({ data, loading, runAction }: { data: Bootstrap["shop"]; loading: boolean; runAction: (action: () => Promise<void>, success: string) => Promise<void> }) {
  const [timezone, setTimezone] = useState(data?.settings?.defaultTimezone ?? "UTC");

  async function saveSettings() {
    const response = await adminFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify({ defaultTimezone: timezone }) });
    if (!response.ok) throw new Error(await errorMessage(response, "Settings save failed"));
  }

  return (
    <BlockStack gap="400">
      <SectionHeader title="Settings" description="Global settings for LaunchGuard on this store." />
      <Card>
        <div className="lg-section-card">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Store settings</Text>
            <FormLayout>
              <Select label="Default timezone" options={timezoneOptions} value={timezone} onChange={setTimezone} helpText="Used as the default when creating new campaigns." />
              <Button variant="primary" loading={loading} onClick={() => runAction(saveSettings, "Settings saved.")}>Save settings</Button>
            </FormLayout>
          </BlockStack>
        </div>
      </Card>
      <Card>
        <div className="lg-section-card">
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">App information</Text>
            <BlockStack gap="100">
              <InlineStack gap="200"><Text as="p" tone="subdued">Version</Text><Text as="p">0.1.0</Text></InlineStack>
              <InlineStack gap="200"><Text as="p" tone="subdued">Store</Text><Text as="p">{data?.domain ?? "—"}</Text></InlineStack>
              <InlineStack gap="200"><Text as="p" tone="subdued">Current plan</Text><Text as="p">{data?.plan.name ?? "Free"}</Text></InlineStack>
            </BlockStack>
          </BlockStack>
        </div>
      </Card>
    </BlockStack>
  );
}

function SupportPanel({ data, loading, runAction }: { data: Bootstrap["shop"]; loading: boolean; runAction: (action: () => Promise<void>, success: string) => Promise<void> }) {
  const [tab, setTab] = useState<"support" | "feature">("support");
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [supportForm, setSupportForm] = useState({ issueType: "SETUP_HELP", subject: "", message: "", contactEmail: "", campaignId: "" });
  const [featureForm, setFeatureForm] = useState({ title: "", description: "", category: "LAUNCH_SCHEDULING", importance: "IMPORTANT" });

  useEffect(() => {
    adminFetch("/api/admin/support/campaigns").then(r => r.json()).then((list) => {
      if (Array.isArray(list)) setCampaigns(list);
    }).catch(() => {});
  }, []);

  function updateSupport<K extends keyof typeof supportForm>(key: K, value: string) {
    setSupportForm(f => ({ ...f, [key]: value }));
  }

  function updateFeature<K extends keyof typeof featureForm>(key: K, value: string) {
    setFeatureForm(f => ({ ...f, [key]: value }));
  }

  async function submitSupport() {
    if (!supportForm.subject.trim() || !supportForm.message.trim() || !supportForm.contactEmail.trim()) {
      throw new Error("Please fill in all required fields.");
    }
    const payload = { ...supportForm, campaignId: supportForm.campaignId || null };
    const response = await adminFetch("/api/admin/support/request", { method: "POST", body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(await errorMessage(response, "Support request failed"));
    setSupportForm({ issueType: "SETUP_HELP", subject: "", message: "", contactEmail: "", campaignId: "" });
  }

  async function submitFeature() {
    if (!featureForm.title.trim() || !featureForm.description.trim()) {
      throw new Error("Please fill in all required fields.");
    }
    const response = await adminFetch("/api/admin/support/feature", { method: "POST", body: JSON.stringify(featureForm) });
    if (!response.ok) throw new Error(await errorMessage(response, "Feature request failed"));
    setFeatureForm({ title: "", description: "", category: "LAUNCH_SCHEDULING", importance: "IMPORTANT" });
  }

  return (
    <BlockStack gap="400">
      <div className="lg-support-hero">
        <BlockStack gap="200">
          <Text as="h2" variant="headingXl">Need help with a launch?</Text>
          <Text as="p">Running a high-pressure drop? Send us the details and we'll help where we can. Tell us what would make LaunchGuard better.</Text>
        </BlockStack>
      </div>

      <InlineStack gap="200">
        <Button variant={tab === "support" ? "primary" : undefined} onClick={() => setTab("support")}>Get support</Button>
        <Button variant={tab === "feature" ? "primary" : undefined} onClick={() => setTab("feature")}>Request a feature</Button>
      </InlineStack>

      {tab === "support" && (
        <Card>
          <div className="lg-section-card">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Contact support</Text>
              <FormLayout>
                <Select
                  label="Issue type"
                  options={[
                    { label: "Setup help", value: "SETUP_HELP" },
                    { label: "Launch not working as expected", value: "LAUNCH_NOT_WORKING" },
                    { label: "VIP access", value: "VIP_ACCESS" },
                    { label: "Purchase limits", value: "PURCHASE_LIMITS" },
                    { label: "Storefront display", value: "STOREFRONT_DISPLAY" },
                    { label: "Billing / plan", value: "BILLING_PLAN" },
                    { label: "Other", value: "OTHER" }
                  ]}
                  value={supportForm.issueType}
                  onChange={v => updateSupport("issueType", v)}
                />
                <TextField label="Subject" value={supportForm.subject} onChange={v => updateSupport("subject", v)} autoComplete="off" />
                <TextField label="Message" value={supportForm.message} onChange={v => updateSupport("message", v)} multiline={5} autoComplete="off" />
                <TextField label="Your email" type="email" value={supportForm.contactEmail} onChange={v => updateSupport("contactEmail", v)} autoComplete="email" />
                {campaigns.length > 0 && (
                  <Select
                    label="Related campaign (optional)"
                    options={[{ label: "None", value: "" }, ...campaigns.map(c => ({ label: `${c.name} (${c.status})`, value: c.id }))]}
                    value={supportForm.campaignId}
                    onChange={v => updateSupport("campaignId", v)}
                  />
                )}
                <Button variant="primary" loading={loading} onClick={() => runAction(submitSupport, "Support request saved. We'll review it as soon as possible.")}>Send support request</Button>
              </FormLayout>
            </BlockStack>
          </div>
        </Card>
      )}

      {tab === "feature" && (
        <Card>
          <div className="lg-section-card">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Request a feature</Text>
              <Text as="p" tone="subdued">Tell us what would make LaunchGuard better. We read every request.</Text>
              <FormLayout>
                <TextField label="Feature title" value={featureForm.title} onChange={v => updateFeature("title", v)} autoComplete="off" placeholder="One-click launch templates" />
                <TextField label="Description" value={featureForm.description} onChange={v => updateFeature("description", v)} multiline={4} autoComplete="off" />
                <Select
                  label="Category"
                  options={[
                    { label: "Launch scheduling", value: "LAUNCH_SCHEDULING" },
                    { label: "VIP access", value: "VIP_ACCESS" },
                    { label: "Purchase limits", value: "PURCHASE_LIMITS" },
                    { label: "Storefront display", value: "STOREFRONT_DISPLAY" },
                    { label: "Analytics", value: "ANALYTICS" },
                    { label: "Integrations", value: "INTEGRATIONS" },
                    { label: "Other", value: "OTHER" }
                  ]}
                  value={featureForm.category}
                  onChange={v => updateFeature("category", v)}
                />
                <Select
                  label="How important is this?"
                  options={[
                    { label: "Nice to have", value: "NICE_TO_HAVE" },
                    { label: "Important", value: "IMPORTANT" },
                    { label: "Needed for next launch", value: "NEEDED_FOR_NEXT_LAUNCH" }
                  ]}
                  value={featureForm.importance}
                  onChange={v => updateFeature("importance", v)}
                />
                <Button variant="primary" loading={loading} onClick={() => runAction(submitFeature, "Feature request submitted. Thank you for the feedback.")}>Submit feature request</Button>
              </FormLayout>
            </BlockStack>
          </div>
        </Card>
      )}

      <Card>
        <div className="lg-section-card">
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Setup notes</Text>
            <Text as="p">1. Create a campaign with at least one product and a future public launch date.</Text>
            <Text as="p">2. Enable the campaign — it will automatically transition to Live at the scheduled time.</Text>
            <Text as="p">3. For VIP access, add customer tags and a VIP window start time (Starter+ required).</Text>
            <Text as="p">4. For purchase limits, configure per-order or per-customer maximums (Growth+ required).</Text>
            <Text as="p">5. Deploy the theme app extension to show countdown and locked messages on your storefront.</Text>
          </BlockStack>
        </div>
      </Card>
    </BlockStack>
  );
}

function ActivityPanel({ auditLogs }: { auditLogs: NonNullable<Bootstrap["shop"]>["auditLogs"] }) {
  if (!auditLogs.length) {
    return (
      <BlockStack gap="400">
        <SectionHeader title="Activity" description="Audit trail for all LaunchGuard events." />
        <Card><div className="lg-empty-card"><EmptyState heading="No activity yet" image=""><p>Campaign transitions, product visibility changes, and errors will appear here.</p></EmptyState></div></Card>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="400">
      <SectionHeader title="Activity" description="Recent LaunchGuard events for this store." />
      <Card>
        <div className="lg-activity-timeline">
          {auditLogs.map((log) => (
            <div className="lg-activity-item" key={log.id}>
              <span className={`lg-activity-dot ${log.severity === "ERROR" ? "lg-activity-dot-error" : log.severity === "WARN" ? "lg-activity-dot-warn" : ""}`} />
              <BlockStack gap="050">
                <Text as="p">{log.message}</Text>
                <Text as="p" tone="subdued">{formatDate(log.createdAt)} · {log.action}{log.campaignId ? ` · Campaign ${log.campaignId.slice(0, 8)}` : ""}</Text>
              </BlockStack>
            </div>
          ))}
        </div>
      </Card>
    </BlockStack>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const tones: Record<string, { tone: "success" | "attention" | "warning" | "info" | "critical" | undefined; label: string }> = {
    DRAFT: { tone: undefined, label: "Draft" },
    SCHEDULED: { tone: "info", label: "Scheduled" },
    VIP_ACTIVE: { tone: "attention", label: "VIP access" },
    LIVE: { tone: "success", label: "Live" },
    ENDED: { tone: undefined, label: "Ended" },
    DISABLED: { tone: undefined, label: "Disabled" }
  };
  const { tone, label } = tones[status] ?? { tone: undefined, label: status };
  return <Badge tone={tone}>{label}</Badge>;
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="lg-section-header">
      <BlockStack gap="100">
        <Text as="h2" variant="headingLg">{title}</Text>
        <Text as="p" tone="subdued">{description}</Text>
      </BlockStack>
    </div>
  );
}

function planFeatures(plan: Plan) {
  const features: Record<string, string[]> = {
    FREE: ["1 active launch", "1 product per launch", "Basic countdown", "Audit log"],
    STARTER: ["10 launches", "10 products per launch", "VIP early access by tag", "SEO suppression", "Hidden product controls", "Remove branding"],
    GROWTH: ["Unlimited launches", "Unlimited products", "Purchase limits (per order)", "Per-customer rules", "Everything in Starter"],
    SCALE: ["Everything in Growth", "Shopify Flow (coming)", "Advanced analytics", "Priority support"]
  };
  return features[plan.key] ?? plan.features.slice(0, 5);
}

function OnboardingChecklist({ hasCampaigns, onNew, onPlans, shop }: { hasCampaigns: boolean; onNew: () => void; onPlans: () => void; shop: string }) {
  const themeEditorUrl = shop ? `https://${shop}/admin/themes/current/editor?context=apps` : null;

  const items: Array<{ done: boolean; title: string; body: string; action?: { label: string; url: string } }> = [
    { done: hasCampaigns, title: "Create your first launch", body: "Choose a product, set the public launch time, and save the campaign." },
    {
      done: false,
      title: "Enable the theme app embed",
      body: "Turn on the LaunchGuard app embed in your Shopify theme so countdown and lock messages appear on your storefront.",
      ...(themeEditorUrl ? { action: { label: "Open theme editor", url: themeEditorUrl } } : {})
    },
    { done: false, title: "Test the storefront experience", body: "Preview the locked, countdown and VIP messages on a product page before your launch goes live." },
    { done: false, title: "Upgrade only when needed", body: "Use Starter for VIP access and Growth for purchase limits or SEO suppression." }
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">Launch setup checklist</Text>
            <Text as="p" tone="subdued">A quick path from install to a controlled product launch.</Text>
          </BlockStack>
          <Button variant="primary" onClick={onNew}>Create launch</Button>
        </InlineStack>

        <div className="lg-checklist">
          {items.map((item, index) => (
            <div className={item.done ? "lg-checkitem lg-checkitem-done" : "lg-checkitem"} key={item.title}>
              <div className="lg-checkmark">{item.done ? "✓" : index + 1}</div>
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
                {item.action && (
                  <span style={{ marginTop: "6px", display: "block" }}>
                    <Button size="slim" url={item.action.url} target="_top">{item.action.label}</Button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <InlineStack gap="200">
          <Button onClick={onNew}>Create a test launch</Button>
          <Button onClick={onPlans}>View plan limits</Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}


function LaunchTemplateCards({ onNew }: { onNew: () => void }) {
  const templates = [
    { title: "Product drop", body: "Schedule a product to unlock at a specific time with a countdown." },
    { title: "VIP early access", body: "Let tagged customers shop before the public launch window." },
    { title: "Fair-limit launch", body: "Use purchase limits to reduce bulk buying during high-demand drops." }
  ];

  return (
    <div className="lg-template-grid">
      {templates.map((template) => (
        <div className="lg-template-card" key={template.title}>
          <div>
            <p className="lg-template-eyebrow">Launch template</p>
            <h3>{template.title}</h3>
            <p>{template.body}</p>
          </div>
          <Button size="slim" onClick={onNew}>Use template</Button>
        </div>
      ))}
    </div>
  );
}

function FeatureEducationStrip() {
  return (
    <div className="lg-feature-strip">
      <div><strong>VIP access</strong><span>Give tagged customers a private early-access window.</span></div>
      <div><strong>Fair purchase limits</strong><span>Help prevent bulk buying and keep launches fair.</span></div>
      <div><strong>SEO-safe launch control</strong><span>Keep launch products controlled without confusing shoppers.</span></div>
    </div>
  );
}

function StorefrontPreviewCard() {
  return (
    <div className="lg-preview-card">
      <div className="lg-preview-topline"><span>Storefront preview</span><span>Countdown / locked / VIP</span></div>
      <div className="lg-preview-box">
        <p className="lg-preview-kicker">Launching soon</p>
        <h3>Product available soon</h3>
        <p>This product is not yet available. VIP customers may access early when configured.</p>
        <div className="lg-countdown-row"><span>02d</span><span>14h</span><span>38m</span></div>
      </div>
    </div>
  );
}

function firstPickerSelection(result: Array<{ id: string; title?: string; handle?: string }> | { selection?: Array<{ id: string; title?: string; handle?: string }> } | undefined) {
  if (!result) return null;
  if (Array.isArray(result)) return result[0] ?? null;
  return result.selection?.[0] ?? null;
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(datetimeLocal: string) {
  return new Date(datetimeLocal).toISOString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}
