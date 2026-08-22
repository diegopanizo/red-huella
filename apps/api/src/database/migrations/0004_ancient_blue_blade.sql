CREATE TYPE "public"."publication_contact_method" AS ENUM('WHATSAPP', 'PHONE', 'EMAIL');--> statement-breakpoint
CREATE TABLE "publication_contact_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"method" "publication_contact_method" NOT NULL,
	"value" varchar(320) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_contact_methods_value_trimmed" CHECK ("publication_contact_methods"."value" = btrim("publication_contact_methods"."value")),
	CONSTRAINT "publication_contact_methods_value_not_empty" CHECK (length("publication_contact_methods"."value") > 0),
	CONSTRAINT "publication_contact_methods_email_length" CHECK ("publication_contact_methods"."method" <> 'EMAIL' or length("publication_contact_methods"."value") <= 254),
	CONSTRAINT "publication_contact_methods_phone_e164" CHECK ("publication_contact_methods"."method" not in ('PHONE', 'WHATSAPP') or "publication_contact_methods"."value" ~ '^[+][1-9][0-9]{7,14}$')
);
--> statement-breakpoint
ALTER TABLE "publication_contact_methods" ADD CONSTRAINT "publication_contact_methods_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_contact_methods_publication_method_unique" ON "publication_contact_methods" USING btree ("publication_id","method");
