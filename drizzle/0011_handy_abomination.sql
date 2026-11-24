CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"from_spot" text NOT NULL,
	"to_spot" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"method" text NOT NULL,
	"receipt_path" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_spots_differ" CHECK ("payment"."from_spot" <> "payment"."to_spot"),
	CONSTRAINT "payment_amount_positive" CHECK ("payment"."amount" > 0),
	CONSTRAINT "payment_method_check" CHECK ("payment"."method" in ('gcash', 'maya', 'bank', 'cash'))
);
--> statement-breakpoint
CREATE TABLE "payment_account" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"bank_name" text,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"qr_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_account_kind_check" CHECK ("payment_account"."kind" in ('gcash', 'maya', 'bank')),
	CONSTRAINT "payment_account_bank_name_check" CHECK (("payment_account"."kind" = 'bank') = ("payment_account"."bank_name" is not null))
);
--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_from_spot_trip_member_id_fk" FOREIGN KEY ("from_spot") REFERENCES "public"."trip_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_to_spot_trip_member_id_fk" FOREIGN KEY ("to_spot") REFERENCES "public"."trip_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_account" ADD CONSTRAINT "payment_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_tripId_idx" ON "payment" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "payment_fromSpot_idx" ON "payment" USING btree ("from_spot");--> statement-breakpoint
CREATE INDEX "payment_toSpot_idx" ON "payment" USING btree ("to_spot");--> statement-breakpoint
CREATE INDEX "payment_account_userId_idx" ON "payment_account" USING btree ("user_id");