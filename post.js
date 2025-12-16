async function posts() {
  const response = await fetch('posts.json');
  const posts = await response.json();
  const container = document.getElementById('posts');

  posts.forEach(post => {
    const card = document.createElement('a');
    card.className = 'post-card';
    card.href = '#';

    card.style.backgroundImage = `url(${post.image})`;
    card.style.backgroundSize = '30% auto';
    card.style.backgroundPosition = '100% center';
    card.style.backgroundRepeat = 'no-repeat';

    card.innerHTML = `
      <div class="post-text">
        <h3>${post.title}</h3>
        <p>${post.summary}</p>
        <div class="post-meta">
          <span>📅 Postado em ${post.date}</span> • <span>📅 Atualizado em ${post.update}</span>
          <span>🏷️ ${post.category}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      e.preventDefault();
      showDetails(post);
    });

    container.appendChild(card);
  });
}

async function showDetails(post) {
  const container = document.getElementById('posts');
  const details = document.getElementById('post-details');

  const response = await fetch(post.file);
  const markdown = await response.text();

  const promptExtension = () => [{
    type: 'lang',
    regex: /(^>[\s\S]*?)\s*\{\:\s*\.([\w-]+)\s*\}/gm,
    replace: (match, content, cls) => {
      const inner = content.replace(/^>\s?/gm, '').trim();
      return `<blockquote class="${cls}">${inner}</blockquote>`;
    }
  }];

  const convert = new showdown.Converter({
    tables: true,
    ghCodeBlocks: true,
    extensions: [promptExtension]
  });

  let html = convert.makeHtml(markdown);

  const postDir = post.file.replace(/[^/]*$/, '');

    html = html.replace(/(?:src|href)="(?!https?:|#)([^"]+)"/g, (m, p1) => {
    if (p1.startsWith('/')) {
        return m; 
    }

    const newPath = postDir + p1;
    return m.replace(p1, newPath);
    });

  details.style.display = 'block';
  container.style.display = 'none';
  details.innerHTML = `
    <button id="back" class="back-button">⬅️ Voltar</button>
    <div class="post-body markdown-body">${html}</div>
    <div class="post-meta">
      <span>📅 ${post.date}</span>
      <span>🏷️ ${post.category}</span>
      <span>👨🏻‍💻 ${post.author}</span>
    </div>
  `;

  document.querySelectorAll('pre code').forEach(block => {
    if (window.hljs) hljs.highlightElement(block);
  });

  document.getElementById('back').addEventListener('click', () => {
    details.style.display = 'none';
    container.style.display = 'flex';
  });

  const btn = document.getElementById("scrollTopBtn");

  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY + window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (scrollTop >= docHeight - 5) {
      btn.classList.add("show");
    } else {
      btn.classList.remove("show");
    }
  });

  btn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}

document.addEventListener('DOMContentLoaded', posts);