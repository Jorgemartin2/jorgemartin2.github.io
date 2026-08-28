# AcheTu

Verificador local de presença de senha na wordlist brasileira [SambaTu](https://github.com/HideMeBr/SambaTu).

Não há API, envio de senha ou consulta a bases adicionais: a comparação é feita no navegador contra `data/SambaTu.txt`.

## Executar

Abra `index.html` com um servidor local. Exemplo:

```powershell
py -m http.server 8080
```

Em seguida, acesse `http://localhost:8080`.

Caso a wordlist não esteja em `data/SambaTu.txt`, a interface permite selecioná-la manualmente. Baixe o arquivo oficial `SambaTu.txt` do repositório de origem e coloque-o na pasta `data`.

Use somente em auditorias e ambientes autorizados.
