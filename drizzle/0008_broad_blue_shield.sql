CREATE TABLE "cost" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"description" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"paid_by" text NOT NULL,
	"category" text,
	"spent_on" date NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cost_amount_positive" CHECK ("cost"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "cost_share" (
	"cost_id" text NOT NULL,
	"spot_id" text NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "cost_share_cost_id_spot_id_pk" PRIMARY KEY("cost_id","spot_id"),
	CONSTRAINT "cost_share_amount_nonnegative" CHECK ("cost_share"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_paid_by_trip_member_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."trip_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost" ADD CONSTRAINT "cost_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_share" ADD CONSTRAINT "cost_share_cost_id_cost_id_fk" FOREIGN KEY ("cost_id") REFERENCES "public"."cost"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_share" ADD CONSTRAINT "cost_share_spot_id_trip_member_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."trip_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_tripId_idx" ON "cost" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "cost_share_spotId_idx" ON "cost_share" USING btree ("spot_id");