CREATE TABLE "storage_deletion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "storage_deletion_jobs_attempts_non_negative" CHECK ("storage_deletion_jobs"."attempts" >= 0),
	CONSTRAINT "storage_deletion_jobs_storage_key_not_blank" CHECK (length(btrim("storage_deletion_jobs"."storage_key")) > 0)
);
--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "thumbnail_storage_key" varchar(512);--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "mime_type" varchar(64);--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "display_width" integer;--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "display_height" integer;--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "display_byte_size" integer;--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "display_checksum_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "thumbnail_width" integer;--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "thumbnail_height" integer;--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "thumbnail_byte_size" integer;--> statement-breakpoint
ALTER TABLE "publication_images" ADD COLUMN "thumbnail_checksum_sha256" varchar(64);--> statement-breakpoint
CREATE INDEX "storage_deletion_jobs_pending_idx" ON "storage_deletion_jobs" USING btree ("completed_at","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_images_thumbnail_storage_key_unique" ON "publication_images" USING btree ("thumbnail_storage_key");--> statement-breakpoint
ALTER TABLE "publication_images" ADD CONSTRAINT "publication_images_thumbnail_storage_key_not_blank" CHECK ("publication_images"."thumbnail_storage_key" is null or length(btrim("publication_images"."thumbnail_storage_key")) > 0);--> statement-breakpoint
ALTER TABLE "publication_images" ADD CONSTRAINT "publication_images_normalized_mime_type" CHECK ("publication_images"."mime_type" is null or "publication_images"."mime_type" = 'image/webp');--> statement-breakpoint
ALTER TABLE "publication_images" ADD CONSTRAINT "publication_images_display_metadata_complete" CHECK (("publication_images"."mime_type" is null and "publication_images"."display_width" is null and "publication_images"."display_height" is null and "publication_images"."display_byte_size" is null and "publication_images"."display_checksum_sha256" is null) or ("publication_images"."mime_type" = 'image/webp' and "publication_images"."display_width" is not null and "publication_images"."display_width" > 0 and "publication_images"."display_width" <= 2048 and "publication_images"."display_height" is not null and "publication_images"."display_height" > 0 and "publication_images"."display_height" <= 2048 and "publication_images"."display_byte_size" is not null and "publication_images"."display_byte_size" > 0 and "publication_images"."display_checksum_sha256" is not null and "publication_images"."display_checksum_sha256" ~ '^[0-9a-f]{64}$'));--> statement-breakpoint
ALTER TABLE "publication_images" ADD CONSTRAINT "publication_images_thumbnail_metadata_complete" CHECK (("publication_images"."thumbnail_storage_key" is null and "publication_images"."thumbnail_width" is null and "publication_images"."thumbnail_height" is null and "publication_images"."thumbnail_byte_size" is null and "publication_images"."thumbnail_checksum_sha256" is null) or ("publication_images"."mime_type" = 'image/webp' and "publication_images"."thumbnail_storage_key" is not null and "publication_images"."thumbnail_width" is not null and "publication_images"."thumbnail_width" > 0 and "publication_images"."thumbnail_width" <= 640 and "publication_images"."thumbnail_height" is not null and "publication_images"."thumbnail_height" > 0 and "publication_images"."thumbnail_height" <= 640 and "publication_images"."thumbnail_byte_size" is not null and "publication_images"."thumbnail_byte_size" > 0 and "publication_images"."thumbnail_checksum_sha256" is not null and "publication_images"."thumbnail_checksum_sha256" ~ '^[0-9a-f]{64}$'));
