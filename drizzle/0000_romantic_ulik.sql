DO $$ BEGIN
 CREATE TYPE "winner" AS ENUM('home', 'away', 'draw');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competition" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game" (
	"id" serial PRIMARY KEY NOT NULL,
	"homeTeam" varchar(255),
	"round" integer,
	"competitionId" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "round_index" ON "game" ("competitionId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game" ADD CONSTRAINT "game_competitionId_competition_id_fk" FOREIGN KEY ("competitionId") REFERENCES "competition"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
