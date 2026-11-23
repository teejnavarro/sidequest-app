ALTER TABLE "cost" ADD COLUMN "original_amount" bigint;--> statement-breakpoint
ALTER TABLE "cost" ADD COLUMN "original_currency" text;--> statement-breakpoint
ALTER TABLE "cost" ADD COLUMN "rate" text;--> statement-breakpoint
ALTER TABLE "cost" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "cost" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "cost_share" ADD COLUMN "original_amount" bigint;--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_original_pair" CHECK (("cost"."original_amount" is null) = ("cost"."original_currency" is null));--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_original_positive" CHECK ("cost"."original_amount" is null or "cost"."original_amount" > 0);--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_original_differs" CHECK ("cost"."original_currency" is null or "cost"."original_currency" <> "cost"."currency");--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_rate_needs_original" CHECK ("cost"."rate" is null or "cost"."original_amount" is not null);--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_rate_format" CHECK ("cost"."rate" is null or "cost"."rate" ~ '^[0-9]{1,7}(\.[0-9]{1,6})?$');--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_deleted_pair" CHECK (("cost"."deleted_at" is null) = ("cost"."deleted_by" is null));--> statement-breakpoint
ALTER TABLE "cost_share" ADD CONSTRAINT "cost_share_original_nonnegative" CHECK ("cost_share"."original_amount" is null or "cost_share"."original_amount" >= 0);