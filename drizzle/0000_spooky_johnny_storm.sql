CREATE TABLE "experience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"good_to_know" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "experience_tag_experience_id_tag_id_unique" UNIQUE("experience_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "place" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	CONSTRAINT "place_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"experience_id" uuid,
	"content" text NOT NULL,
	"good_to_know" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_status_check" CHECK ("submission"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tag_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"role" text DEFAULT 'user' NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_check" CHECK ("user"."role" in ('user', 'curator'))
);
--> statement-breakpoint
CREATE TABLE "wishlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"experience_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_user_id_experience_id_unique" UNIQUE("user_id","experience_id")
);
--> statement-breakpoint
ALTER TABLE "experience" ADD CONSTRAINT "experience_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_tag" ADD CONSTRAINT "experience_tag_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_tag" ADD CONSTRAINT "experience_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experience_place_id_idx" ON "experience" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "experience_tag_experience_id_idx" ON "experience_tag" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "experience_tag_tag_id_idx" ON "experience_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "submission_user_id_idx" ON "submission" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submission_place_id_idx" ON "submission" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "submission_experience_id_idx" ON "submission" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "submission_status_idx" ON "submission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wishlist_user_id_idx" ON "wishlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_experience_id_idx" ON "wishlist" USING btree ("experience_id");