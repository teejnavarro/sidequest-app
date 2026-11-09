CREATE TABLE "schedule_item" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"idea_id" text,
	"name" text,
	"notes" text,
	"day" date NOT NULL,
	"slot" text NOT NULL,
	"time" text,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_item_kind_check" CHECK (("schedule_item"."idea_id" is null) <> ("schedule_item"."name" is null)),
	CONSTRAINT "schedule_item_time_check" CHECK (("schedule_item"."slot" = 'time') = ("schedule_item"."time" is not null))
);
--> statement-breakpoint
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_idea_id_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."idea"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_item_tripId_idx" ON "schedule_item" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_item_ideaId_unique" ON "schedule_item" USING btree ("idea_id");