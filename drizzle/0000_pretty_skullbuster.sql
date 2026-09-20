CREATE TYPE "public"."api_plan" AS ENUM('FREE', 'PRO', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."competition_type" AS ENUM('LEAGUE', 'CUP', 'INTERNATIONAL');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('GOAL', 'OWN_GOAL', 'PENALTY_SCORED', 'PENALTY_MISSED', 'YELLOW_CARD', 'RED_CARD', 'SECOND_YELLOW', 'SUBSTITUTION');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('SCHEDULED', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'EXTRA_TIME', 'PENALTIES', 'FINISHED', 'POSTPONED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."player_position" AS ENUM('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_name" varchar(120) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" varchar(255),
	"key" varchar(64) NOT NULL,
	"plan" "api_plan" DEFAULT 'FREE' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "api_keys_email_unique" UNIQUE("email"),
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "competitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"code" varchar(20),
	"country" varchar(100),
	"type" "competition_type" DEFAULT 'LEAGUE' NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "competitions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"match_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"related_player_id" bigint,
	"type" "event_type" NOT NULL,
	"minute" smallint NOT NULL,
	"extra_minute" smallint DEFAULT 0,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "match_lineups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_lineups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"match_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"is_starter" boolean DEFAULT true NOT NULL,
	"jersey_number" smallint,
	"formation_position" varchar(10),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "match_statistics" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_statistics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"match_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"possession_pct" smallint,
	"shots_total" smallint DEFAULT 0,
	"shots_on_target" smallint DEFAULT 0,
	"corners" smallint DEFAULT 0,
	"fouls" smallint DEFAULT 0,
	"offsides" smallint DEFAULT 0,
	"yellow_cards" smallint DEFAULT 0,
	"red_cards" smallint DEFAULT 0,
	"saves" smallint DEFAULT 0,
	"passes_total" smallint DEFAULT 0,
	"passes_accurate" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"season_id" bigint NOT NULL,
	"venue_id" bigint,
	"home_team_id" bigint NOT NULL,
	"away_team_id" bigint NOT NULL,
	"round" varchar(50),
	"kickoff_time" timestamp with time zone NOT NULL,
	"status" "match_status" DEFAULT 'SCHEDULED' NOT NULL,
	"home_score" smallint DEFAULT 0,
	"away_score" smallint DEFAULT 0,
	"home_score_ht" smallint DEFAULT 0,
	"away_score_ht" smallint DEFAULT 0,
	"home_score_et" smallint,
	"away_score_et" smallint,
	"home_score_penalties" smallint,
	"away_score_penalties" smallint,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"api_key_id" bigint NOT NULL,
	"payment_id" varchar(64) NOT NULL,
	"target_plan" "api_plan" NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"pix_qr_code" text NOT NULL,
	"pix_copy_paste" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payments_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "player_season_statistics" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_season_statistics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"player_id" bigint NOT NULL,
	"season_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"appearances" integer DEFAULT 0 NOT NULL,
	"matches_started" integer DEFAULT 0 NOT NULL,
	"minutes_played" integer DEFAULT 0 NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"yellow_cards" integer DEFAULT 0 NOT NULL,
	"red_cards" integer DEFAULT 0 NOT NULL,
	"rating" varchar(10) DEFAULT '0.0',
	"expected_goals" varchar(10) DEFAULT '0.0',
	"expected_assists" varchar(10) DEFAULT '0.0',
	"shots_total" integer DEFAULT 0 NOT NULL,
	"shots_on_target" integer DEFAULT 0 NOT NULL,
	"key_passes" integer DEFAULT 0 NOT NULL,
	"clean_sheets" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"goals_conceded" integer DEFAULT 0 NOT NULL,
	"penalty_saves" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"known_name" varchar(100),
	"birth_date" date,
	"nationality" varchar(100) NOT NULL,
	"primary_position" "player_position" NOT NULL,
	"height_cm" integer,
	"weight_kg" integer,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referees" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "referees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(150) NOT NULL,
	"nationality" varchar(100) DEFAULT 'Brasil' NOT NULL,
	"federation" varchar(100) DEFAULT 'CBF / FIFA',
	"matches_count" integer DEFAULT 0 NOT NULL,
	"yellow_cards_total" integer DEFAULT 0 NOT NULL,
	"red_cards_total" integer DEFAULT 0 NOT NULL,
	"fouls_avg" varchar(10) DEFAULT '27.4',
	"penalties_total" integer DEFAULT 0 NOT NULL,
	"home_win_pct" integer DEFAULT 48 NOT NULL,
	"away_win_pct" integer DEFAULT 26 NOT NULL,
	"draw_pct" integer DEFAULT 26 NOT NULL,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "seasons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"competition_id" bigint NOT NULL,
	"name" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "standings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"season_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"played" integer DEFAULT 0 NOT NULL,
	"won" integer DEFAULT 0 NOT NULL,
	"drawn" integer DEFAULT 0 NOT NULL,
	"lost" integer DEFAULT 0 NOT NULL,
	"goals_for" integer DEFAULT 0 NOT NULL,
	"goals_against" integer DEFAULT 0 NOT NULL,
	"goal_difference" integer DEFAULT 0 NOT NULL,
	"form" varchar(10),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_absences" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_absences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"team_id" bigint NOT NULL,
	"player_id" bigint,
	"player_name" varchar(150) NOT NULL,
	"position" varchar(50),
	"type" varchar(50) NOT NULL,
	"reason" varchar(255) NOT NULL,
	"expected_return" varchar(100),
	"status" varchar(50) DEFAULT 'OUT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_rosters" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_rosters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"team_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"season_id" bigint NOT NULL,
	"jersey_number" smallint,
	"position" "player_position" NOT NULL,
	"joined_date" date,
	"left_date" date,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"venue_id" bigint,
	"name" varchar(120) NOT NULL,
	"short_name" varchar(60),
	"acronym" varchar(10),
	"founded_year" integer,
	"country" varchar(100) NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"player_id" bigint,
	"player_name" varchar(150) NOT NULL,
	"from_team_id" bigint,
	"from_team_name" varchar(120) NOT NULL,
	"to_team_id" bigint,
	"to_team_name" varchar(120) NOT NULL,
	"type" varchar(50) DEFAULT 'PERMANENT' NOT NULL,
	"transfer_date" date NOT NULL,
	"fee_amount" varchar(50),
	"market_value" varchar(50),
	"contract_until" date,
	"position" varchar(50),
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "venues_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(150) NOT NULL,
	"city" varchar(100) NOT NULL,
	"country" varchar(100) NOT NULL,
	"capacity" integer,
	"surface" varchar(50) DEFAULT 'Grass',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"webhook_id" bigint NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"status_code" integer,
	"response_body" text,
	"success" boolean DEFAULT false NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhooks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"api_key_id" bigint NOT NULL,
	"url" varchar(500) NOT NULL,
	"secret" varchar(64) NOT NULL,
	"events" text[] DEFAULT '{"ALL"}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_related_player_id_players_id_fk" FOREIGN KEY ("related_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_statistics" ADD CONSTRAINT "player_season_statistics_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_statistics" ADD CONSTRAINT "player_season_statistics_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_statistics" ADD CONSTRAINT "player_season_statistics_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_absences" ADD CONSTRAINT "team_absences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_absences" ADD CONSTRAINT "team_absences_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rosters" ADD CONSTRAINT "team_rosters_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rosters" ADD CONSTRAINT "team_rosters_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rosters" ADD CONSTRAINT "team_rosters_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_team_id_teams_id_fk" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_team_id_teams_id_fk" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_key" ON "api_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_events_match_minute" ON "match_events" USING btree ("match_id","minute","extra_minute");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_match_player" ON "match_lineups" USING btree ("match_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_match_team_stats" ON "match_statistics" USING btree ("match_id","team_id");--> statement-breakpoint
CREATE INDEX "idx_matches_kickoff_status" ON "matches" USING btree ("kickoff_time","status");--> statement-breakpoint
CREATE INDEX "idx_matches_season_id" ON "matches" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "idx_matches_teams" ON "matches" USING btree ("home_team_id","away_team_id");--> statement-breakpoint
CREATE INDEX "idx_payments_api_key_id" ON "payments" USING btree ("api_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_player_season_stat" ON "player_season_statistics" USING btree ("player_id","season_id");--> statement-breakpoint
CREATE INDEX "idx_player_season_goals" ON "player_season_statistics" USING btree ("season_id","goals");--> statement-breakpoint
CREATE INDEX "idx_player_season_assists" ON "player_season_statistics" USING btree ("season_id","assists");--> statement-breakpoint
CREATE INDEX "idx_player_season_clean_sheets" ON "player_season_statistics" USING btree ("season_id","clean_sheets");--> statement-breakpoint
CREATE INDEX "idx_referees_name" ON "referees" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_competition_season" ON "seasons" USING btree ("competition_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_season_team_standing" ON "standings" USING btree ("season_id","team_id");--> statement-breakpoint
CREATE INDEX "idx_standings_season_pos" ON "standings" USING btree ("season_id","position");--> statement-breakpoint
CREATE INDEX "idx_team_absences_team_id" ON "team_absences" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_team_absences_player_id" ON "team_absences" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_team_player_season" ON "team_rosters" USING btree ("team_id","player_id","season_id");--> statement-breakpoint
CREATE INDEX "idx_team_rosters_season_team" ON "team_rosters" USING btree ("season_id","team_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_player_id" ON "transfers" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_from_team_id" ON "transfers" USING btree ("from_team_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_to_team_id" ON "transfers" USING btree ("to_team_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_date" ON "transfers" USING btree ("transfer_date");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_webhook_id" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_api_key_id" ON "webhooks" USING btree ("api_key_id");