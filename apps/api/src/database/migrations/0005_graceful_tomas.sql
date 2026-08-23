CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."visual_embedding_status" AS ENUM('PENDING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TABLE "publication_image_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_image_id" uuid NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"model_version" varchar(128) NOT NULL,
	"embedding" vector(512),
	"image_checksum" varchar(64) NOT NULL,
	"status" "visual_embedding_status" DEFAULT 'PENDING' NOT NULL,
	"last_error_code" varchar(64),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_image_embeddings_model_id_not_blank" CHECK (length(btrim("publication_image_embeddings"."model_id")) > 0),
	CONSTRAINT "publication_image_embeddings_model_version_not_blank" CHECK (length(btrim("publication_image_embeddings"."model_version")) > 0),
	CONSTRAINT "publication_image_embeddings_checksum_sha256" CHECK ("publication_image_embeddings"."image_checksum" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "publication_image_embeddings_attempt_count_non_negative" CHECK ("publication_image_embeddings"."attempt_count" >= 0),
	CONSTRAINT "publication_image_embeddings_lifecycle_consistent" CHECK (("publication_image_embeddings"."status" = 'READY' and "publication_image_embeddings"."embedding" is not null and "publication_image_embeddings"."generated_at" is not null and "publication_image_embeddings"."last_error_code" is null) or ("publication_image_embeddings"."status" = 'PENDING' and "publication_image_embeddings"."embedding" is null and "publication_image_embeddings"."generated_at" is null and "publication_image_embeddings"."last_error_code" is null) or ("publication_image_embeddings"."status" = 'FAILED' and "publication_image_embeddings"."embedding" is null and "publication_image_embeddings"."generated_at" is null and "publication_image_embeddings"."last_error_code" is not null))
);
--> statement-breakpoint
ALTER TABLE "publication_image_embeddings" ADD CONSTRAINT "publication_image_embeddings_publication_image_id_publication_images_id_fk" FOREIGN KEY ("publication_image_id") REFERENCES "public"."publication_images"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_image_embeddings_image_model_unique" ON "publication_image_embeddings" USING btree ("publication_image_id","model_id","model_version");
