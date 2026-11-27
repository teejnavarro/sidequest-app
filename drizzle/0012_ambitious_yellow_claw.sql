ALTER TABLE "cost" ADD COLUMN "photo_path" text;--> statement-breakpoint
ALTER TABLE "cost" ADD COLUMN "photo_by" text;--> statement-breakpoint
ALTER TABLE "cost" ADD COLUMN "photo_at" timestamp;--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_photo_by_user_id_fk" FOREIGN KEY ("photo_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;