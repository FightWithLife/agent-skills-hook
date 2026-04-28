const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseArgs } = require("./_utils");

function runNode(scriptPath, args = []) {
  const fullArgs = [scriptPath, ...args];
  const result = spawnSync(process.execPath, fullArgs, {
    stdio: "inherit",
    env: process.env
  });
  return result.status === 0;
}

function main() {
  const args = parseArgs(process.argv);
  const requirementPath = args.requirement || "input/requirement.txt";
  const initBaseline = Boolean(args["init-baseline"]);
  let ok = true;

  const scriptsDir = __dirname;
  const run = (file, runArgs) => runNode(path.join(scriptsDir, file), runArgs);

  if (fs.existsSync(requirementPath)) {
    ok = run("spec-from-requirement.js", ["--input", requirementPath]) && ok;
    ok = run("make-dev-plan.js", []) && ok;
  }

  ok = run("ci-preview.js", []) && ok;
  ok = run("e2e-smoke.js", []) && ok;

  const visualArgs = [];
  if (initBaseline) {
    visualArgs.push("--init-baseline");
  }
  ok = run("visual-compare.js", visualArgs) && ok;

  const judgeOk = run("generate-report.js", []);
  ok = judgeOk && ok;

  if (!ok) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
