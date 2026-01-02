# UltraCars

![UltraCars](/images/hackingclub-ultracars/file-ultracars-2026-1.png)

# Sumário

Foi identificado o uso de `pickle` para desserialização de dados controlados pelo usuário, configurando uma falha de `desserialização insegura` com potencial de `execução remota de código (RCE)`.

### Referência
- [Exploiting Python pickles](https://davidhamann.de/2020/04/05/exploiting-python-pickle/)

## Code Review / Explorando a vulnerabilidade
Durante o code review da aplicação, o arquivo `view.py` chamou atenção por concentrar a maior parte da lógica de fluxo da aplicação. Ao analisar detalhadamente as funções presentes nesse arquivo, identificamos que a função `edit_profile` contém uma linha de código que utiliza a biblioteca `pickle` para desserializar dados fornecidos diretamente pelo usuário.

```bash
description = pickle.loads(base64.b64decode(description_data))
```

![Code](/images/hackingclub-ultracars/file-ultracars-2026-2.png)

Uma análise mais aprofundada sobre o funcionamento da biblioteca `pickle` revelou que seu uso em cenários onde os dados não são confiáveis pode introduzir uma vulnerabilidade crítica de `desserialização insegura`. Essa vulnerabilidade ocorre porque o processo de desserialização em pickle permite a execução de código arbitrário durante a reconstrução dos objetos, caso o payload tenha sido manipulado de forma maliciosa.

Dessa forma, a utilização de pickle para desserializar dados controlados pelo usuário expõe a aplicação a riscos significativos, incluindo `Remote Code Execution (RCE)`. Ao aprofundarmos a pesquisa, identificamos diversos artigos e referências que documentam essa vulnerabilidade e seus impactos, conforme apresentado a seguir.

![Application](/images/hackingclub-ultracars/file-ultracars-2026-3.png)
![Burp](/images/hackingclub-ultracars/file-ultracars-2026-4.png)
![Exploit](/images/hackingclub-ultracars/file-ultracars-2026-5.png)
![Flag](/images/hackingclub-ultracars/file-ultracars-2026-6.png)
