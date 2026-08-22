CREATE TYPE "public"."animal_sex" AS ENUM('MALE', 'FEMALE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."animal_size" AS ENUM('SMALL', 'MEDIUM', 'LARGE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('ACTIVE', 'RESOLVED', 'ADOPTED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."publication_type" AS ENUM('LOST', 'FOUND', 'ADOPTION');--> statement-breakpoint
CREATE TYPE "public"."species" AS ENUM('DOG', 'CAT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'SHELTER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'BLOCKED');--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120),
	"species" "species" NOT NULL,
	"breed" varchar(120),
	"sex" "animal_sex" DEFAULT 'UNKNOWN' NOT NULL,
	"color" varchar(120),
	"size" "animal_size" DEFAULT 'UNKNOWN' NOT NULL,
	"approximate_age" integer,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "animals_name_not_blank" CHECK ("animals"."name" is null or length(btrim("animals"."name")) > 0),
	CONSTRAINT "animals_approximate_age_non_negative" CHECK ("animals"."approximate_age" is null or "animals"."approximate_age" >= 0)
);
--> statement-breakpoint
CREATE TABLE "publication_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_images_position_non_negative" CHECK ("publication_images"."position" >= 0),
	CONSTRAINT "publication_images_storage_key_not_blank" CHECK (length(btrim("publication_images"."storage_key")) > 0)
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"type" "publication_type" NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"status" "publication_status" DEFAULT 'ACTIVE' NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "publications_title_not_blank" CHECK (length(btrim("publications"."title")) > 0),
	CONSTRAINT "publications_latitude_range" CHECK ("publications"."latitude" is null or ("publications"."latitude" >= -90 and "publications"."latitude" <= 90)),
	CONSTRAINT "publications_longitude_range" CHECK ("publications"."longitude" is null or ("publications"."longitude" >= -180 and "publications"."longitude" <= 180)),
	CONSTRAINT "publications_coordinates_pair" CHECK (("publications"."latitude" is null) = ("publications"."longitude" is null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_name_not_blank" CHECK (length(btrim("users"."name")) > 0),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
ALTER TABLE "publication_images" ADD CONSTRAINT "publication_images_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_images_publication_position_unique" ON "publication_images" USING btree ("publication_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_images_storage_key_unique" ON "publication_images" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "publications_user_id_idx" ON "publications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "publications_animal_id_idx" ON "publications" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "publications_type_idx" ON "publications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "publications_status_idx" ON "publications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "publications_event_date_idx" ON "publications" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "publications_created_at_idx" ON "publications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");