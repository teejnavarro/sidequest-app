ALTER TABLE "trip" ADD COLUMN "invite_code" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_invite_code_unique" UNIQUE("invite_code");