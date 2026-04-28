const fs = require("fs");
const path = require("path");
const { nowIso, parseArgs, readJson, writeJson } = require("./_utils");

function main() {
  const args = parseArgs(process.argv);
  const specPath = args.spec || "artifacts/spec.json";
  const outputPath = args.output || "artifacts/plan.json";

  if (!fs.existsSync(specPath)) {
    throw new Error(`Spec file not found: ${specPath}`);
  }

  const spec = readJson(specPath);
  const tasks = [
    {
      id: "preview",
      title: "Generate WeChat preview artifact",
      command: "npm run wx:preview",
      dependsOn: []
    },
    {
      id: "e2e",
      title: "Run smoke interactions",
      command: "npm run wx:e2e",
      dependsOn: ["preview"]
    },
    {
      id: "visual",
      title: "Run screenshot diff",
      command: "npm run wx:visual",
      dependsOn: ["e2e"]
    },
    {
      id: "judge",
      title: "Generate acceptance report",
      command: "npm run wx:judge",
      dependsOn: ["visual"]
    }
  ];

  const plan = {
    meta: {
      generatedAt: nowIso(),
      sourceSpec: path.resolve(specPath)
    },
    scope: {
      pages: spec.pages || [],
      acceptanceCriteria: spec.acceptanceCriteria || []
    },
    tasks
  };

  writeJson(outputPath, plan);
  console.log(`Plan generated: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
