const fs = require("fs");
const { execSync } = require("child_process");

const CONFIG = [
  {
    json: "posts.json",
    folder: "posts/",
    label: "Post"
  },
  {
    json: "challenges/challenges.json",
    folder: "challenges/",
    label: "Challenge"
  }
];

const changedFiles = execSync(
  "git diff-tree --no-commit-id --name-only -r HEAD",
  { encoding: "utf8" }
)
  .split("\n")
  .filter(Boolean);

const commitDate = execSync(
  "git show -s --format=%cd --date=format:'%b %d, %Y'",
  { encoding: "utf8" }
).trim();

let somethingUpdated = false;

CONFIG.forEach(({ json, folder, label }) => {
  const relevantChanges = changedFiles.filter(
    f => f.startsWith(folder) && f.endsWith(".md")
  );

  if (!relevantChanges.length) return;

  const items = JSON.parse(fs.readFileSync(json, "utf8"));
  let updated = false;

  items.forEach(item => {
    if (relevantChanges.includes(item.file)) {
      item.update = commitDate;
      updated = true;
      somethingUpdated = true;
      console.log(`${label} atualizado: ${item.file} → ${commitDate}`);
    }
  });

  if (updated) {
    fs.writeFileSync(json, JSON.stringify(items, null, 2));
  }
});

if (!somethingUpdated) {
  console.log("Nenhum post ou challenge atualizado.");
}
