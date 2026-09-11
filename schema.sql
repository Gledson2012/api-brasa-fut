-- ============================================================================
-- SCHEMA PARA API DE FUTEBOL (POSTGRESQL)
-- ============================================================================

-- Extensões úteis (opcional para buscas textuais)
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ----------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS (ENUMs)
-- ----------------------------------------------------------------------------
CREATE TYPE competition_type AS ENUM ('LEAGUE', 'CUP', 'INTERNATIONAL');

CREATE TYPE match_status AS ENUM (
    'SCHEDULED', 
    'FIRST_HALF', 
    'HALF_TIME', 
    'SECOND_HALF', 
    'EXTRA_TIME', 
    'PENALTIES', 
    'FINISHED', 
    'POSTPONED', 
    'CANCELLED'
);

CREATE TYPE event_type AS ENUM (
    'GOAL', 
    'OWN_GOAL', 
    'PENALTY_SCORED', 
    'PENALTY_MISSED', 
    'YELLOW_CARD', 
    'RED_CARD', 
    'SECOND_YELLOW', 
    'SUBSTITUTION'
);

CREATE TYPE player_position AS ENUM (
    'GOALKEEPER', 
    'DEFENDER', 
    'MIDFIELDER', 
    'FORWARD'
);

-- ----------------------------------------------------------------------------
-- 2. INFRAESTRUTURA BÁSICA (ESTÁDIOS E CLUBES)
-- ----------------------------------------------------------------------------

CREATE TABLE venues (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    capacity INT CHECK (capacity > 0),
    surface VARCHAR(50) DEFAULT 'Grass',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id BIGINT REFERENCES venues(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL,
    short_name VARCHAR(60),
    acronym VARCHAR(10),
    founded_year INT CHECK (founded_year > 1850),
    country VARCHAR(100) NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. COMPETIÇÕES E TEMPORADAS
-- ----------------------------------------------------------------------------

CREATE TABLE competitions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE, -- Ex: 'BRA-1', 'UCL', 'PL'
    country VARCHAR(100),    -- NULL para torneios continentais/mundiais
    type competition_type NOT NULL DEFAULT 'LEAGUE',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE seasons (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    competition_id BIGINT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- Ex: '2026' ou '2025/2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_competition_season UNIQUE (competition_id, name)
);

-- ----------------------------------------------------------------------------
-- 4. ATLETAS E ELENCOS
-- ----------------------------------------------------------------------------

CREATE TABLE players (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    known_name VARCHAR(100), -- Ex: 'Vini Jr', 'Pelé'
    birth_date DATE,
    nationality VARCHAR(100) NOT NULL,
    primary_position player_position NOT NULL,
    height_cm INT,
    weight_kg INT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relação Time <-> Jogador por Temporada
CREATE TABLE team_rosters (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    jersey_number SMALLINT CHECK (jersey_number BETWEEN 1 AND 99),
    position player_position NOT NULL,
    joined_date DATE,
    left_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_team_player_season UNIQUE (team_id, player_id, season_id)
);

-- ----------------------------------------------------------------------------
-- 5. PARTIDAS (FIXTURES)
-- ----------------------------------------------------------------------------

CREATE TABLE matches (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    season_id BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    venue_id BIGINT REFERENCES venues(id) ON DELETE SET NULL,
    home_team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    away_team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    round VARCHAR(50), -- Ex: 'Rodada 14', 'Quartas de Final - Ida'
    kickoff_time TIMESTAMPTZ NOT NULL,
    status match_status NOT NULL DEFAULT 'SCHEDULED',
    
    -- Placar no Tempo Normal / Final
    home_score SMALLINT DEFAULT 0 CHECK (home_score >= 0),
    away_score SMALLINT DEFAULT 0 CHECK (away_score >= 0),
    
    -- Placar no Intervalo (Half-Time)
    home_score_ht SMALLINT DEFAULT 0 CHECK (home_score_ht >= 0),
    away_score_ht SMALLINT DEFAULT 0 CHECK (away_score_ht >= 0),
    
    -- Placar de Pênaltis (se houver desempate)
    home_score_et SMALLINT CHECK (home_score_et >= 0),
    away_score_et SMALLINT CHECK (away_score_et >= 0),
    home_score_penalties SMALLINT CHECK (home_score_penalties >= 0),
    away_score_penalties SMALLINT CHECK (away_score_penalties >= 0),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_different_teams CHECK (home_team_id <> away_team_id)
);

-- ----------------------------------------------------------------------------
-- 6. ESCALAÇÕES E EVENTOS EM TEMPO REAL
-- ----------------------------------------------------------------------------

CREATE TABLE match_lineups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
    is_starter BOOLEAN NOT NULL DEFAULT TRUE,
    jersey_number SMALLINT,
    formation_position VARCHAR(10), -- Ex: 'GK', 'CB', 'LB', 'CAM', 'ST'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_match_player UNIQUE (match_id, player_id)
);

CREATE TABLE match_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
    related_player_id BIGINT REFERENCES players(id) ON DELETE SET NULL, -- Assistência ou quem sai na substituição
    type event_type NOT NULL,
    minute SMALLINT NOT NULL CHECK (minute BETWEEN 1 AND 130),
    extra_minute SMALLINT DEFAULT 0 CHECK (extra_minute >= 0),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. TABELA DE CLASSIFICAÇÃO (STANDINGS)
-- ----------------------------------------------------------------------------

CREATE TABLE standings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    season_id BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position > 0),
    points INT NOT NULL DEFAULT 0,
    played INT NOT NULL DEFAULT 0,
    won INT NOT NULL DEFAULT 0,
    drawn INT NOT NULL DEFAULT 0,
    lost INT NOT NULL DEFAULT 0,
    goals_for INT NOT NULL DEFAULT 0,
    goals_against INT NOT NULL DEFAULT 0,
    goal_difference INT NOT NULL DEFAULT 0,
    form VARCHAR(10), -- Ex: 'V-E-V-D-V'
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_season_team_standing UNIQUE (season_id, team_id)
);

-- ----------------------------------------------------------------------------
-- 8. ESTATÍSTICAS DETALHADAS DA PARTIDA
-- ----------------------------------------------------------------------------

CREATE TABLE match_statistics (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    possession_pct SMALLINT CHECK (possession_pct BETWEEN 0 AND 100),
    shots_total SMALLINT DEFAULT 0,
    shots_on_target SMALLINT DEFAULT 0,
    corners SMALLINT DEFAULT 0,
    fouls SMALLINT DEFAULT 0,
    offsides SMALLINT DEFAULT 0,
    yellow_cards SMALLINT DEFAULT 0,
    red_cards SMALLINT DEFAULT 0,
    saves SMALLINT DEFAULT 0,
    passes_total SMALLINT DEFAULT 0,
    passes_accurate SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_match_team_stats UNIQUE (match_id, team_id)
);

-- ============================================================================
-- 9. TRIGGERS PARA UPDATED_AT AUTOMÁTICO
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND column_name = 'updated_at'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_timestamp_%I ON %I;', t, t);
        EXECUTE format('CREATE TRIGGER trg_set_timestamp_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();', t, t);
    END LOOP;
END;
$$;

-- ============================================================================
-- 10. ÍNDICES DE PERFORMANCE (CRUCIAIS PARA APIs)
-- ============================================================================

-- Consultas rápidas por data e status (ex: "jogos de hoje" ou "jogos ao vivo")
CREATE INDEX idx_matches_kickoff_status ON matches (kickoff_time, status);
CREATE INDEX idx_matches_season_id ON matches (season_id);
CREATE INDEX idx_matches_teams ON matches (home_team_id, away_team_id);

-- Busca de eventos por jogo em tempo de execução
CREATE INDEX idx_events_match_minute ON match_events (match_id, minute, extra_minute);

-- Classificação ordenada por posição
CREATE INDEX idx_standings_season_pos ON standings (season_id, position ASC);

-- Consultas de elenco por time/temporada
CREATE INDEX idx_team_rosters_season_team ON team_rosters (season_id, team_id);
