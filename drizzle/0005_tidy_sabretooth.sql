CREATE TABLE "idea_vote" (
	"idea_id" text NOT NULL,
	"user_id" text NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "idea_vote_idea_id_user_id_pk" PRIMARY KEY("idea_id","user_id"),
	CONSTRAINT "idea_vote_value_check" CHECK ("idea_vote"."value" in (1, -1))
);
--> statement-breakpoint
ALTER TABLE "idea" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "idea" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "idea_vote" ADD CONSTRAINT "idea_vote_idea_id_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."idea"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_vote" ADD CONSTRAINT "idea_vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idea_vote_userId_idx" ON "idea_vote" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "idea" ADD CONSTRAINT "idea_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;