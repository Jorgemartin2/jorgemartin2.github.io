# SkyWings

![Skywings](/images/hackingclub-skywings/file-skywings-2025-3.png)

# Sumário

Uma vulnerabilidade nota 10 atingiu `React` e `Next.js` `(CVE-2025-55182 e CVE-2025-66478)`, permitindo que um simples objeto seja convertido em `execução remota de código (RCE)` sem autenticação, sem endpoints expostos e até em aplicações padrão criadas com `create-next-app`.

### Referência

- [Uma vulnerabilidade nota 10 atingiu React e Next.js (CVE-2025-55182 e CVE-2025-66478)](https://blog.crowsec.com.br/uma-vulnerabilidade-nota-10-atingiu-react-e-next-js-cve-2025-55182-e-cve-2025-66478/)

## Explorando a vulnerabilidade

Após identificarmos que o servidor apresentava a vulnerabilidade, utilizamos a prova de conceito (PoC)referente à `CVE-2025-55182` para obter uma shell no servidor. A PoC, juntamente com a documentação detalhada da vulnerabilidade e de seu impacto nos servidores, está disponível no repositório do GitHub indicado abaixo.

- [PoC CVE-2025-55182](https://github.com/msanft/CVE-2025-55182)

![PoC](/images/hackingclub-skywings/file-skywings-2025-1.png)
![Shell](/images/hackingclub-skywings/file-skywings-2025-2.png)

> ⚠️ Lembre-se de incluir o comando de shell diretamente no código, caso a execução não ocorra por meio do terminal passando como parâmetro.
{: .prompt-warning}