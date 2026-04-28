const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const automator = require("miniprogram-automator");
const { ensureDir, nowIso, parseArgs, writeJson } = require("./_utils");

dotenv.config();

function loadActions(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function performAction(page, action) {
  const selector = action.selector;
  if (!selector) {
    return { ok: false, action, reason: "missing selector" };
  }
  const element = await page.$(selector);
  if (!element) {
    return { ok: false, action, reason: `element not found: ${selector}` };
  }

  if (action.type === "click") {
    if (typeof element.tap !== "function") {
      return { ok: false, action, reason: "element.tap not available" };
    }
    await element.tap();
    return { ok: true, action };
  }

  if (action.type === "input") {
    if (typeof element.input !== "function") {
      return { ok: false, action, reason: "element.input not available" };
    }
    await element.input(action.value || "");
    return { ok: true, action };
  }

  return { ok: false, action, reason: `unsupported action type: ${action.type}` };
}

async function main() {
  const args = parseArgs(process.argv);
  const projectPath = path.resolve(process.env.PROJECT_PATH || process.cwd());
  const entryPage = process.env.E2E_ENTRY_PAGE || "/pages/index/index";
  const actionsPath = args.actions || "input/e2e-actions.json";
  const screenshotPath = path.resolve(args.screenshot || "artifacts/e2e-current.png");
  const outputPath = path.resolve(args.output || "artifacts/e2e-result.json");
  const actions = loadActions(actionsPath);

  ensureDir(path.dirname(screenshotPath));

  const miniProgram = await automator.launch({ projectPath });
  const page = await miniProgram.reLaunch(entryPage);
  if (typeof page.waitFor === "function") {
    await page.waitFor(1000);
  }

  const results = [];
  for (const action of actions) {
    const result = await performAction(page, action);
    results.push(result);
    if (!result.ok) {
      break;
    }
    if (typeof page.waitFor === "function") {
      await page.waitFor(500);
    }
  }

  if (typeof page.screenshot === "function") {
    await page.screenshot(screenshotPath);
  }

  await miniProgram.close();

  const success = results.every((r) => r.ok);
  writeJson(outputPath, {
    success,
    generatedAt: nowIso(),
    projectPath,
    entryPage,
    screenshotPath,
    actionsPath,
    actionCount: actions.length,
    results
  });

  if (!success) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  writeJson("artifacts/e2e-result.json", {
    success: false,
    generatedAt: nowIso(),
    error: error.message
  });
  process.exit(1);
});
