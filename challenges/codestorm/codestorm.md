# CodeStorm

![CodeStorm](/images/hackingclub-codestorm/file-codestorm-2026-1.png)

## SQLi

Ao realizar o code review da aplicação, observamos que, na rota `code-request`, a consulta utilizada para verificar o e-mail no banco de dados `(Linha 78)` é construída sem qualquer tipo de sanitização ou parametrização da entrada do usuário.

![Code](/images/hackingclub-codestorm/file-codestorm-2026-2.png)

Nesse caso, o valor fornecido pelo usuário é concatenado diretamente na query SQL. Essa prática é insegura, pois permite que um atacante `injete comandos SQL maliciosos` no campo de e-mail.
Dessa forma, identificamos a possibilidade de explorar uma vulnerabilidade de `SQL Injection (SQLi)` nessa rota, já que a aplicação não realiza validação ou uso de queries parametrizadas/prepared statements para tratar a entrada do usuário.


Com isso, por meio da aplicação web, acessamos a rota utilizando o botão `“Login with Code”`. Em seguida, interceptamos a requisição e inserimos a payload de SQL Injection (SQLi) mostrada abaixo.

![Web](/images/hackingclub-codestorm/file-codestorm-2026-3.png)

```bash
' or 1 = 1 -- -
```

![SQLi](/images/hackingclub-codestorm/file-codestorm-2026-4.png)

Após contornar a validação de e-mail por meio da exploração da vulnerabilidade de SQL Injection, a aplicação redireciona o usuário para a etapa de `verificação do código` enviado por e-mail.

![Code Verify](/images/hackingclub-codestorm/file-codestorm-2026-5.png)

Durante a análise da lógica implementada nessa rota, foi possível observar que o mecanismo de verificação apresenta fragilidades. O código de autenticação é composto exclusivamente por caracteres numéricos e possui apenas quatro dígitos, o que reduz significativamente o espaço de busca e, consequentemente, a entropia do mecanismo de validação.

Além disso, a implementação não realiza validação adequada do tipo de dado recebido no parâmetro `code`. O valor proveniente de `req.body (Linha 112)` é utilizado diretamente na consulta ao banco de dados por meio do ORM, sem qualquer verificação ou normalização prévia. Essa ausência de validação permite o envio de estruturas de dados inesperadas, como `arrays ([])`, em vez de um valor escalar (string ou número).

![Code](/images/hackingclub-codestorm/file-codestorm-2026-6.png)

Como resultado, ocorre uma condição de `Type Confusion`, na qual o backend espera um valor simples para comparação, mas recebe um `tipo diferente`. Dependendo da forma como o JavaScript, o ORM (Sequelize) ou o banco de dados tratam essa conversão implícita de tipos, a comparação pode se comportar de maneira inesperada, possibilitando `bypass` da verificação do código e comprometendo o fluxo de autenticação.

![Bypass](/images/hackingclub-codestorm/file-codestorm-2026-7.png)

Código em bash que gera um array numérico de 0001 á 9999.

```bash
#!/bin/bash

for i in $(seq 1 9999); do
    printf ""%04d",\n" "$i"
done
```

![Bypass](/images/hackingclub-codestorm/file-codestorm-2026-8.png)