# ⚽ BrasaFut API - Documentação Oficial

> **API Profissional de Futebol Brasileiro e Internacional de Alta Performance**, desenvolvida com **Node.js**, **TypeScript**, **Fastify**, **Drizzle ORM**, **PostgreSQL**, **Redis** e **WebSockets**.
> Projetada para desenvolvedores, emissoras de TV, casas de análise esportiva, fantasy games (estilo Cartola) e aplicativos móveis de alto tráfego.

---

## 🚀 Funcionalidades Profissionais da API

### 🧭 1. Documentação Interativa OpenAPI 3.0 & Swagger UI
- Interface interativa completa em `/docs` com botão nativo **Authorize** para teste das chaves de API.
- Especificação JSON exportável em `/openapi.json`.

### 🔑 2. Sistema de API Keys & Rate Limiting de Produção
- Planos configuráveis com rate limit por minuto e cabeçalhos RFC (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`):
  - **FREE**: 10 req/min
  - **PRO**: 120 req/min
  - **ENTERPRISE**: 1.000 req/min
- Suporte a geração automática de chaves e autenticação em `/api/v1/auth`.
- **Chaves de API são guardadas apenas como hash (SHA-256)** + prefixo de exibição: o valor em
  texto puro aparece uma única vez, na criação ou na rotação
  (`POST /api/v1/auth/keys/rotate`, autenticado por login + senha).
- A chave deve ser enviada **somente** no cabeçalho `x-api-key` (query string desabilitada por
  padrão; habilite com `ALLOW_API_KEY_QUERY_PARAM=true`).
- Com `REDIS_URL` configurado, o rate limit é compartilhado entre **todas as instâncias**
  (sem Redis, o limite é aplicado por processo).
- Rotas administrativas (`x-admin-key` / `ADMIN_SECRET` ou plano ENTERPRISE): `/api/v1/sync/*,
  /api/v1/auth/enterprise/register`, `/api/v1/billing/simulate-pix-paid` e os disparos de teste de push.
- Login/registro/rotação têm limite por IP (10 tentativas/minuto).
- CORS configurável por `CORS_ORIGINS` (padrão `*`) e webhook de Pix autenticado por
  `PIX_WEBHOOK_SECRET` (cabeçalho `x-pix-secret`).

### ⚠️ Mudanças de contrato (para consumidores antigos)
- `POST /api/v1/auth/login` **não devolve mais a chave** (`apiKey`); retorna `keyPrefix` e os dados
  do plano. Para obter uma chave nova use `POST /api/v1/auth/keys/rotate` (login + senha).
- A chave de API é aceita apenas no cabeçalho `x-api-key`.
- `GET /api/v1/billing/status/:paymentId` responde apenas para a conta dona da cobrança.
- `POST /api/v1/billing/webhook` exige `x-pix-secret` e `POST /api/v1/billing/simulate-pix-paid`
  exige admin (ou `ALLOW_PIX_SIMULATION=true`).

### 🔐 Rotação de credenciais vazadas
Chaves antigas que já estiveram versionadas no repositório devem ser rotacionadas:
```bash
npm run db:rotate-leaked -- --dry-run   # mostra o que seria feito
npm run db:rotate-leaked                # rotaciona chave + senha das contas afetadas
```

### 👔 3. Central de Treinadores & Comissões Técnicas
- Catálogo de técnicos de elite (Filipe Luís, Abel Ferreira, Luis Zubeldía, Artur Jorge, Pep Guardiola, Carlo Ancelotti, Dorival Jr).
- DNA tático individual, esquemas táticos favoritos (`4-3-3`, `4-2-3-1`, `3-4-2-1`), intensidade de pressão e foco de posse.
- Linha do tempo da carreira de clubes, títulos conquistados e ranking por taxa de vitória e pontos por jogo (PPM).

### ⚔️ 4. Grandes Clássicos & Dérbis Históricos
- Dossiê detalhado das maiores rivalidades mundiais e brasileiras:
  - **Dérbi Paulista** (Palmeiras x Corinthians)
  - **Fla-Flu** (Flamengo x Fluminense)
  - **Gre-Nal** (Grêmio x Internacional)
  - **Clássico Mineiro** (Atlético-MG x Cruzeiro)
  - **El Clásico** (Real Madrid x Barcelona)
- Retrospecto histórico completo (vitórias, empates, gols marcados), maiores goleadas de cada lado, maiores artilheiros do confronto e histórico recente.

### 🖥️ 5. Central do VAR & Auditoria de Arbitragem
- Auditoria lance a lance de revisões do árbitro de vídeo: minuto, recomendação da cabine, decisão de campo, tempo de checagem em segundos e transcrição de áudio do diálogo entre o árbitro e a cabine.
- **Tabela do VAR Líquido**: Impacto real das decisões de arbitragem de vídeo no campeonato (saldo líquido de decisões favoráveis vs desfavoráveis, gols dados/anulados e estimativa de pontos ganhos/perdidos).

### 📋 6. Prancheta Tática 2D & Coordenadas no Gramado
- Escalações oficiais com coordenadas normalizadas (x: 0–100, y: 0–100) para renderização gráfica de campinhos em apps web e mobile.
- Papéis táticos avançados para cada atleta (ex: *Lateral Invertido*, *Zagueiro Construtor*, *Pitbull Marcador*, *Regista*, *Ponta Invertido*, *Falso 9*).
- **DNA Tático do Clube**: Índice PPDA de pressão alta, posse média, canais preferenciais de ataque (flanco esquerdo, centro, flanco direito).

### 🥅 7. Central de Pênaltis & Goleiros Pegadores
- Ranking oficial de cobradores: taxa de conversão (%), batedores sob pressão aos 85'+ e cantos prediletos no gol.
- Ranking de goleiros pegadores: percentual de defesas, histórico de pênaltis defendidos e disputas de pênaltis vencidas.
- Disputa de pênaltis minuto a minuto em partidas eliminatórias (`/api/v1/penalties/matches/:id/shootout`).

### 🏟️ 8. Público, Bilheteria & Taxa de Ocupação das Arenas
- Ranking de torcidas na competição: média de público pagante, taxa de ocupação dos estádios (%), renda bruta acumulada (R$) e ticket médio do ingresso.
- Registro histórico e público recorde de cada praça esportiva (Maracanã, MorumBIS, Neo Química Arena, Allianz Parque, Mineirão, etc.).

### 👕 9. Catálogo de Uniformes & Paleta de Cores (Kits)
- Cores oficiais em código hexadecimal (`#RRGGBB`) de camisas, calções, meiões e números para kit principal (Home), reserva (Away), terceiro (Third) e goleiro (Goalkeeper).
- Seletor inteligente de uniformes para partidas (`/api/v1/matches/:id/kits`) garantindo contraste ideal.

### 🏆 10. Premiações Oficiais & Hall da Fama
- Corrida pela **Bola de Ouro / Craque do Brasileirão**, **Golden Boy (Revelação)**, **Luva de Ouro (Melhor Goleiro)**, **Melhor Técnico** e a **Seleção Ideal da Temporada**.

### 🎲 11. Supercomputador Monte Carlo & Simulador de Tabela
- Simulação de 10.000 cenários probabilísticos para probabilidades matemáticas de Título, G-4 (Libertadores), Sul-Americana e Z-4 (Rebaixamento).
- Simulador interativo onde o usuário envia palpites de rodadas futuras e obtém a tabela recalculada instantaneamente.

### 📻 12. Guia de Transmissão & Narração Lance a Lance
- Guia oficial de transmissão: TV Aberta (Globo), TV Fechada (SporTV), PPV (Premiere) e Streaming (CazéTV / Globoplay) com escala de narradores e repórteres de campo.
- Feed de narração textual minuto a minuto com filtro para lances capitais.

---

## 🛠️ Stack Tecnológica

| Tecnologia | Finalidade |
|---|---|
| **Node.js (v20+)** | Runtime JavaScript moderno com suporte nativo a ESM |
| **Fastify (v5)** | Framework HTTP de baixíssimo overhead e alta performance |
| **Drizzle ORM** | Type-safe SQL ORM com tipagem completa em TypeScript |
| **PostgreSQL 16** | Banco relacional com extensões de normalização textual (`unaccent`) |
| **Zod** | Validação estrita e inferência de tipos em tempo de compilação |
| **Fastify Swagger & Swagger UI** | Geração automática da especificação OpenAPI 3.0 |
| **WebSockets (`@fastify/websocket`)** | Canal bidirecional de eventos e placares ao vivo |
| **Vitest** | Suite de testes automatizados com cobertura completa de integração |

---

## ⚡ Guia Rápido de Instalação e Execução

### 1. Clonar e Instalar:
```bash
git clone <url-do-repositorio>
cd api-brasa-fut
npm install --legacy-peer-deps
```

### 2. Configurar o Banco de Dados PostgreSQL:
Certifique-se de que o PostgreSQL está ativo ou execute via Docker:
```bash
docker compose up -d
npm run db:migrate
```

> O schema é versionado por **migrations do Drizzle** (pasta `drizzle/`). Para alterar o schema:
> edite `src/db/schema.ts`, rode `npm run db:generate` e depois `npm run db:migrate`.
> O arquivo `schema.sql` é **gerado** dessas migrations (`npm run db:schema-sql`) e serve apenas
> como bootstrap de banco vazio para o `docker compose`.

### 3. Popular Banco com Dados Reais (Seed & Sofascore):
```bash
npm run db:seed
```

> O seed cria a conta ENTERPRISE inicial do ambiente usando `BOOTSTRAP_ADMIN_EMAIL` e,
> opcionalmente, `BOOTSTRAP_ADMIN_PASSWORD` / `BOOTSTRAP_ADMIN_KEY`. Sem essas variáveis,
> uma senha e uma API key aleatórias são impressas **uma única vez** no console. Nenhuma
> credencial fica fixa no código.

### 4. Executar a Suíte de Testes (80+ testes):
```bash
npm test
```

### 5. Iniciar o Servidor:
```bash
npm run dev
```

- **API Base**: `http://localhost:3333`
- **Documentação Swagger**: `http://localhost:3333/docs`
- **Streaming WebSockets**: `ws://localhost:3333/api/v1/live/ws`

---

## 📡 Catálogo Completo de Endpoints

### 👔 Treinadores & Comissões Técnicas
- `GET /api/v1/coaches` - Listagem de técnicos com filtros por nacionalidade, clube e status.
- `GET /api/v1/coaches/:id` - Perfil detalhado, DNA tático e histórico.
- `GET /api/v1/coaches/:id/career` - Linha do tempo de passagens por clubes e títulos.
- `GET /api/v1/coaches/ranking?sortBy=winRate` - Ranking de técnicos por taxa de vitórias, títulos ou PPM.

### ⚔️ Grandes Clássicos & Dérbis
- `GET /api/v1/derbies` - Catálogo das maiores rivalidades e clássicos mundiais.
- `GET /api/v1/derbies/:slug` - Retrospecto completo, maiores goleadas e artilheiros (ex: `derbi-paulista`, `fla-flu`, `grenal`, `el-clasico`).

### 🖥️ Central do VAR & Arbitragem
- `GET /api/v1/var/matches/:id` - Auditoria e lances revisados pelo VAR na partida com áudio.
- `GET /api/v1/var/competitions/:id/table` - Tabela do VAR Líquido do campeonato.

### 🥅 Pênaltis & Especialistas
- `GET /api/v1/penalties/takers` - Ranking dos melhores cobradores e zonas de finalização.
- `GET /api/v1/penalties/goalkeepers` - Ranking de goleiros com maior índice de defesas de pênalti.
- `GET /api/v1/penalties/matches/:id/shootout` - Disputa de pênaltis cobrança a cobrança pós-jogo.

### 🏟️ Público & Bilheteria dos Estádios
- `GET /api/v1/attendance/competitions/:id` - Ranking de torcidas, taxas de ocupação e rendas brutas (R$).
- `GET /api/v1/attendance/venues/:id` - Recordes históricos e médias de público do estádio.

### 👕 Uniformes & Cores de Jogo (Kits)
- `GET /api/v1/teams/:id/kits` - Paleta oficial de cores em hexadecimal para kits Home, Away, Third e Goleiro.
- `GET /api/v1/matches/:id/kits` - Combinação de uniformes selecionada para a partida.

### 📋 Prancheta Tática & DNA de Jogo
- `GET /api/v1/matches/:id/tactical-lineup` - 11 titulares com coordenadas 2D (x, y) de 0 a 100 no gramado.
- `GET /api/v1/teams/:id/tactical-dna` - Filosofia de jogo, índice PPDA de pressão alta e distribuição de ataque.

### 🏆 Premiações da Temporada
- `GET /api/v1/awards/season?competitionId=1` - Corrida pela Bola de Ouro, Golden Boy, Luva de Ouro e Seleção do Ano.

### ⚽ Partidas & Transmissão
- `GET /api/v1/matches` - Listagem de partidas com filtros de data, rodada e liga.
- `GET /api/v1/matches/live` - Partidas em andamento com placares em tempo real.
- `GET /api/v1/matches/:id/broadcast` - Guia de canais de TV e streaming da partida.
- `GET /api/v1/matches/:id/commentary` - Feed de narração textual lance a lance minuto a minuto.
- `GET /api/v1/matches/:id/predictions` - Probabilidades de vitória (Home, Draw, Away) e placares prováveis.
- `GET /api/v1/matches/:id/momentum` - Gráfico de pressão ofensiva minuto a minuto.
- `GET /api/v1/matches/:id/shot-map` - Mapa de finalizações no campo com cálculo de Expected Goals (xG).

### 📈 Tabela & Supercomputador
- `GET /api/v1/standings` - Tabela de classificação oficial.
- `GET /api/v1/standings/live` - Tabela virtual recalculada em tempo real com os jogos ao vivo.
- `GET /api/v1/standings/supercomputer` - Projeções probabilísticas Monte Carlo de título e rebaixamento.
- `POST /api/v1/standings/simulate` - Simulador de resultados futuros.

### 🎥 Vídeos, Melhores Momentos & Geo-Restrictions
- `GET /api/v1/highlights` - Feed global de clipes e melhores momentos com filtros por país (`countryCode`) e categoria.
- `GET /api/v1/highlights/:id` - Detalhes do clipe, link MP4 de streaming e URL para embed em `<iframe>`.
- `GET /api/v1/highlights/:id/geo-restrictions` - Verificação de direitos territoriais e regras de geoblocking (whitelist/blacklist de países ISO-2).
- `GET /api/v1/matches/:id/highlights` - Todos os vídeos e melhores momentos vinculados a um jogo específico.

### 📊 Scouts Individuais & Box Score (Opta / NBA Style)
- `GET /api/v1/matches/:id/box-score` - Desempenho individual completo de cada atleta em campo: notas (0-10), passes certos/totais, desarmes, finalizações, xG, duelos ganhos e MVP da partida.

### 🎲 Mercados de Apostas, Value Bets & Bookmakers
- `GET /api/v1/odds/matches/:matchId` - Cotações completas de 1X2, Over/Under, BTTS e Dupla Chance com Fair Odds.
- `GET /api/v1/odds/value-bets` - Radar de apostas com valor esperado positivo (EV+).
- `GET /api/v1/odds/bookmakers` - Diretório oficial de casas de apostas parceiras (Bet365, Betano, Betfair, Pinnacle, Stake, etc.), taxas médias de payout e status regulatório.
- `GET /api/v1/odds/bookmakers/:id` - Detalhes de um bookmaker específico.

### 💰 Valuation de Atletas & Contratos (Transfermarkt Style)
- `GET /api/v1/players/:id/market-value` - Valor de mercado em Euros (€) e Reais (R$), pico histórico, término do contrato, multas rescisórias (nacional e internacional) e gráfico anual de valorização.
- `GET /api/v1/players/market-values/ranking` - Top jogadores mais valiosos do campeonato.

### ⚡ Power Ranking dos Clubes & Índice Elo (FotMob / Opta Style)
- `GET /api/v1/rankings/power-ranking` - Classificação contínua de força dos clubes baseada em Rating Elo dinâmico, forma recente dos últimos 5 jogos, saldo de gols esperado por 90 min (xGD) e dificuldade de calendário (Strength of Schedule).

### 📺 Central de Transmissões & Guia de Jogos na TV
- `GET /api/v1/broadcasts/guide` - Grade completa de transmissões de futebol do dia (TV Aberta, Fechada e Streaming com narradores e comentaristas escalados).
- `GET /api/v1/broadcasts/today` - Atalho para saber onde assistir aos jogos de hoje.

### 🌤️ Condições da Partida: Clima, Gramado & Altitude
- `GET /api/v1/matches/:id/conditions` - Meteorologia da partida (temperatura, umidade, vento), tipo de gramado (natural vs sintético), altitude do estádio e laudo de impacto físico e aerodinâmico na bola.
- `GET /api/v1/matches/:id/h2h` - Confronto direto histórico entre os dois clubes da partida com vitórias, empates e últimos jogos.

### 🤝 Fair Play & Disciplina da Competição
- `GET /api/v1/competitions/:id/fair-play` - Tabela de disciplina da liga com pontos de penalidade calculados por cartões amarelos, vermelhos e faltas.

---

## 🤖 Integração Contínua (GitHub Actions)

O workflow `.github/workflows/ci.yml` roda a cada push/PR:

| Job | O que valida |
|---|---|
| **quality** | `tsc --noEmit`, lint e se o `schema.sql` está em sincronia com as migrations (`npm run db:schema-sql` + `git diff`) |
| **database** | Cria um **branch efêmero no Neon**, aplica `npm run db:migrate` em banco limpo e roda os testes de integração; o branch é apagado ao final (mesmo em falha) |

O job `database` é ignorado enquanto `NEON_PROJECT_ID` (variável de repositório) não existir.
Para habilitá-lo, instale a **Neon GitHub Integration** (cria o secret `NEON_API_KEY` e a variável
`NEON_PROJECT_ID` automaticamente) ou configure ambos manualmente em *Settings → Secrets and variables → Actions*.

> `npm test` (a suíte de aceitação em `tests/api.test.ts`) roda contra um banco **populado** —
> ela não é executada na CI para não depender de scraping do Sofascore. Para rodá-la, aponte
> `DATABASE_URL` para um branch criado a partir do branch de desenvolvimento e rode `npm run db:seed`.

## 📜 Licença
MIT
