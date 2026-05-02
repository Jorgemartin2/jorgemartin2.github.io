# Anomaly

![Anomaly](/images/hackingclub-anomaly/file-anomaly-2026-1.png)

## Sumário

A enumeração inicial da aplicação revelou uma configuração incorreta das políticas de segurança `(Row Level Security – RLS)` do `Supabase`, permitindo acesso indevido ao banco de dados utilizando a `anon key`. Essa falha possibilitou a realização de requisições diretas à `API REST`, resultando na leitura arbitrária de tabelas sensíveis.

Durante a análise dos dados expostos, foi identificada a tabela `access_logs`, a qual, do ponto de vista arquitetural, é comumente utilizada para armazenar registros de auditoria, como tentativas de login, ações de usuários e metadados operacionais. Devido à má configuração de segurança, essa tabela continha informações críticas, incluindo credenciais de acesso `SSH`, que foram reutilizadas para obtenção de acesso inicial ao sistema.

Após o comprometimento da máquina via SSH, foi realizada a fase de pós-exploração, onde se identificou que o binário `gdb` possuía a `capability cap_dac_override=ep`. Essa configuração permite ignorar controles de permissão do sistema de arquivos, possibilitando acesso irrestrito a arquivos protegidos, independentemente das permissões padrão.

Explorando essa capability, foi possível realizar diversas técnicas de escalada de privilégios, incluindo:

- Criação de um novo usuário com privilégios de root
- Alteração da senha do usuário root
- Adição do usuário comprometido ao grupo sudo com privilégios totais
- Inclusão de chave SSH em /root/.ssh/authorized_keys
- Criação de tarefas agendadas (crontab) para atribuição de permissões SUID ao /bin/bash
- Leitura direta de arquivos sensíveis no diretório /root

Como resultado, foi obtido controle completo do sistema, culminando na leitura da root flag.

## Varredura

Foi realizada uma varredura de portas no servidor com o objetivo de identificar serviços expostos e portas abertas.

```bash
nmap -sS -sV -Pn anomaly.hc
```

**Resultado**

```
PORT     STATE SERVICE       VERSION
22/tcp   open  ssh           OpenSSH 9.6p1 Ubuntu 3ubuntu13.15 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http          Apache httpd 2.4.58 ((Ubuntu))
5432/tcp open  postgresql?
6543/tcp open  mythtv?
8000/tcp open  http-alt      kong/3.9.1
8443/tcp open  ssl/https-alt kong/3.9.1
```

## Enumeração

Durante a fase de enumeração da aplicação web, a análise dos headers HTTP revelou a presença de uma `apikey` incluída em todas as requisições. Esse comportamento indicou a utilização de uma API baseada em `Supabase`, levantando a hipótese de possível exposição indevida de dados.

![App Web](/images/hackingclub-anomaly/file-anomaly-2026-2.png)

Com base nisso, foram realizadas requisições diretamente à `API REST` disponível na porta `8000`, com o objetivo de validar a correta configuração das políticas de segurança `(Row Level Security – RLS)`.

Foi constatado que as políticas de RLS não estavam devidamente configuradas, permitindo que a `anon key` fosse utilizada para acessar diretamente o banco de dados. Como consequência, tornou-se possível enumerar tabelas e extrair informações sensíveis sem necessidade de autenticação, caracterizando uma falha crítica de controle de acesso.

![JWT](/images/hackingclub-anomaly/file-anomaly-2026-16.png)
![Anon Key](/images/hackingclub-anomaly/file-anomaly-2026-4.png)
![Tables](/images/hackingclub-anomaly/file-anomaly-2026-5.png)

## SSH

Com as políticas de Row Level Security (RLS) configuradas incorretamente, foi possível realizar a enumeração das tabelas do banco de dados e extrair informações sensíveis.

Durante essa análise, destacou-se a tabela `access_logs`, que armazenava registros operacionais e de automação do sistema. Entre os dados coletados, foi identificado um comando utilizado em uma rotina automatizada de backup, executada possivelmente via crontab.

![Table access_logs](/images/hackingclub-anomaly/file-anomaly-2026-6.png)

O registro continha credenciais expostas em texto claro, incluindo o uso da ferramenta sshpass para autenticação não interativa:

```
sshpass -p 'BkpServer#2024' ssh rhbackup@172.16.4.115 -p 22 ./backup.sh
```

A presença desse comando indica que o sistema realizava conexões SSH automatizadas utilizando o usuário `rhbackup`, permitindo a reutilização direta dessas credenciais para obtenção de acesso inicial ao servidor.

![SSH](/images/hackingclub-anomaly/file-anomaly-2026-7.png)

## Privilege Escalation

Após a obtenção de acesso ao host comprometido, foi iniciada a fase de pós-exploração com foco na identificação de vetores de escalada de privilégios. Durante a enumeração, foi identificado que o binário `gdb` possuía a capability `cap_dac_override=ep` habilitada.

![Capability GDB](/images/hackingclub-anomaly/file-anomaly-2026-8.png)

Essa capability permite ignorar completamente os mecanismos de controle de acesso baseados em permissões de arquivos `(Discretionary Access Control – DAC)`, possibilitando que qualquer usuário com acesso ao binário leia, modifique ou interaja com arquivos e diretórios restritos, independentemente das permissões definidas pelo sistema.

Na prática, isso amplia significativamente a superfície de ataque, uma vez que o gdb pode ser utilizado como um vetor para acessar conteúdos sensíveis, como arquivos pertencentes ao usuário `root`, além de potencialmente permitir a modificação de arquivos críticos do sistema, resultando na escalada de privilégios.

### Payloads

**1 – Criação de usuário com privilégios elevados**

O primeiro payload teve como objetivo a criação de um novo usuário com privilégios equivalentes ao usuário root. Com isso, foi possível modificar diretamente arquivos sensíveis do sistema, como o `/etc/passwd`.

Inicialmente, foi gerado um hash de senha utilizando a ferramenta `OpenSSL`. Em seguida, um novo usuário denominado `r0ot` foi inserido manualmente nos arquivos de autenticação do sistema com `UID 0`, garantindo privilégios administrativos completos.

![NewUserR0ot](/images/hackingclub-anomaly/file-anomaly-2026-9.png)

**2 - Alteração da senha do usuário root**

A senha do usuário root foi redefinida através da modificação direta do arquivo `/etc/shadow`, explorando a capability cap_dac_override via gdb. Um novo hash foi gerado com o OpenSSL e injetado no campo do usuário root, permitindo autenticação com a nova senha, conforme demonstrado na imagem.

![UpdatePasswordRoot](/images/hackingclub-anomaly/file-anomaly-2026-10.png)

**3 - Adição do usuário ao sudoers**

Outra abordagem consistiu na modificação do arquivo `/etc/sudoers`. Foi adicionada uma entrada concedendo privilégios totais ao usuário `rhbackup (ALL=(ALL:ALL) ALL)`, permitindo a execução de comandos como root através do sudo, conforme evidenciado na imagem.

![Sudoers](/images/hackingclub-anomaly/file-anomaly-2026-11.png)

**4 - Adição de chave SSH ao root**

Outra técnica consistiu na geração de um par de chaves SSH localmente e na inserção da chave pública no arquivo `/root/.ssh/authorized_keys`. Explorando a capability, foi possível escrever nesse diretório restrito, permitindo autenticação direta como root via SSH sem necessidade de senha.

![SSH](/images/hackingclub-anomaly/file-anomaly-2026-12.png)
![SSH](/images/hackingclub-anomaly/file-anomaly-2026-13.png)

**5 - Persistência via cron (SUID em /bin/bash)**

A quinta abordagem consistiu na criação de uma tarefa agendada `(crontab)` responsável por atribuir a permissão `SUID` ao binário `/bin/bash`. Contudo, foi possível escrever no diretório de tarefas do sistema, fazendo com que o comando fosse executado periodicamente como root.

Como resultado, o /bin/bash passou a executar com privilégios elevados, permitindo a obtenção de shell como root a qualquer momento.

![Chmod](/images/hackingclub-anomaly/file-anomaly-2026-14.png)

**6 – Leitura direta do diretório /root**

A sexta abordagem consistiu na utilização da capability para acessar diretamente o diretório `/root`. Com essa permissão, foi possível ignorar as restrições de acesso e listar, bem como ler, os arquivos presentes nesse diretório, incluindo a root flag.

![File Read](/images/hackingclub-anomaly/file-anomaly-2026-15.png)