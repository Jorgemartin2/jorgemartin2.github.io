const fs = require("fs");
const { execSync } = require("child_process");

const CONFIG = [
  {
    json: "posts.json",
    folder: "posts/",
    stripFolder: false,
    label: "Post"
  },
  {
    json: "challenges/challenges.json",
    folder: "challenges/",
    stripFolder: true,
    label: "Challenge"
  }
];

const changedFiles = execSync(
  "git diff-tree --no-commit-id --name-only -r HEAD",
  { encoding: "utf8" }
)
  .split("\n")
  .filter(f => f.endsWith(".md"));

if (!changedFiles.length) {
  console.log("Nenhum Markdown modificado.");
  process.exit(0);
}

const commitDate = execSync(
  "git show -s --format=%cd --date=format:'%b %d, %Y'",
  { encoding: "utf8" }
).trim();

let somethingUpdated = false;

CONFIG.forEach(({ json, folder, stripFolder, label }) => {
  if (!fs.existsSync(json)) return;

  const data = JSON.parse(fs.readFileSync(json, "utf8"));
  let updated = false;

  const relevantFiles = changedFiles
    .filter(f => f.startsWith(folder))
    .map(f => stripFolder ? f.replace(folder, "") : f);

  data.forEach(item => {
    if (item.file && relevantFiles.includes(item.file)) {
      item.update = commitDate;
      updated = true;
      somethingUpdated = true;
      console.log(`${label} atualizado: ${item.file} → ${commitDate}`);
    }
  });

  if (updated) {
    fs.writeFileSync(json, JSON.stringify(data, null, 2));
  }
});

if (!somethingUpdated) {
  console.log("Nenhum post ou challenge correspondente encontrado.");
}