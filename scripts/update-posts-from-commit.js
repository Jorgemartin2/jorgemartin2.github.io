const fs = require("fs");
const { execSync } = require("child_process");

const POSTS_FILE = "posts.json";

const changedFiles = execSync(
  "git diff-tree --no-commit-id --name-only -r HEAD",
  { encoding: "utf8" }
)
  .split("\n")
  .filter(f => f.startsWith("posts/") && f.endsWith(".md"));

if (!changedFiles.length) {
  console.log("Nenhum post Markdown modificado.");
  process.exit(0);
}

const commitDate = execSync(
  "git show -s --format=%cd --date=format:'%b %d, %Y'",
  { encoding: "utf8" }
).trim();

const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));

let updated = false;

posts.forEach(post => {
  if (changedFiles.includes(post.file)) {
    post.update = commitDate;
    updated = true;
    console.log(`Atualizado: ${post.file} → ${commitDate}`);
  }
});

if (updated) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
} else {
  console.log("Post modificado não encontrado no posts.json.");
}
