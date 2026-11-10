ALTER TABLE "trip_member" DROP CONSTRAINT "trip_member_trip_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "trip_member" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_member" ADD COLUMN "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_member" ADD COLUMN "guest_name" text;--> statement-breakpoint
ALTER TABLE "trip_member" ADD COLUMN "added_by" text;--> statement-breakpoint
ALTER TABLE "trip_member" ADD CONSTRAINT "trip_member_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_member_trip_user_unique" ON "trip_member" USING btree ("trip_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_member_trip_guest_name_unique" ON "trip_member" USING btree ("trip_id",lower("guest_name")) WHERE "trip_member"."guest_name" is not null;--> statement-breakpoint
ALTER TABLE "trip_member" ADD CONSTRAINT "trip_member_kind_check" CHECK (("trip_member"."user_id" is null) <> ("trip_member"."guest_name" is null));