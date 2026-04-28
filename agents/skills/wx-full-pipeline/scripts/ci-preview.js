const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const ci = require("miniprogram-ci");
const { ensureDir, nowIso, parseArgs, writeJson } = require("./_utils");

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv);
  const appid = requireEnv("APPID");
  const privateKeyPath = path.resolve(requireEnv("PRIVATE_KEY_PATH"));
  const projectPath = path.resolve(process.env.PROJECT_PATH || process.cwd());
  const robot = Number(process.env.ROBOT || 1);
  const version = process.env.VERSION || "0.0.1";
  const desc = process.env.DESC || "wx auto preview";
  const pagePath = process.env.PREVIEW_PAGE || "pages/index/index";
  const qrcodeOutputDest = path.resolve(args.qrcode || "artifacts/preview-qrcode.jpg");
  const resultPath = path.resolve(args.output || "artifacts/preview-result.json");

  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Private key file not found: ${privateKeyPath}`);
  }

  ensureDir(path.dirname(qrcodeOutputDest));

  const project = new ci.Project({
    appid,
    type: "miniProgram",
    projectPath,
    privateKeyPath,
    ignores: ["node_modules/**/*"]
  });

  await ci.preview({
    project,
    version,
    desc,
    setting: {
      es6: true,
      es7: true,
      minify: true
    },
    robot,
    pagePath,
    qrcodeFormat: "image",
    qrcodeOutputDest,
    onProgressUpdate(info) {
      if (info && typeof info === "object") {
        console.log(`preview progress: ${JSON.stringify(info)}`);
      }
    }
  });

  writeJson(resultPath, {
    success: true,
    generatedAt: nowIso(),
    appid,
    robot,
    projectPath,
    pagePath,
    qrcodeOutputDest
  });
  console.log(`Preview completed: ${resultPath}`);
}

main().catch((error) => {
  console.error(error.message);
  writeJson("artifacts/preview-result.json", {
    success: false,
    generatedAt: nowIso(),
    error: error.message
  });
  process.exit(1);
});
