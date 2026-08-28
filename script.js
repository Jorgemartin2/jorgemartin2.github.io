const canvas = document.querySelector("#matrix");
const context = canvas.getContext("2d");
const glyphs = "01{}[]<>/\\#$ sudo nmap whoami shell AD RCE XSS";
let drops = [];
let fontSize = 16;

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const columns = Math.ceil(window.innerWidth / fontSize);
  drops = Array.from({ length: columns }, () => Math.random() * window.innerHeight);
}

function drawMatrix() {
  context.fillStyle = "rgba(8, 7, 19, 0.13)";
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
  context.font = `${fontSize}px "JetBrains Mono", monospace`;

  drops.forEach((y, index) => {
    const char = glyphs[Math.floor(Math.random() * glyphs.length)];
    const x = index * fontSize;
    const hue = index % 3 === 0 ? "#ff3df2" : index % 3 === 1 ? "#35a7ff" : "#ffc857";
    context.fillStyle = hue;
    context.fillText(char, x, y);

    drops[index] = y > window.innerHeight + Math.random() * 1200 ? 0 : y + fontSize;
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.setInterval(drawMatrix, 58);
}

async function loadLastUpdate() {
  const element = document.querySelector("#last-update");

  if (!element) return;

  try {
    const response = await fetch("/last-update.txt", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Não foi possível obter a data do último update.");
    }

    const isoDate = (await response.text()).trim();
    const date = new Date(isoDate);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Data inválida.");
    }

    element.dateTime = date.toISOString();

    element.textContent = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

  } catch (error) {
    console.error("Erro ao carregar último update:", error);
    element.textContent = "indisponível";
  }
}

loadLastUpdate();