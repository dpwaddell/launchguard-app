import "@shopify/polaris/build/esm/styles.css";
import "./styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, Frame } from "@shopify/polaris";
import { App } from "./screens/App";

window.addEventListener("error", () => {
  document.body.innerHTML = "<div style='padding:20px;color:#8e1f0b'>LaunchGuard could not load. Refresh Shopify admin and try again.</div>";
});

window.addEventListener("unhandledrejection", () => {
  document.body.innerHTML = "<div style='padding:20px;color:#8e1f0b'>LaunchGuard could not load. Refresh Shopify admin and try again.</div>";
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider i18n={{}}>
      <Frame>
        <App />
      </Frame>
    </AppProvider>
  </React.StrictMode>
);
