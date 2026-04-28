const fs = require("fs");
const path = require("path");
const { ensureDir, nowIso, parseArgs } = require("./_utils");

function readIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asStatus(result) {
  if (!result) {
    return "NOT_RUN";
  }
  return result.success ? "PASS" : "FAIL";
}

function main() {
  const args = parseArgs(process.argv);
  const previewPath = path.resolve(args.preview || "artifacts/preview-result.json");
  const e2ePath = path.resolve(args.e2e || "artifacts/e2e-result.json");
  const visualPath = path.resolve(args.visual || "artifacts/visual-report.json");
  const outputPath = path.resolve(args.output || "reports/acceptance_report.md");

  const preview = readIfExists(previewPath);
  const e2e = readIfExists(e2ePath);
  const visual = readIfExists(visualPath);

  const statusPreview = asStatus(preview);
  const statusE2E = asStatus(e2e);
  const statusVisual = asStatus(visual);

  const finalPass = [statusPreview, statusE2E, statusVisual].every((s) => s === "PASS");

  const lines = [
    "# WeChat Mini Program Acceptance Report",
    "",
    `- Generated At: ${nowIso()}`,
    `- Final Result: ${finalPass ? "PASS" : "FAIL"}`,
    "",
    "## Stage Status",
    `- Preview: ${statusPreview}`,
    `- Smoke E2E: ${statusE2E}`,
    `- Visual Regression: ${statusVisual}`,
    "",
    "## Evidence",
    `- Preview JSON: ${previewPath}`,
    `- E2E JSON: ${e2ePath}`,
    `- Visual JSON: ${visualPath}`,
    ""
  ];

  if (preview && preview.error) {
    lines.push("## Preview Error", `- ${preview.error}`, "");
  }
  if (e2e && e2e.error) {
    lines.push("## E2E Error", `- ${e2e.error}`, "");
  }
  if (visual && visual.error) {
    lines.push("## Visual Error", `- ${visual.error}`, "");
  }
  if (visual && typeof visual.diffPath === "string") {
    lines.push("## Visual Diff", `- Diff Image: ${visual.diffPath}`, "");
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Report generated: ${outputPath}`);

  if (!finalPass) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
