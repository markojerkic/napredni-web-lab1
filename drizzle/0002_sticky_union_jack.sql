ALTER TABLE "competition" ALTER COLUMN "ownerId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "competition" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ALTER COLUMN "homeTeam" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ALTER COLUMN "round" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ALTER COLUMN "competitionId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "winner" "winner";