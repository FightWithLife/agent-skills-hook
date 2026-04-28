const fs = require("fs");
const path = require("path");
const { nowIso, parseArgs, writeJson } = require("./_utils");

function unique(items) {
  return [...new Set(items)];
}

function extractByRegex(text, regex) {
  const out = [];
  let match = regex.exec(text);
  while (match) {
    out.push(match[0]);
    match = regex.exec(text);
  }
  return unique(out);
}

function buildAcceptance(lines) {
  const list = lines
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line));
  if (list.length > 0) {
    return list;
  }
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 8)
    .map((line) => `- ${line}`);
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.input || "input/requirement.txt";
  const outputPath = args.output || "artifacts/spec.json";

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Requirement file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const lines = raw.split(/\r?\n/);

  const pages = extractByRegex(raw, /\/pages\/[a-zA-Z0-9/_-]+/g);
  const screenshots = extractByRegex(raw, /[a-zA-Z0-9/_-]+\.(png|jpg|jpeg)/gi);
  const acceptanceCriteria = buildAcceptance(lines);

  const spec = {
    meta: {
      generatedAt: nowIso(),
      sourceFile: path.resolve(inputPath)
    },
    requirementText: raw,
    pages,
    acceptanceCriteria,
    expectedScreenshots: screenshots
  };

  writeJson(outputPath, spec);
  console.log(`Spec generated: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
