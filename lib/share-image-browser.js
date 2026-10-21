import { chromium as playwright } from "playwright-core";

export async function launchServerlessBrowser() {
  // The bundled executable targets Linux x64, not local Windows Chrome.
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("SERVERLESS_PLATFORM_UNSUPPORTED");
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!(major >= 24 || (major === 22 && minor >= 17))) {
    throw new Error("SERVERLESS_NODE_UNSUPPORTED");
  }
  const { default: chromium } = await import("@sparticuz/chromium");
  return playwright.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    timeout: 20000,
  });
}
