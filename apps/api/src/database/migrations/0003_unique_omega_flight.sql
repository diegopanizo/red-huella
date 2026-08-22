CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "exact_location" geography(Point,4326);--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "public_location" geography(Point,4326);--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "public_location_radius_meters" integer;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "location_privacy_version" smallint;--> statement-breakpoint
CREATE INDEX "publications_public_location_gist_idx" ON "publications" USING gist ("public_location");--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_public_location_complete" CHECK (("publications"."public_location" is null and "publications"."public_location_radius_meters" is null and "publications"."location_privacy_version" is null) or ("publications"."public_location" is not null and "publications"."public_location_radius_meters" is not null and "publications"."location_privacy_version" is not null));--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_public_location_radius_valid" CHECK ("publications"."public_location_radius_meters" is null or ("publications"."public_location_radius_meters" > 0 and "publications"."public_location_radius_meters" <= 10000));--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_location_privacy_version_positive" CHECK ("publications"."location_privacy_version" is null or "publications"."location_privacy_version" > 0);
