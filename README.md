# ONG Piedade

Projeto Interdisciplinar 2026.2 – UNIBRA (Centro Universitário Brasileiro)
Professor fomentador: Ismael Rodrigues

Site feito pela nossa turma para a **Associação Beneficente Nossa Senhora de Piedade**, uma creche filantrópica sem fins lucrativos que fica em Piedade, Jaboatão dos Guararapes – PE.

A ideia surgiu porque a creche recebia doações e organizava voluntários só pelo telefone e pelas redes sociais, e não tinha um lugar para mostrar o que precisava nem para prestar contas. Então fizemos um site onde as pessoas podem doar, ver quais materiais estão faltando, se cadastrar como voluntárias e acompanhar a transparência. Também fizemos um painel para a equipe da creche controlar tudo.

Site no ar: https://ong-piedade.onrender.com

> O servidor é do plano gratuito do Render, então se ninguém acessar por uns 15 minutos ele "dorme". O primeiro acesso depois disso pode levar quase 1 minuto para abrir. É normal, depois fica rápido.

## O que o sistema faz

**Site público**
- Página inicial com informações da creche e botões de "Doe Agora" e "Seja Voluntário"
- Doação com valor pronto (R$ 30, 50 ou 100) ou outro valor, pagando por PIX, cartão ou boleto, uma vez só ou todo mês. No PIX aparece o QR Code e a chave CNPJ da creche
- Página de campanhas mostrando cada material que a creche precisa, quanto já chegou, quanto falta e onde entregar
- Cadastro de voluntário (com dias e turnos disponíveis) e de doador (pessoa física ou jurídica, com validação de CPF/CNPJ)
- Página de transparência com os números da creche e os relatórios em PDF
- Um assistente virtual no canto da tela que responde perguntas sobre a creche

**Painel da creche** (link "Área restrita" no rodapé do site)
- Confirmar as doações que chegaram
- Criar campanhas e registrar a entrada de materiais
- Aprovar ou reprovar voluntários e montar as escalas
- Publicar relatórios e anexar PDFs
- Criar outros usuários (Administrador ou Operador, o Operador não mexe em usuários)
- Aba de Insights, com a previsão de arrecadação e alertas

## Tecnologias

- Front-end: HTML5, CSS3 e JavaScript puro
- Back-end: Node.js com Express
- Banco de dados: MySQL, hospedado no TiDB Cloud
- Hospedagem: Render
- Código: GitHub

Escolhemos essas porque todas são gratuitas e porque dava para usar JavaScript tanto no front quanto no back. O projeto não gera nenhum custo para a creche.

## Inteligência Artificial

Um dos requisitos era usar IA, mas não podia ter custo. Por isso não usamos nenhuma API paga (tipo ChatGPT). A IA foi feita no próprio código do servidor:

- **Assistente virtual:** usa um classificador **Naive Bayes** que treinamos com frases em português. Ele descobre o que a pessoa quer saber (por exemplo "como faço pra doar?" ou "o que vocês estão precisando?") e responde com dados de verdade do banco.
- **Previsão de arrecadação:** usa **regressão linear** em cima das doações confirmadas para estimar quanto deve entrar no próximo mês.
- **Sugestão de voluntários:** quando a creche vai montar uma escala, o sistema dá uma nota de 0 a 100 para cada voluntário, olhando se a área dele combina com a atividade, se ele está disponível no dia e se já não está sobrecarregado.

Os dados pessoais (nome, CPF, e-mail) não aparecem nas partes públicas e não são usados pela IA. Ela só trabalha com números agregados.

A explicação completa está em [`docs/IA_E_CULTURA_DE_DADOS.md`](docs/IA_E_CULTURA_DE_DADOS.md).

## Como rodar no computador

Precisa ter o [Node.js](https://nodejs.org) 20 ou mais novo e um banco MySQL (pode ser o próprio TiDB).

```bash
git clone https://github.com/TaylorTech2024/ong-piedade.git
cd ong-piedade
cp .env.example .env      # no Windows: copy .env.example .env
```

Abra o `.env` e preencha:
- `DATABASE_URL` com a conexão do TiDB **ou** `DB_HOST`, `DB_USER` e `DB_PASSWORD` de um MySQL local
- `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 8 caracteres), que vai ser o login do painel
- `JWT_SECRET` com um texto grande qualquer

Depois:

```bash
npm install
npm start
```

E abrir http://localhost:3000.

Não precisa criar as tabelas na mão. Na primeira vez que o servidor sobe, ele roda os scripts da pasta `database/migrations` e cria o banco, as tabelas e os dados iniciais sozinho.

**Importante:** o arquivo `.env` tem senha, então ele **não pode** ir para o GitHub. Ele já está no `.gitignore`.

## Como publicamos

1. **TiDB Cloud:** criamos um cluster gratuito na região da Virgínia (us-east-1) e copiamos a string de conexão (botão *Connect*).
2. **Render:** criamos um *Web Service* ligado ao repositório, com:
   - Build: `npm ci --omit=dev`
   - Start: `npm start`
   - Health check: `/api/health`
   - Variáveis de ambiente: `NODE_ENV=production`, `DATABASE_URL`, `DB_NAME=ong_piedade_db`, `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`
3. Depois disso, cada `git push` na branch `main` atualiza o site sozinho.

Para testar se o banco conectou, é só abrir https://ong-piedade.onrender.com/api/health. Tem que aparecer `"banco":"conectado"`.

## Segurança

Como o site mexe com doação e dados de pessoas, tomamos alguns cuidados:
- o site roda em HTTPS e a conexão com o banco é criptografada (TLS)
- as senhas são salvas com bcrypt, então nem quem tem acesso ao banco consegue ver
- o login do painel usa token JWT e tem limite de 10 tentativas a cada 15 minutos
- tem limite de requisições por IP para evitar robô e spam nos formulários
- todas as consultas ao banco são parametrizadas (contra SQL injection) e o que é mostrado na tela é tratado contra XSS
- o upload só aceita PDF de verdade, até 10 MB
- nenhuma senha fica no código, tudo fica nas variáveis de ambiente do Render

## Organização das pastas

```
ong-piedade/
├── server.js            servidor (entrega o site e a API)
├── database/migrations  scripts SQL do banco
├── src/
│   ├── routes/          rotas da API (públicas e do painel)
│   ├── services/        regras de doador e pagamento
│   ├── middleware/      login, limite de requisições e erros
│   ├── ia/              assistente, previsão e recomendação
│   ├── db/              conexão com o banco
│   └── utils/           validações (CPF, CNPJ, e-mail...)
├── public/              front-end (páginas, css, js e imagens)
└── docs/                texto sobre IA e cultura de dados
```

O front-end e o back-end ficam separados e só conversam pela API (`/api/...`).

## O que ficou de fora

- O pagamento por cartão e boleto não é automático. O sistema registra a doação e a equipe da creche confirma no painel, porque integrar com um gateway de pagamento exigiria contrato e taxa.
- Não tem aplicativo de celular, mas o site funciona bem pelo navegador do celular.
- Não tem envio automático de e-mail nem de WhatsApp.

No teste de usabilidade, as pessoas que usam pouco a internet demoraram mais para achar o botão de doar. Já anotamos melhorias para uma próxima versão, como deixar o botão fixo na tela e aumentar as letras.

## Equipe

**Líder do grupo e gerente do projeto:** Herbert Taylor da Silva Souza

**Front-end** – líder: Herbert Taylor da Silva Souza
Cauã Monteiro de Lima, Gustavo Pinheiro de Sena, João Vitor Pereira Lira, Ryan Gabriel da Silva Nóbrega Santiago

**Back-end** – líder: Delson Ribeiro da Silva Ataíde (também fez a ponte com a creche)
Davy Oliveira Barros, João Victor Ramos de Santana, José Henrique Amaral de Mendonça Marinho, Juan Gabriel José Lemos e Silva, Julio Cesar Silva Leite, Wechiley Djean Falcão de Lima

**Banco de Dados** – líder: Matheus Felipe da Silva Siqueira
Allesson Victor da Silva, Edson Alves dos Santos Junior

**Documentação** – líder: Diego Silva Lima
Cauã Victor Rosa Leal, Matheus Abreu Oliveira e Silva, Pedro Henrique dos Santos Lima, Tiago Matheus de Albuquerque Vital, Yori Matos de Castro da Silva

Agradecemos ao Frei Paulo e à coordenadora Jacqueline, da Associação, por abrirem as portas para o projeto.

Recife, 2026.
