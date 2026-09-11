import {
  pgTable,
  bigint,
  varchar,
  text,
  integer,
  smallint,
  date,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ----------------------------------------------------------------------------
// 1. ENUMS
// ----------------------------------------------------------------------------
export const competitionTypeEnum = pgEnum("competition_type", [
  "LEAGUE",
  "CUP",
  "INTERNATIONAL",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "SCHEDULED",
  "FIRST_HALF",
  "HALF_TIME",
  "SECOND_HALF",
  "EXTRA_TIME",
  "PENALTIES",
  "FINISHED",
  "POSTPONED",
  "CANCELLED",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "GOAL",
  "OWN_GOAL",
  "PENALTY_SCORED",
  "PENALTY_MISSED",
  "YELLOW_CARD",
  "RED_CARD",
  "SECOND_YELLOW",
  "SUBSTITUTION",
]);

export const playerPositionEnum = pgEnum("player_position", [
  "GOALKEEPER",
  "DEFENDER",
  "MIDFIELDER",
  "FORWARD",
]);

// ----------------------------------------------------------------------------
// 2. VENUES
// ----------------------------------------------------------------------------
export const venues = pgTable("venues", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 150 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  capacity: integer("capacity"),
  surface: varchar("surface", { length: 50 }).default("Grass"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ----------------------------------------------------------------------------
// 3. TEAMS
// ----------------------------------------------------------------------------
export const teams = pgTable("teams", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  venueId: bigint("venue_id", { mode: "number" }).references(() => venues.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 120 }).notNull(),
  shortName: varchar("short_name", { length: 60 }),
  acronym: varchar("acronym", { length: 10 }),
  foundedYear: integer("founded_year"),
  country: varchar("country", { length: 100 }).notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ----------------------------------------------------------------------------
// 4. COMPETITIONS & SEASONS
// ----------------------------------------------------------------------------
export const competitions = pgTable("competitions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }).unique(),
  country: varchar("country", { length: 100 }),
  type: competitionTypeEnum("type").default("LEAGUE").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const seasons = pgTable(
  "seasons",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    competitionId: bigint("competition_id", { mode: "number" })
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isCurrent: boolean("is_current").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_competition_season").on(table.competitionId, table.name),
  ]
);

// ----------------------------------------------------------------------------
// 5. PLAYERS & ROSTERS
// ----------------------------------------------------------------------------
export const players = pgTable("players", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  firstName: varchar("first_name", { length: 80 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  knownName: varchar("known_name", { length: 100 }),
  birthDate: date("birth_date"),
  nationality: varchar("nationality", { length: 100 }).notNull(),
  primaryPosition: playerPositionEnum("primary_position").notNull(),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const teamRosters = pgTable(
  "team_rosters",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    teamId: bigint("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: bigint("player_id", { mode: "number" })
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    seasonId: bigint("season_id", { mode: "number" })
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    jerseyNumber: smallint("jersey_number"),
    position: playerPositionEnum("position").notNull(),
    joinedDate: date("joined_date"),
    leftDate: date("left_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_team_player_season").on(
      table.teamId,
      table.playerId,
      table.seasonId
    ),
    index("idx_team_rosters_season_team").on(table.seasonId, table.teamId),
  ]
);

// ----------------------------------------------------------------------------
// 6. MATCHES (FIXTURES)
// ----------------------------------------------------------------------------
export const matches = pgTable(
  "matches",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    seasonId: bigint("season_id", { mode: "number" })
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    venueId: bigint("venue_id", { mode: "number" }).references(() => venues.id, {
      onDelete: "set null",
    }),
    homeTeamId: bigint("home_team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    awayTeamId: bigint("away_team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    round: varchar("round", { length: 50 }),
    kickoffTime: timestamp("kickoff_time", { withTimezone: true }).notNull(),
    status: matchStatusEnum("status").default("SCHEDULED").notNull(),
    homeScore: smallint("home_score").default(0),
    awayScore: smallint("away_score").default(0),
    homeScoreHt: smallint("home_score_ht").default(0),
    awayScoreHt: smallint("away_score_ht").default(0),
    homeScoreEt: smallint("home_score_et"),
    awayScoreEt: smallint("away_score_et"),
    homeScorePenalties: smallint("home_score_penalties"),
    awayScorePenalties: smallint("away_score_penalties"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_matches_kickoff_status").on(table.kickoffTime, table.status),
    index("idx_matches_season_id").on(table.seasonId),
    index("idx_matches_teams").on(table.homeTeamId, table.awayTeamId),
  ]
);

// ----------------------------------------------------------------------------
// 7. LINEUPS & EVENTS
// ----------------------------------------------------------------------------
export const matchLineups = pgTable(
  "match_lineups",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    matchId: bigint("match_id", { mode: "number" })
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    teamId: bigint("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: bigint("player_id", { mode: "number" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    isStarter: boolean("is_starter").default(true).notNull(),
    jerseyNumber: smallint("jersey_number"),
    formationPosition: varchar("formation_position", { length: 10 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_match_player").on(table.matchId, table.playerId),
  ]
);

export const matchEvents = pgTable(
  "match_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    matchId: bigint("match_id", { mode: "number" })
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    teamId: bigint("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: bigint("player_id", { mode: "number" })
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    relatedPlayerId: bigint("related_player_id", { mode: "number" }).references(
      () => players.id,
      { onDelete: "set null" }
    ),
    type: eventTypeEnum("type").notNull(),
    minute: smallint("minute").notNull(),
    extraMinute: smallint("extra_minute").default(0),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_events_match_minute").on(
      table.matchId,
      table.minute,
      table.extraMinute
    ),
  ]
);

// ----------------------------------------------------------------------------
// 8. STANDINGS
// ----------------------------------------------------------------------------
export const standings = pgTable(
  "standings",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    seasonId: bigint("season_id", { mode: "number" })
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    teamId: bigint("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    points: integer("points").default(0).notNull(),
    played: integer("played").default(0).notNull(),
    won: integer("won").default(0).notNull(),
    drawn: integer("drawn").default(0).notNull(),
    lost: integer("lost").default(0).notNull(),
    goalsFor: integer("goals_for").default(0).notNull(),
    goalsAgainst: integer("goals_against").default(0).notNull(),
    goalDifference: integer("goal_difference").default(0).notNull(),
    form: varchar("form", { length: 10 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_season_team_standing").on(table.seasonId, table.teamId),
    index("idx_standings_season_pos").on(table.seasonId, table.position),
  ]
);

// ----------------------------------------------------------------------------
// 9. MATCH STATISTICS
// ----------------------------------------------------------------------------
export const matchStatistics = pgTable(
  "match_statistics",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    matchId: bigint("match_id", { mode: "number" })
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    teamId: bigint("team_id", { mode: "number" })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    possessionPct: smallint("possession_pct"),
    shotsTotal: smallint("shots_total").default(0),
    shotsOnTarget: smallint("shots_on_target").default(0),
    corners: smallint("corners").default(0),
    fouls: smallint("fouls").default(0),
    offsides: smallint("offsides").default(0),
    yellowCards: smallint("yellow_cards").default(0),
    redCards: smallint("red_cards").default(0),
    saves: smallint("saves").default(0),
    passesTotal: smallint("passes_total").default(0),
    passesAccurate: smallint("passes_accurate").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_match_team_stats").on(table.matchId, table.teamId),
  ]
);

// ----------------------------------------------------------------------------
// 10. RELATIONS (DRIZZLE ORM)
// ----------------------------------------------------------------------------
export const venuesRelations = relations(venues, ({ many }) => ({
  teams: many(teams),
  matches: many(matches),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  venue: one(venues, { fields: [teams.venueId], references: [venues.id] }),
  rosters: many(teamRosters),
  homeMatches: many(matches, { relationName: "homeTeam" }),
  awayMatches: many(matches, { relationName: "awayTeam" }),
  standings: many(standings),
  matchStatistics: many(matchStatistics),
}));

export const competitionsRelations = relations(competitions, ({ many }) => ({
  seasons: many(seasons),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [seasons.competitionId],
    references: [competitions.id],
  }),
  matches: many(matches),
  standings: many(standings),
  rosters: many(teamRosters),
}));

export const playersRelations = relations(players, ({ many }) => ({
  rosters: many(teamRosters),
  lineups: many(matchLineups),
  events: many(matchEvents),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  season: one(seasons, { fields: [matches.seasonId], references: [seasons.id] }),
  venue: one(venues, { fields: [matches.venueId], references: [venues.id] }),
  homeTeam: one(teams, {
    fields: [matches.homeTeamId],
    references: [teams.id],
    relationName: "homeTeam",
  }),
  awayTeam: one(teams, {
    fields: [matches.awayTeamId],
    references: [teams.id],
    relationName: "awayTeam",
  }),
  lineups: many(matchLineups),
  events: many(matchEvents),
  statistics: many(matchStatistics),
}));

export const matchLineupsRelations = relations(matchLineups, ({ one }) => ({
  match: one(matches, {
    fields: [matchLineups.matchId],
    references: [matches.id],
  }),
  team: one(teams, { fields: [matchLineups.teamId], references: [teams.id] }),
  player: one(players, {
    fields: [matchLineups.playerId],
    references: [players.id],
  }),
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
  match: one(matches, {
    fields: [matchEvents.matchId],
    references: [matches.id],
  }),
  team: one(teams, { fields: [matchEvents.teamId], references: [teams.id] }),
  player: one(players, {
    fields: [matchEvents.playerId],
    references: [players.id],
  }),
  relatedPlayer: one(players, {
    fields: [matchEvents.relatedPlayerId],
    references: [players.id],
  }),
}));

export const standingsRelations = relations(standings, ({ one }) => ({
  season: one(seasons, {
    fields: [standings.seasonId],
    references: [seasons.id],
  }),
  team: one(teams, { fields: [standings.teamId], references: [teams.id] }),
}));

export const matchStatisticsRelations = relations(matchStatistics, ({ one }) => ({
  match: one(matches, {
    fields: [matchStatistics.matchId],
    references: [matches.id],
  }),
  team: one(teams, {
    fields: [matchStatistics.teamId],
    references: [teams.id],
  }),
}));
