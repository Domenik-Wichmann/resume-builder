import { readFile, writeFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
// Historical scripts generate derived reports in place. Run their assertions,
// then restore exactly the pre-verification bytes, including failures/accounting.
const commands = {
  qualification: [
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "experiments/career-brain/run.ts",
      "--stage=offline",
    ],
    ["--import", "tsx", "experiments/career-brain/revisions.ts"],
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "tests/qualification.test.ts",
      "tests/provider-accounting.test.ts",
    ],
  ],
  requalification: [
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "experiments/career-brain/v2/run.ts",
      "--stage=offline",
    ],
    ["node_modules/vitest/vitest.mjs", "run", "tests/career-repair.test.ts"],
  ],
  "continuation:qualification": [
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "experiments/career-brain/v2/continuation/run.ts",
      "--stage=verify-preserved",
    ],
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "experiments/career-brain/v2/continuation/report.ts",
    ],
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "tests/career-continuation.test.ts",
    ],
  ],
  "claim-repair:qualification": [
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "experiments/career-brain/v2/claim-repair/run.ts",
      "--stage=verify-preserved",
    ],
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "experiments/career-brain/v2/claim-repair/report.ts",
    ],
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "tests/career-claim-repair.test.ts",
    ],
  ],
};
const selected = commands[process.argv[2]];
if (!selected) throw new Error("Unknown offline qualification suite");
if (process.env.APP_MODE !== "demo")
  throw new Error("Offline qualification needs explicit APP_MODE=demo");
const original = new Map();
async function snapshot(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${file.name}`;
    if (file.isDirectory()) await snapshot(path);
    else original.set(path, await readFile(path));
  }
}
for (const dir of [
  "experiments/career-brain/results",
  "experiments/career-brain/v2/results",
  "experiments/career-brain/v2/continuation/results",
  "experiments/career-brain/v2/claim-repair/results",
])
  await snapshot(dir);
try {
  for (const args of selected)
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        stdio: "inherit",
        env: process.env,
      });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Qualification failed (${code})`)),
      );
    });
} finally {
  let restored = 0;
  for (const [path, bytes] of original) {
    if (!(await readFile(path)).equals(bytes)) {
      await writeFile(path, bytes);
      restored++;
    }
  }
  console.log(
    JSON.stringify({
      historicalFilesPreserved: original.size,
      generatedReportsRestored: restored,
    }),
  );
}
