import { serial, pgTable, varchar, pgEnum, integer, numeric } from "drizzle-orm/pg-core";

export const Competition = pgTable("competition", {
  id: serial("id").primaryKey(),
  ownerId: varchar("ownerId", { length: 255 }).notNull(),
  name: varchar("name").notNull(),
  winPoints: numeric("winPoints").notNull(),
  drawPoints: numeric("drawPoints").notNull(),
  lossPoints: numeric("lossPoints").notNull(),
})

export const Winner = pgEnum("winner", ["home", "away", "draw"]);
export const Game = pgTable("game", {
  id: serial("id").primaryKey(),
  homeTeam: varchar("homeTeam", { length: 255 }).notNull(),
  awayTeam: varchar("awayTeam", { length: 255 }).notNull(),
  winner: Winner("winner").default("draw"),
  competitionId: integer("competitionId").references(() => Competition.id).notNull()
})

export type GameType = typeof Game;
