# Proxy

![Proxy image](/images/hackingclub-proxy/file-proxy-2025-4.png)

## Sumário

Durante a análise do código, foi identificado que a rota `/proxy` recebe um parâmetro `url` e o passa diretamente como argumento para a função `axios(url)`.
Por padrão, espera-se que a `url` seja uma string contendo o endereço a ser requisitado.

Entretanto, segundo a documentação do Axios, a função também aceita um `objeto de configuração`, que pode incluir propriedades como `method`, `url`, `headers` e outros parâmetros.
Esse comportamento introduz uma vulnerabilidade de `Type Confusion` — ou seja, o programa assume que a variável url será uma string, mas aceita e processa um tipo diferente `(um objeto)`, alterando completamente a lógica de execução.

## Analisando o código fonte

Durante o code-review da rota /proxy, verificou-se que ela recebe um parâmetro url, o qual é utilizado diretamente pela biblioteca Axios para realizar requisições a endpoints internos. O resultado dessas requisições é então retornado integralmente ao cliente pela linha `return res.json({ response: response.data })`.

![Proxy](/images/hackingclub-proxy/file-proxy-2025-2.png)

### Rota interna

O código define uma rota GET que só pode ser acessada por endereços IP internos e mediante uma chave de API específica.

![Internals](/images/hackingclub-proxy/file-proxy-2025-3.png)


## Documentação da API do Axios e burlando a função

![ApiAxios](/images/hackingclub-proxy/file-proxy-2025-5.png)

Além de aceitar uma string com a URL, a API do Axios também permite receber um objeto de configuração (contendo campos como method, url, headers, etc.). Essa flexibilidade foi explorada para contornar validações simples que assumem que `url` é apenas uma string.

```bash
curl -X POST http://10.10.0.5:8000/proxy -H "Content-Type: application/json" -d '{"url":{"method":"GET", "url":"http://127.0.0.1:8000/internal", "headers":{"x-api-key": "1841f865-19ce-45b5-a477-8acacfda89e7"}}}'
```

![Flag](/images/hackingclub-proxy/file-proxy-2025-1.png)