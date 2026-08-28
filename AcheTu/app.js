const passwordInput = document.querySelector('#password');
const checkButton = document.querySelector('#checkButton');
const toggleButton = document.querySelector('.toggle-password');
const form = document.querySelector('#checkForm');
const result = document.querySelector('#result');
const resultIcon = document.querySelector('#resultIcon');
const resultKicker = document.querySelector('#resultKicker');
const resultTitle = document.querySelector('#resultTitle');
const resultPassword = document.querySelector('#resultPassword');
const resultText = document.querySelector('#resultText');
const loader = document.querySelector('#loader');
const fileInput = document.querySelector('#wordlistInput');
const sourceStatus = document.querySelector('#sourceStatus');
const connection = document.querySelector('.connection');
const wordCount = document.querySelector('#wordCount');

let passwords = null;

function updateReady(set, origin) {
  passwords = set;
  passwordInput.disabled = false;
  checkButton.disabled = false;
  toggleButton.disabled = false;
  sourceStatus.textContent = 'SAMBA TU / BASE LOCAL ATIVA';
  connection.classList.add('ready');
  wordCount.textContent = `${new Intl.NumberFormat('pt-BR').format(set.size)} ENTRADAS / ${origin}`;
  loader.hidden = true;
}

function parseWordlist(text, origin) {
  const entries = text.split(/\r?\n/).map(value => value.replace(/\r$/, '')).filter(Boolean);
  if (!entries.length) throw new Error('A wordlist não possui entradas válidas.');
  updateReady(new Set(entries), origin);
}

async function loadBundledList() {
  try {
    const response = await fetch('./data/SambaTu.txt', { cache: 'no-store' });
    if (!response.ok) throw new Error('Wordlist local ausente');
    parseWordlist(await response.text(), 'ARQUIVO INCLUSO');
  } catch {
    sourceStatus.textContent = 'AGUARDANDO WORDLIST LOCAL';
    loader.hidden = false;
  }
}

fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files;
  if (!file) return;
  sourceStatus.textContent = 'PROCESSANDO WORDLIST…';
  try { parseWordlist(await file.text(), 'ARQUIVO SELECIONADO'); }
  catch (error) { sourceStatus.textContent = 'FALHA AO LER WORDLIST'; alert(error.message); }
});

toggleButton.addEventListener('click', () => {
  const concealed = passwordInput.type === 'password';
  passwordInput.type = concealed ? 'text' : 'password';
  toggleButton.setAttribute('aria-label', concealed ? 'Ocultar senha' : 'Mostrar senha');
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const candidate = passwordInput.value;
  if (!candidate || !passwords) return;
  const exposed = passwords.has(candidate);
  result.hidden = false;
  result.className = `result ${exposed ? 'exposed' : 'safe'}`;
  resultIcon.textContent = exposed ? '!' : '✓';
  resultKicker.textContent = exposed ? 'ALERTA / ENCONTRADA' : 'RESULTADO / NÃO ENCONTRADA';
  resultTitle.textContent = exposed ? 'Senha presente na SambaTu.' : 'Senha não encontrada na SambaTu.';
  resultPassword.textContent = candidate;
  resultText.textContent = exposed
    ? 'Não use esta senha. Troque-a por uma senha longa, única e armazenada em um gerenciador de senhas.'
    : 'Esta consulta cobre somente a wordlist SambaTu e não confirma que a senha nunca apareceu em outro vazamento.';
  passwordInput.value = '';
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

loadBundledList();
