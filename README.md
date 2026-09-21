# ⚽ BrasaFut API

> API profissional e de alta performance de futebol brasileiro e internacional, desenvolvida em **Node.js**, **TypeScript**, **Fastify**, **Drizzle ORM**, **PostgreSQL** e **WebSockets**.

---

## 🚀 Funcionalidades Principais

- **Documentação Interativa Swagger/OpenAPI**: Navegação e testes de todos os endpoints via `/docs`, com botão nativo **Authorize** para testar com sua API Key.
- **Sistema de API Keys & Rate Limiting**: Proteção de endpoints inspirada em plataformas como RapidAPI e Football-Data.org:
  - Plano **FREE**: 10 req/min
  - Plano **PRO**: 120 req/min
  - Plano **ENTERPRISE**: 1.000 req/min
  - Cabeçalhos RFC padrão: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Transmissões e Eventos em Tempo Real (WebSockets)**: Canal de streaming para placares em tempo real e lances de jogos (`ws://localhost:3333/api/v1/live/ws`).
- **Módulo de Estatísticas Avançadas**: Posse de bola, finalizações certas/totais, faltas, escanteios, cartões e histórico de confronto direto (H2H).
- **Cobertura de Dados Completa**:
  - Competições e Temporadas (Série A, Copas, Internacionais)
  - Clubes e Estádios (Capacidade, gramado, localização)
  - Atletas e Elencos por temporada
  - Partidas com placares detalhados (Tempo normal, Intervalo, Prorrogação, Pênaltis)
  - Linha do tempo de lances (Gols, Cartões, Substituições, VAR)
  - Tabelas de Classificação (Standings com pontos, saldo de gols e histórico de forma recente `V-E-D`)
- **Dados Iniciais (Seed)**: Elencos reais e clássicos do Brasileirão 2026 pré-populados.

---

## 🛠️ Stack Tecnológica

| Tecnologia | Finalidade |
|---|---|
| **Node.js (v20+)** | Runtime JavaScript moderno com suporte nativo a ESM |
| **Fastify** | Framework HTTP de baixíssimo overhead e alta escalabilidade |
| **Drizzle ORM** | Type-safe SQL ORM com excelente performance |
| **PostgreSQL 16** | Banco de dados relacional robusto com extensões de busca (`unaccent`) |
| **Zod & fastify-type-provider-zod** | Validação estrita de contratos de entrada e saída |
| **Fastify Swagger & Swagger UI** | Geração automática da especificação OpenAPI 3.0 |
| **WebSockets (`@fastify/websocket`)** | Disparo de eventos e placares ao vivo |
| **Docker & Docker Compose** | Inicialização instantânea do banco de dados e ambiente |

---

## 📋 Pré-requisitos

- [Docker & Docker Compose](https://www.docker.com/)
- [Node.js](https://nodejs.org/) (v20 ou superior)

---

## ⚡ Guia Rápido de Instalação

### 1. Clonar e instalar dependências:
```bash
git clone <url-do-repositorio>
cd api-brasa-fut
npm install
```

### 2. Iniciar o banco de dados PostgreSQL via Docker:
```bash
docker compose up -d
```

### 3. Popular o banco com dados reais (Seed):
```bash
npm run db:seed
```

### 4. Iniciar o servidor em modo de desenvolvimento:
```bash
npm run dev
```

A API estará disponível em:
- **API Base**: `http://localhost:3333`
- **Documentação Swagger UI**: `http://localhost:3333/docs`
- **WebSocket em Tempo Real**: `ws://localhost:3333/api/v1/live/ws`

---

## 📡 Endpoints da API

### 🏆 Competições & Temporadas
- `GET /api/v1/competitions` - Lista competições cadastradas.
- `GET /api/v1/competitions/:id` - Detalhes da competição.
- `GET /api/v1/competitions/:id/seasons` - Temporadas de uma competição.

### 🛡️ Clubes & Estádios
- `GET /api/v1/teams` - Lista clubes (filtros: `search`, `country`).
- `GET /api/v1/teams/:id` - Detalhes do clube e seu estádio mandante.
- `GET /api/v1/teams/:id/roster?seasonId=1` - Elenco do time na temporada.
- `GET /api/v1/venues` - Lista estádios cadastrados.
- `GET /api/v1/venues/:id` - Detalhes de um estádio.

### 👤 Atletas
- `GET /api/v1/players` - Busca paginada de jogadores (filtros: `search`, `position`, `nationality`).
- `GET /api/v1/players/:id` - Perfil detalhado do jogador e clubes por onde passou.

### ⚽ Partidas & Estatísticas
- `GET /api/v1/matches` - Lista partidas (filtros: `date=YYYY-MM-DD`, `status`, `live=true`, `seasonId`, `round`).
- `GET /api/v1/matches/live` - Atalho para partidas em andamento em tempo real.
- `GET /api/v1/matches/:id` - Detalhes completos da partida.
- `GET /api/v1/matches/:id/lineups` - Escalações (titulares, reservas e formação tática de cada lado).
- `GET /api/v1/matches/:id/events` - Linha do tempo dos lances do jogo (gols, cartões, substituições).
- `GET /api/v1/matches/:id/statistics` - Estatísticas avançadas (posse, finalizações, faltas, escanteios).
- `GET /api/v1/matches/:id/h2h` - Histórico de confronto direto (Head-to-Head) entre os clubes.

### 📈 Tabela de Classificação
- `GET /api/v1/standings?seasonId=1` - Tabela de classificação com pontos, vitórias, saldo de gols e forma recente.

### ⚡ Tempo Real & WebSockets
- `ws://localhost:3333/api/v1/live/ws` - Conexão WebSocket para receber transmissões.
  - Para se inscrever em um jogo específico:
    ```json
    { "action": "subscribe", "channel": "match:1" }
    ```
- `POST /api/v1/matches/:id/events` - (Admin/Feed) Insere um novo lance e envia broadcast automático para o WebSocket.
- `PATCH /api/v1/matches/:id/score` - (Admin/Feed) Atualiza placar/status e envia broadcast para o WebSocket.

---

## 🔐 Configuração e segurança

1. Copie `.env.example` para `.env` e preencha (nunca commite `.env`).
2. Obrigatório em produção: `ADMIN_SECRET`, `BILLING_WEBHOOK_SECRET`, `CORS_ORIGIN`, `ENTERPRISE_PASSWORD`.
3. Multi-instância/Vercel: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate-limit, cache e fanout distribuídos; sem eles o modo é memória/single-instance).
4. Pix ao vivo: `MP_ACCESS_TOKEN` (+ `BILLING_MP_WEBHOOK_URL`); sem ele o checkout usa sandbox local e o QR é renderizado pelo cliente a partir de `pixCopyPaste`.
5. Seed/migração admin **somente via CLI** (endpoints HTTP removidos por segurança):
   ```bash
   ADMIN_SECRET=xxx ENTERPRISE_PASSWORD='senha-forte-12+' tsx scripts/migrate-prod.ts
   ```
6. Health público (sem auth, ideal p/ Docker/K8s/Vercel): `GET /health` e `GET /api/v1/health`.
7. Webhook de billing exige `x-webhook-secret` (comparação timing-safe) quando `BILLING_WEBHOOK_SECRET` está definido; `simulate-pix-paid` é bloqueado em produção sem `x-admin-key`.

## 📦 Convenções de resposta (v1.1.0)

* **Listas paginadas** retornam sempre `{ page, limit, total, totalPages, data }` (`matches`, `teams`, `players`, `venues`, `competitions`, `transfers`).
* **Busca insensível a acentos**: `?search=sao paulo` encontra "São Paulo" (extensão `unaccent`; rode `scripts/migrate-prod.ts` em bancos existentes).

## 📦 Novidades v1.2.0

* **Rotação de chaves**: `POST /api/v1/auth/rotate` gera nova key; a antiga vale por 24h (requisições com ela recebem `X-Api-Key-Rotated: true`).
* **Metering**: `GET /api/v1/auth/usage` mostra total do mês, hoje e série diária.
* **Overview do clube**: `GET /api/v1/teams/:id/overview` agrega clube, posição, forma, próximos 3 jogos e desfalques em 1 roundtrip.

---

## 📜 Licença
MIT
