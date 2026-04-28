const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const pixelmatch = require("pixelmatch");
const { PNG } = require("pngjs");
const { ensureDir, nowIso, parseArgs, writeJson } = require("./_utils");

dotenv.config();

function loadPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function main() {
  const args = parseArgs(process.argv);
  const baselinePath = path.resolve(args.baseline || process.env.VISUAL_BASELINE || "baseline/index.png");
  const currentPath = path.resolve(args.current || process.env.VISUAL_CURRENT || "artifacts/e2e-current.png");
  const diffPath = path.resolve(args.diff || "artifacts/visual-diff.png");
  const reportPath = path.resolve(args.output || "artifacts/visual-report.json");
  const threshold = Number(args.threshold || process.env.VISUAL_THRESHOLD || 0.01);
  const initBaseline = Boolean(args["init-baseline"]);

  if (!fs.existsSync(currentPath)) {
    throw new Error(`Current image not found: ${currentPath}`);
  }

  if (!fs.existsSync(baselinePath)) {
    if (!initBaseline) {
      throw new Error(`Baseline image not found: ${baselinePath}. Use --init-baseline to initialize.`);
    }
    ensureDir(path.dirname(baselinePath));
    fs.copyFileSync(currentPath, baselinePath);
    writeJson(reportPath, {
      success: true,
      generatedAt: nowIso(),
      initializedBaseline: true,
      baselinePath,
      currentPath,
      diffRatio: 0,
      threshold,
      pass: true
    });
    console.log(`Baseline initialized: ${baselinePath}`);
    return;
  }

  const baseline = loadPng(baselinePath);
  const current = loadPng(currentPath);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error("Baseline and current image dimensions do not match.");
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: 0.1 }
  );

  const total = baseline.width * baseline.height;
  const diffRatio = total === 0 ? 0 : diffPixels / total;
  const pass = diffRatio <= threshold;

  ensureDir(path.dirname(diffPath));
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  writeJson(reportPath, {
    success: pass,
    generatedAt: nowIso(),
    baselinePath,
    currentPath,
    diffPath,
    width: baseline.width,
    height: baseline.height,
    diffPixels,
    diffRatio,
    threshold,
    pass
  });

  if (!pass) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  writeJson("artifacts/visual-report.json", {
    success: false,
    generatedAt: nowIso(),
    error: error.message
  });
  process.exit(1);
}
