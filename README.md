# Plataforma de Mobilização, Transparência e Arrecadação
### Associação Beneficente Nossa Senhora de Piedade

Aplicação web para a ONG: site público (doações, campanhas, voluntariado e
transparência) + painel administrativo + API REST + banco MySQL (TiDB Cloud),
com **Inteligência Artificial gratuita** rodando no próprio servidor.

**Tudo gratuito:** hospedagem no **Render (plano Free)** + banco no **TiDB Cloud (plano Free)**.
Nenhum cartão de crédito ou API paga é necessário.

---

## Sumário
1. [Estrutura do projeto](#1-estrutura-do-projeto)
2. [Passo a passo: subir no GitHub pelo CMD](#2-passo-a-passo-subir-no-github-pelo-cmd)
3. [Passo a passo: criar o banco no TiDB Cloud](#3-passo-a-passo-criar-o-banco-no-tidb-cloud)
4. [Passo a passo: colocar no ar no Render](#4-passo-a-passo-colocar-no-ar-no-render)
5. [Primeiro acesso e uso](#5-primeiro-acesso-e-uso)
6. [Rodar no computador (opcional)](#6-rodar-no-computador-opcional)
7. [Segurança](#7-segurança)
8. [Inteligência Artificial](#8-inteligência-artificial)
9. [Requisitos atendidos](#9-requisitos-atendidos)
10. [Rotas da API](#10-rotas-da-api)
11. [Problemas comuns](#11-problemas-comuns)

---

## 1. Estrutura do projeto

```
ong-piedade/
├── server.js                  → ponto de entrada (API + site)
├── package.json               → dependências e comandos (npm start)
├── render.yaml                → configuração do Render
├── .env.example               → modelo das variáveis de ambiente (sem senhas)
├── database/
│   └── migrations/            → script do banco (criado automaticamente no 1º start)
│       ├── 001_schema_inicial.sql
│       ├── 002_dados_iniciais.sql
│       └── 003_historico_recebimentos.sql
├── src/                       → BACK-END (API REST)
│   ├── config.js              → leitura das variáveis de ambiente
│   ├── db/                    → conexão com o banco, migrações e admin inicial
│   ├── middleware/            → login (JWT), limite de requisições, erros
│   ├── routes/                → rotas públicas e do painel (/api/...)
│   ├── services/              → regras de doador e de pagamento
│   ├── ia/                    → INTELIGÊNCIA ARTIFICIAL
│   │   ├── texto.js           → processamento de linguagem natural (PLN)
│   │   ├── classificador.js   → Naive Bayes (aprendizado de máquina)
│   │   ├── assistente.js      → chatbot do site
│   │   ├── insights.js        → previsões e alertas (regressão linear)
│   │   └── recomendacao.js    → recomendação de voluntários para escalas
│   └── utils/                 → validações (CPF/CNPJ, e-mail...), datas
├── public/                    → FRONT-END (HTML5, CSS3, JavaScript)
│   ├── index.html, campanhas.html, doacao.html, cadastro.html,
│   │   transparencia.html, login.html, admin.html, 404.html
│   ├── css/style.css
│   ├── js/api.js, js/site.js, js/admin.js
│   ├── vendor/                → SweetAlert2 (pop-ups), sem depender de CDN
│   └── assets/                → logo e QR Code do PIX
└── docs/
    └── IA_E_CULTURA_DE_DADOS.md → capítulo da documentação sobre IA e Big Data
```

Front-end e back-end são separados em pastas e se comunicam **somente pela API REST**
(`/api/...`). Em produção, o próprio servidor Node entrega o site, então só é preciso
**um** serviço no Render.

---

## 2. Passo a passo: subir no GitHub pelo CMD

> Pré-requisito: ter o [Git](https://git-scm.com/download/win) instalado e acesso de
> escrita (commit/push) ao repositório.

1. **Baixe o repositório** (se ainda não tiver no computador). No CMD:
   ```cmd
   cd %USERPROFILE%\Desktop
   git clone https://github.com/USUARIO/NOME-DO-REPOSITORIO.git
   cd NOME-DO-REPOSITORIO
   ```
   Se já tiver a pasta, entre nela e atualize:
   ```cmd
   cd caminho\da\pasta\do\repositorio
   git pull
   ```

2. **Copie os arquivos deste projeto para dentro da pasta do repositório.**
   Extraia o zip e copie **o conteúdo** da pasta `ong-piedade` (os arquivos `server.js`,
   `package.json`, as pastas `src`, `public`, `database`... e também os arquivos ocultos
   `.gitignore`, `.env.example`, `.node-version`) para a raiz do repositório.

   > Se o repositório tinha a versão antiga (pasta `nsp-app`, `data/db.json`...), apague os
   > arquivos antigos antes de copiar, para não misturar as versões.

3. **Confira o que vai subir** (o arquivo `.env` e a pasta `node_modules` NÃO devem aparecer):
   ```cmd
   git status
   ```

4. **Faça o commit e envie:**
   ```cmd
   git add .
   git commit -m "Versão final: API Node + MySQL/TiDB, painel admin e IA"
   git push
   ```
   Na primeira vez o Git pode pedir login do GitHub (abre uma janela no navegador).

---

## 3. Passo a passo: criar o banco no TiDB Cloud

1. Acesse **https://tidbcloud.com** e crie uma conta gratuita (pode entrar com Google ou GitHub).
2. Crie um cluster gratuito:
   - Clique em **Create Cluster** e escolha o plano gratuito (**Starter / Serverless — Free**).
   - **Região:** escolha **AWS – N. Virginia (us-east-1)**. É a mesma do Render (Virginia) e deixa o site mais rápido.
   - Dê um nome (ex.: `ong-piedade`) e clique em **Create**. Leva cerca de 1 minuto.
3. Pegue a string de conexão:
   - No cluster, clique em **Connect**.
   - Em **Connect With**, escolha **General** (ou "Node.js / mysql2").
   - Clique em **Generate Password** (ou "Reset Password") e **guarde a senha**. Ela só aparece uma vez.
   - Copie a **connection string** no formato:
     ```
     mysql://XXXXXXXX.root:SENHA@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test
     ```
   - Se a tela mostrar os dados separados, monte a string assim:
     `mysql://USUARIO:SENHA@HOST:4000/test`.
     Se a senha tiver caracteres especiais (`@ # / ? :`), troque-os pelo código correspondente
     (ex.: `@` → `%40`, `#` → `%23`) ou gere uma senha só com letras e números.
4. **Pronto. Você não precisa criar tabelas.** Na primeira vez que o site subir no Render, ele
   cria sozinho o banco `ong_piedade_db`, todas as tabelas e os dados iniciais das campanhas.

> O TiDB é compatível com MySQL. O script do banco está em `database/migrations/`
> (é o `DATA_BASE_ONG.txt` original, com correções).

---

## 4. Passo a passo: colocar no ar no Render

1. Acesse **https://render.com** e crie uma conta gratuita. Clique em **Get Started** e entre com **GitHub**.
2. Clique em **New +** → **Web Service**.
3. Escolha o repositório:
   - **Se o repositório for seu** (ou você tiver permissão de administrador): clique em
     **Connect GitHub**, autorize o repositório e selecione-o.
   - **Se você só tem permissão de commit** em um repositório de outra pessoa:
     - Se o repositório for **público**, escolha a aba **Public Git Repository** e cole a URL
       (`https://github.com/USUARIO/REPOSITORIO`).
     - Se for **privado**, o dono do repositório precisa fazer este passo 3 (ou te dar acesso de administrador).
4. Preencha:
   | Campo | Valor |
   |---|---|
   | Name | `ong-piedade` (vira o endereço `ong-piedade.onrender.com`) |
   | Region | **Virginia (US East)** |
   | Branch | `main` |
   | Root Directory | *(vazio; só preencha se o projeto estiver numa subpasta do repositório)* |
   | Runtime / Language | **Node** |
   | Build Command | `npm ci --omit=dev` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
5. Em **Environment Variables**, clique em **Add Environment Variable** e cadastre:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | a string de conexão do TiDB (passo 3) |
   | `DB_NAME` | `ong_piedade_db` |
   | `JWT_SECRET` | clique em **Generate** (ou cole um texto aleatório com 40+ caracteres) |
   | `ADMIN_EMAIL` | o e-mail do administrador (ex.: `admin@ongpiedade.org.br`) |
   | `ADMIN_PASSWORD` | uma senha forte, **com no mínimo 8 caracteres** |
6. Em **Advanced**, preencha **Health Check Path** com `/api/health`.
7. Clique em **Create Web Service**. O primeiro deploy leva de 2 a 5 minutos.
   Nos **Logs**, quando der certo, aparece:
   ```
   [banco] Migração aplicada: 001_schema_inicial.sql
   [banco] Migração aplicada: 002_dados_iniciais.sql
   [banco] Migração aplicada: 003_historico_recebimentos.sql
   [seed] Administrador criado: admin@ongpiedade.org.br
   ✅ ONG Piedade no ar em http://localhost:10000
   ```
8. Acesse `https://ong-piedade.onrender.com` (o endereço aparece no topo da página do serviço).
   Para testar a conexão com o banco, abra `https://ong-piedade.onrender.com/api/health`.
   Deve aparecer `{"ok":true,"banco":"conectado"}`.

**Atualizações:** cada `git push` no GitHub faz o Render publicar a nova versão sozinho.
No modo "Public Git Repository", clique em **Manual Deploy → Deploy latest commit** no Render.

> **Sobre o plano gratuito do Render:** o site "dorme" depois de 15 minutos sem visitas. O
> primeiro acesso depois disso demora cerca de 1 minuto para acordar; os seguintes são rápidos.
> Antes de uma apresentação, abra o site alguns minutos antes.

---

## 5. Primeiro acesso e uso

- **Site público:** `https://SEU-SITE.onrender.com`
- **Painel administrativo:** link **"Área restrita"** no rodapé do site (ou `/login.html`).
  Entre com o `ADMIN_EMAIL` e o `ADMIN_PASSWORD` cadastrados no Render.

No painel:
- **Visão Geral**: números do mês e aprovação rápida de voluntários.
- **Insights (IA)**: previsão de arrecadação, alerta de materiais e recomendações.
- **Doações**: confirme os pagamentos recebidos (PIX, cartão ou boleto).
- **Campanhas**: crie campanhas, cadastre necessidades de materiais e registre entradas (**+ Entrada**).
- **Voluntários / Escalas**: aprove, reprove, edite e monte escalas. O botão **✨ Sugerir voluntários com IA** indica os mais compatíveis.
- **Relatórios**: cadastre resultados e anexe PDFs; tudo aparece na página **Transparência**.
- **Usuários**: crie outros acessos (Administrador ou Operador).

> As quantidades das campanhas iniciais (fraldas, fórmula etc.) são apenas exemplos. Ajuste em **Campanhas**.

---

## 6. Rodar no computador (opcional)

1. Instale o [Node.js 20 ou 22](https://nodejs.org).
2. No CMD, dentro da pasta do projeto:
   ```cmd
   copy .env.example .env
   notepad .env
   ```
   Preencha `DATABASE_URL` (pode usar o mesmo TiDB) **ou** os dados de um MySQL local,
   e `ADMIN_PASSWORD`.
3. Instale e rode:
   ```cmd
   npm install
   npm start
   ```
4. Abra http://localhost:3000.

---

## 7. Segurança

| Proteção | Como funciona |
|---|---|
| **HTTPS (criptografia no navegador)** | O Render entrega o site com certificado SSL automático. Todo o tráfego entre visitante e servidor é criptografado. |
| **Conexão criptografada com o banco** | A conexão com o TiDB usa TLS 1.2+ com verificação de certificado. |
| **Dados criptografados em repouso** | O TiDB Cloud criptografa os dados armazenados em disco. |
| **Senhas** | Guardadas com **bcrypt** (hash irreversível). Nem o administrador vê a senha. |
| **Login** | Token **JWT** assinado (HS256), válido por 8 h. O acesso é conferido no banco a cada requisição: usuário desativado perde o acesso na hora. |
| **Controle de acesso** | Rotas `/api/admin` exigem login; gerenciar usuários exige perfil ADMINISTRADOR. |
| **Contra força bruta** | Login: máximo de 10 tentativas por IP a cada 15 min. |
| **Contra sobrecarga / robôs** | Limite geral de 300 requisições/min por IP, formulários públicos 20/h por IP, corpo máximo de 100 KB, tempo máximo por requisição (contra ataque "slowloris"), compressão das respostas. |
| **Contra XSS / injeção** | Todo texto é escapado antes de aparecer na tela; CSP (Content-Security-Policy) só permite scripts do próprio site; consultas SQL parametrizadas (sem SQL injection). |
| **Validação de dados** | CPF/CNPJ com dígito verificador, e-mail, telefone, valores, datas e tamanhos máximos. |
| **Upload** | Só PDFs de verdade (confere a assinatura do arquivo), até 10 MB. |
| **Segredos fora do GitHub** | Senhas ficam nas variáveis de ambiente do Render. `.env` está no `.gitignore`. |

> **Limite honesto:** nenhum site no plano gratuito aguenta um ataque DDoS de grande escala.
> As proteções acima barram robôs, spam e abusos comuns. Se um dia a ONG tiver domínio
> próprio, colocar o **Cloudflare (plano gratuito)** na frente acrescenta proteção anti-DDoS.

---

## 8. Inteligência Artificial

Toda a IA roda **dentro do servidor, sem API paga**:

1. **Assistente virtual (chatbot)**: classificador **Naive Bayes** treinado com frases em
   português (Processamento de Linguagem Natural). Identifica a intenção da pergunta e responde
   com **dados reais do banco** (ex.: "o que vocês precisam?" lista os itens que mais faltam).
2. **Painel de Insights**: **regressão linear** sobre as doações confirmadas para prever a
   arrecadação do próximo mês, com a tendência e a confiabilidade (R²). Também estima o
   **ritmo de recebimento** de cada material e gera **recomendações** em texto.
3. **Recomendação de voluntários**: ao montar uma escala, calcula uma nota para cada voluntário
   (afinidade por **similaridade de cosseno**, disponibilidade no dia/turno e equilíbrio de carga).

O texto completo para a documentação acadêmica está em
[`docs/IA_E_CULTURA_DE_DADOS.md`](docs/IA_E_CULTURA_DE_DADOS.md).

---

## 9. Requisitos atendidos

| Código | Requisito | Onde |
|---|---|---|
| RF01 | Página inicial | `index.html`: sobre, impacto, galeria de projetos (dinâmica), botões Doar/Voluntário |
| RF02 | Cadastro de doador (PF/PJ) | `cadastro.html` (aba doador) e na doação: CPF/CNPJ validados |
| RF03 | Doação financeira | `doacao.html`: R$30/50/100 ou valor personalizado |
| RF04 | Formas de pagamento | PIX, cartão de crédito e boleto |
| RF05 | Doação recorrente | Opção "Doação mensal (apadrinhamento)" |
| RF06 | Campanhas | Painel → Campanhas (criar, editar, ativar/desativar, excluir) |
| RF07 | Doação de materiais | `campanhas.html`: item, necessário, recebido, restante e ponto de coleta |
| RF08 | Cadastro de voluntários | Nome, contato, profissão, disponibilidade e área de interesse |
| RF09 | Gerenciamento de voluntários | Aprovar, reprovar, editar, disponibilidade e **escalas** |
| RF10 | Mural de transparência | `transparencia.html`: números reais + relatórios |
| RF11 | Relatórios de impacto | Painel → Relatórios (atendimentos, médicos, materiais, resultados) |
| RF12 | Upload de relatórios | PDFs anexados e disponíveis para download |
| RF13 | Área administrativa | Painel completo (usuários, doações, campanhas, voluntários, relatórios) |
| RF14 | Login | E-mail e senha (administradores/operadores) |
| RF15 | Controle de acesso | JWT + perfis ADMINISTRADOR / OPERADOR |
| RNF01 | Responsividade | Layout adaptado para celular, tablet e computador |
| RNF04 | Segurança | Ver seção 7 |
| RNF05 | Banco MySQL | TiDB Cloud (compatível com MySQL 8) |
| RNF09 | Front e back separados, API REST | `public/` ↔ `/api/...` ↔ `src/` |
| RNF11 | Integridade dos dados | Chaves estrangeiras, UNIQUE, transações, validações |

> **Pagamentos:** o PIX mostra QR Code e chave; cartão e boleto registram a intenção e a equipe
> envia o link/boleto. Não há cobrança automática (exigiria contrato com um gateway como Mercado
> Pago ou Asaas). O ponto de integração já está preparado em `src/services/pagamentos.js`.

---

## 10. Rotas da API

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/health` | Público |
| POST | `/api/auth/login` · GET `/api/auth/me` | Público · Logado |
| GET | `/api/publico/campanhas` · `/api/publico/transparencia` · `/api/publico/documentos/:id` | Público |
| POST | `/api/doacoes` · `/api/doadores` · `/api/voluntarios` · `/api/assistente` | Público |
| GET | `/api/admin/metricas` · `/api/admin/insights` | Admin/Operador |
| GET/PATCH | `/api/admin/doacoes[/:id]` | Admin/Operador |
| GET/PUT/DELETE | `/api/admin/doadores[/:id]` | Admin/Operador |
| GET/POST/PUT/DELETE | `/api/admin/campanhas[/:id]` · `/api/admin/necessidades[/:id]` | Admin/Operador |
| POST | `/api/admin/necessidades/:id/recebimento` | Admin/Operador |
| GET/PUT/PATCH/DELETE | `/api/admin/voluntarios[/:id][/status]` | Admin/Operador |
| GET/POST/PUT/DELETE | `/api/admin/escalas[/:id]` · GET `/api/admin/escalas/sugestoes` | Admin/Operador |
| GET/POST/PUT/DELETE | `/api/admin/relatorios[/:id]` · POST `/:id/documentos` · DELETE `/api/admin/documentos/:id` | Admin/Operador |
| GET/POST/PUT/PATCH | `/api/admin/usuarios[/:id][/senha]` | **Somente Administrador** |

---

## 11. Problemas comuns

| Sintoma (nos Logs do Render) | Solução |
|---|---|
| `Defina a variável JWT_SECRET` | Cadastre `JWT_SECRET` em Environment. |
| `Nenhum administrador cadastrado...` | Cadastre `ADMIN_EMAIL` e `ADMIN_PASSWORD` (8+ caracteres) e faça **Manual Deploy**. |
| `Access denied` / `Usuário ou senha do banco incorretos` | Confira a `DATABASE_URL`. Se a senha tem símbolos, gere outra só com letras e números no TiDB. |
| `ENOTFOUND` / `ECONNREFUSED` | Host do TiDB errado na `DATABASE_URL`. Copie de novo em **Connect**. |
| `connections using insecure transport are prohibited` | Use o host `...tidbcloud.com` (TLS é ativado sozinho) ou cadastre `DB_SSL=true`. |
| Site demora ~1 min para abrir | Normal no plano gratuito (o serviço estava "dormindo"). |
| Esqueci a senha do admin | Outro administrador troca em **Usuários → Trocar senha**. Se não houver outro: no TiDB (SQL Editor) rode `UPDATE ong_piedade_db.usuarios_admin SET ativo = FALSE;` e faça **Manual Deploy** no Render. O admin do `ADMIN_EMAIL`/`ADMIN_PASSWORD` é recriado com a senha do Render. |
