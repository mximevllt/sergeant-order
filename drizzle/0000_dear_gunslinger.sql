CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text,
	`organization_id` text,
	`kind` text NOT NULL,
	`label` text,
	`line1` text NOT NULL,
	`line2` text,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`insee_code` text,
	`department_code` text NOT NULL,
	`country_code` text DEFAULT 'FR' NOT NULL,
	`latitude_e6` integer,
	`longitude_e6` integer,
	`geocoding_precision` text,
	`geocoding_provider_id` text,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_addresses_owner" CHECK("addresses"."owner_user_id" IS NOT NULL OR "addresses"."organization_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_addresses_owner` ON `addresses` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_addresses_organization` ON `addresses` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_addresses_location` ON `addresses` (`department_code`,`postal_code`,`city`);--> statement-breakpoint
CREATE TABLE `aici_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`urssaf_customer_reference` text,
	`encrypted_registration_data` text,
	`encryption_key_version` text,
	`consent_at` text,
	`activated_at` text,
	`last_synchronized_at` text,
	`last_error_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_aici_customers_user` ON `aici_customers` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_aici_customers_reference` ON `aici_customers` (`urssaf_customer_reference`) WHERE "aici_customers"."urssaf_customer_reference" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_aici_customers_status` ON `aici_customers` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `aici_payment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`aici_customer_id` text NOT NULL,
	`order_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`status` text DEFAULT 'CREATED' NOT NULL,
	`eligible_amount_cents` integer NOT NULL,
	`customer_charge_cents` integer NOT NULL,
	`tax_credit_cents` integer NOT NULL,
	`provider_reference` text,
	`idempotency_key` text NOT NULL,
	`submitted_at` text,
	`settled_at` text,
	`rejection_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`aici_customer_id`) REFERENCES `aici_customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_aici_payment_requests_amounts" CHECK("aici_payment_requests"."eligible_amount_cents" >= 0 AND "aici_payment_requests"."customer_charge_cents" >= 0 AND "aici_payment_requests"."tax_credit_cents" >= 0 AND "aici_payment_requests"."customer_charge_cents" + "aici_payment_requests"."tax_credit_cents" = "aici_payment_requests"."eligible_amount_cents")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_aici_payment_requests_idempotency` ON `aici_payment_requests` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_aici_payment_requests_provider` ON `aici_payment_requests` (`provider_reference`) WHERE "aici_payment_requests"."provider_reference" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_aici_payment_requests_status` ON `aici_payment_requests` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_aici_payment_requests_invoice` ON `aici_payment_requests` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`actor_user_id` text,
	`actor_type` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`request_id` text,
	`ip_hash` text,
	`before_json` text,
	`after_json` text,
	`metadata_json` text,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_entity` ON `audit_events` (`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_actor` ON `audit_events` (`actor_user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_action` ON `audit_events` (`action`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`kind` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ip_hash` text,
	`user_agent` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_auth_sessions_token_hash` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user_active` ON `auth_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `catalog_services` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`kind` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_catalog_services_code` ON `catalog_services` (`code`);--> statement-breakpoint
CREATE INDEX `idx_catalog_services_active_sort` ON `catalog_services` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `catalog_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`measurement_kind` text NOT NULL,
	`eligible_sap` integer DEFAULT true NOT NULL,
	`required_capability` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `catalog_services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_catalog_tasks_service_code` ON `catalog_tasks` (`service_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_catalog_tasks_active_sort` ON `catalog_tasks` (`service_id`,`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`customer_type` text NOT NULL,
	`stripe_customer_id` text,
	`marketing_consent_at` text,
	`terms_accepted_at` text,
	`privacy_accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_customer_profiles_stripe_customer` ON `customer_profiles` (`stripe_customer_id`) WHERE "customer_profiles"."stripe_customer_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_customer_profiles_type` ON `customer_profiles` (`customer_type`);--> statement-breakpoint
CREATE TABLE `garden_access_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`garden_id` text NOT NULL,
	`kind` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`encryption_key_version` text NOT NULL,
	`last_four_hint` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`garden_id`) REFERENCES `gardens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_garden_access_secrets_garden` ON `garden_access_secrets` (`garden_id`);--> statement-breakpoint
CREATE TABLE `garden_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`garden_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`instructions` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`garden_id`) REFERENCES `gardens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_garden_contacts_garden` ON `garden_contacts` (`garden_id`);--> statement-breakpoint
CREATE TABLE `gardens` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text,
	`organization_id` text,
	`address_id` text NOT NULL,
	`label` text NOT NULL,
	`surface_m2` integer,
	`terrain_slope` text DEFAULT 'UNKNOWN' NOT NULL,
	`access_width_cm` integer,
	`has_animals` integer DEFAULT false NOT NULL,
	`parking_notes` text,
	`public_notes` text,
	`internal_notes` text,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_gardens_owner" CHECK("gardens"."owner_user_id" IS NOT NULL OR "gardens"."organization_id" IS NOT NULL),
	CONSTRAINT "ck_gardens_surface" CHECK("gardens"."surface_m2" IS NULL OR "gardens"."surface_m2" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_gardens_owner` ON `gardens` (`owner_user_id`,`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_gardens_organization` ON `gardens` (`organization_id`,`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_gardens_address` ON `gardens` (`address_id`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text DEFAULT 'PROCESSING' NOT NULL,
	`response_status` integer,
	`response_body_json` text,
	`resource_type` text,
	`resource_id` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_idempotency_keys_scope_key` ON `idempotency_keys` (`scope`,`key`);--> statement-breakpoint
CREATE INDEX `idx_idempotency_keys_expiry` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE TABLE `intervention_events` (
	`id` text PRIMARY KEY NOT NULL,
	`intervention_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_user_id` text,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`public_note` text,
	`internal_note` text,
	`metadata_json` text,
	FOREIGN KEY (`intervention_id`) REFERENCES `interventions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_intervention_events_timeline` ON `intervention_events` (`intervention_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `intervention_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`intervention_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`customer_summary` text,
	`internal_summary` text,
	`incident_reported` integer DEFAULT false NOT NULL,
	`incident_details` text,
	`proposed_total_ttc_cents` integer,
	`closed_by_user_id` text,
	`closed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`intervention_id`) REFERENCES `interventions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_intervention_reports_amount" CHECK("intervention_reports"."proposed_total_ttc_cents" IS NULL OR "intervention_reports"."proposed_total_ttc_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_intervention_reports_intervention` ON `intervention_reports` (`intervention_id`);--> statement-breakpoint
CREATE INDEX `idx_intervention_reports_status` ON `intervention_reports` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `intervention_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`intervention_id` text NOT NULL,
	`order_task_id` text NOT NULL,
	`status` text DEFAULT 'TODO' NOT NULL,
	`actual_measurement_json` text,
	`notes` text,
	`completed_at` text,
	`completed_by_user_id` text,
	FOREIGN KEY (`intervention_id`) REFERENCES `interventions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_task_id`) REFERENCES `order_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_intervention_tasks_order_task` ON `intervention_tasks` (`intervention_id`,`order_task_id`);--> statement-breakpoint
CREATE INDEX `idx_intervention_tasks_status` ON `intervention_tasks` (`intervention_id`,`status`);--> statement-breakpoint
CREATE TABLE `interventions` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`team_id` text NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`planned_starts_at` text NOT NULL,
	`planned_ends_at` text NOT NULL,
	`departed_at` text,
	`arrived_at` text,
	`started_at` text,
	`completed_at` text,
	`actual_minutes` integer,
	`mission_snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_interventions_planned_range" CHECK("interventions"."planned_ends_at" > "interventions"."planned_starts_at"),
	CONSTRAINT "ck_interventions_actual_minutes" CHECK("interventions"."actual_minutes" IS NULL OR "interventions"."actual_minutes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_interventions_order_sequence` ON `interventions` (`order_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_interventions_team_planned` ON `interventions` (`team_id`,`planned_starts_at`);--> statement-breakpoint
CREATE INDEX `idx_interventions_status_planned` ON `interventions` (`status`,`planned_starts_at`);--> statement-breakpoint
CREATE TABLE `invoice_counters` (
	`series` text NOT NULL,
	`year` integer NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`series`, `year`),
	CONSTRAINT "ck_invoice_counters_number" CHECK("invoice_counters"."last_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE `invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity_milliunits` integer DEFAULT 1000 NOT NULL,
	`unit_label` text DEFAULT 'forfait' NOT NULL,
	`unit_price_ht_cents` integer NOT NULL,
	`vat_rate_basis_points` integer NOT NULL,
	`line_ht_cents` integer NOT NULL,
	`line_vat_cents` integer NOT NULL,
	`line_ttc_cents` integer NOT NULL,
	`eligible_sap` integer DEFAULT false NOT NULL,
	`source_order_task_id` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_order_task_id`) REFERENCES `order_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_invoice_lines_quantity" CHECK("invoice_lines"."quantity_milliunits" > 0),
	CONSTRAINT "ck_invoice_lines_amounts" CHECK("invoice_lines"."unit_price_ht_cents" >= 0 AND "invoice_lines"."line_ht_cents" >= 0 AND "invoice_lines"."line_vat_cents" >= 0 AND "invoice_lines"."line_ttc_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_invoice_lines_position` ON `invoice_lines` (`invoice_id`,`position`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`customer_user_id` text NOT NULL,
	`organization_id` text,
	`kind` text NOT NULL,
	`original_invoice_id` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`number` text,
	`series` text NOT NULL,
	`sequence_number` integer,
	`issue_date` text,
	`service_period_start` text,
	`service_period_end` text,
	`seller_snapshot` text NOT NULL,
	`customer_snapshot` text NOT NULL,
	`service_address_snapshot` text NOT NULL,
	`subtotal_ht_cents` integer NOT NULL,
	`vat_cents` integer NOT NULL,
	`total_ttc_cents` integer NOT NULL,
	`eligible_sap_cents` integer DEFAULT 0 NOT NULL,
	`paid_cents` integer DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`structured_data` text NOT NULL,
	`document_hash` text,
	`pdf_file_id` text,
	`issued_at` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`original_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_invoices_amounts" CHECK("invoices"."subtotal_ht_cents" >= 0 AND "invoices"."vat_cents" >= 0 AND "invoices"."total_ttc_cents" >= 0 AND "invoices"."eligible_sap_cents" >= 0 AND "invoices"."paid_cents" >= 0),
	CONSTRAINT "ck_invoices_credit_link" CHECK(("invoices"."kind" = 'CREDIT_NOTE' AND "invoices"."original_invoice_id" IS NOT NULL) OR ("invoices"."kind" = 'INVOICE' AND "invoices"."original_invoice_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_invoices_number` ON `invoices` (`number`) WHERE "invoices"."number" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_invoices_series_sequence` ON `invoices` (`series`,`sequence_number`) WHERE "invoices"."sequence_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_invoices_customer_issue` ON `invoices` (`customer_user_id`,`issue_date`);--> statement-breakpoint
CREATE INDEX `idx_invoices_status_issue` ON `invoices` (`status`,`issue_date`);--> statement-breakpoint
CREATE INDEX `idx_invoices_order` ON `invoices` (`order_id`);--> statement-breakpoint
CREATE TABLE `magic_link_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email_normalized` text NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`return_to` text,
	`expires_at` text NOT NULL,
	`used_at` text,
	`requested_ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_magic_link_tokens_hash` ON `magic_link_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_magic_link_tokens_email_expiry` ON `magic_link_tokens` (`email_normalized`,`expires_at`);--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`template` text NOT NULL,
	`template_version` integer NOT NULL,
	`recipient` text NOT NULL,
	`user_id` text,
	`order_id` text,
	`invoice_id` text,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`provider_reference` text,
	`idempotency_key` text NOT NULL,
	`last_error_safe` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_notification_outbox_attempts" CHECK("notification_outbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_notification_outbox_idempotency` ON `notification_outbox` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_notification_outbox_pending` ON `notification_outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `idx_notification_outbox_user` ON `notification_outbox` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`team_id` text NOT NULL,
	`assigned_by_user_id` text NOT NULL,
	`reason` text,
	`starts_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ends_at` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_order_assignments_current` ON `order_assignments` (`order_id`) WHERE "order_assignments"."ends_at" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_order_assignments_team_current` ON `order_assignments` (`team_id`,`ends_at`);--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text,
	`actor_user_id` text,
	`metadata_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_status_history_order` ON `order_status_history` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`catalog_task_id` text,
	`code_snapshot` text NOT NULL,
	`label_snapshot` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`measurement_snapshot` text NOT NULL,
	`price_impact_ttc_cents` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`catalog_task_id`) REFERENCES `catalog_tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_order_tasks_code` ON `order_tasks` (`order_id`,`code_snapshot`);--> statement-breakpoint
CREATE INDEX `idx_order_tasks_priority` ON `order_tasks` (`order_id`,`priority`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`public_reference` text NOT NULL,
	`quote_id` text NOT NULL,
	`customer_user_id` text NOT NULL,
	`organization_id` text,
	`garden_id` text NOT NULL,
	`status` text NOT NULL,
	`payment_method` text NOT NULL,
	`pricing_snapshot` text NOT NULL,
	`service_address_snapshot` text NOT NULL,
	`billing_identity_snapshot` text NOT NULL,
	`selected_half_days` integer NOT NULL,
	`subtotal_ht_cents` integer NOT NULL,
	`vat_cents` integer NOT NULL,
	`total_ttc_cents` integer NOT NULL,
	`eligible_sap_cents` integer DEFAULT 0 NOT NULL,
	`cancellation_reason` text,
	`confirmed_at` text,
	`cancelled_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`garden_id`) REFERENCES `gardens`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_orders_duration" CHECK("orders"."selected_half_days" >= 1),
	CONSTRAINT "ck_orders_amounts" CHECK("orders"."subtotal_ht_cents" >= 0 AND "orders"."vat_cents" >= 0 AND "orders"."total_ttc_cents" >= 0 AND "orders"."eligible_sap_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orders_public_reference` ON `orders` (`public_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orders_quote` ON `orders` (`quote_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_customer_created` ON `orders` (`customer_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_status_created` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_garden_created` ON `orders` (`garden_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`organization_id`, `user_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_organization_memberships_user` ON `organization_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`trade_name` text,
	`siren` text,
	`vat_number` text,
	`billing_email` text NOT NULL,
	`billing_address_snapshot` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_organizations_siren` ON `organizations` (`siren`) WHERE "organizations"."siren" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_organizations_status` ON `organizations` (`status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`invoice_id` text,
	`method` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`provider_reference` text,
	`idempotency_key` text NOT NULL,
	`failure_code` text,
	`failure_message_safe` text,
	`requires_action_url` text,
	`succeeded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_payments_amount" CHECK("payments"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_payments_idempotency` ON `payments` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_payments_provider_reference` ON `payments` (`method`,`provider_reference`) WHERE "payments"."provider_reference" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_payments_order_created` ON `payments` (`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_payments_status_updated` ON `payments` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pricing_version_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`rule_type` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`condition_json` text NOT NULL,
	`calculation_json` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`pricing_version_id`) REFERENCES `pricing_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pricing_rules_version_code` ON `pricing_rules` (`pricing_version_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_pricing_rules_execution` ON `pricing_rules` (`pricing_version_id`,`active`,`priority`);--> statement-breakpoint
CREATE TABLE `pricing_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`label` text NOT NULL,
	`effective_from` text,
	`half_day_ttc_cents` integer NOT NULL,
	`vat_rate_basis_points` integer DEFAULT 2000 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`published_by_user_id` text,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`published_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_pricing_versions_amount" CHECK("pricing_versions"."half_day_ttc_cents" >= 0),
	CONSTRAINT "ck_pricing_versions_vat" CHECK("pricing_versions"."vat_rate_basis_points" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pricing_versions_version` ON `pricing_versions` (`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pricing_versions_single_active` ON `pricing_versions` (`status`) WHERE "pricing_versions"."status" = 'ACTIVE';--> statement-breakpoint
CREATE TABLE `provider_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`signature_verified` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'RECEIVED' NOT NULL,
	`payload_json` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`processed_at` text,
	`last_error_safe` text,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ck_provider_events_attempts" CHECK("provider_events"."attempts" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_provider_events_provider_id` ON `provider_events` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE INDEX `idx_provider_events_pending` ON `provider_events` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `quote_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`amount_ttc_cents` integer NOT NULL,
	`calculation_snapshot` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_quote_adjustments_code` ON `quote_adjustments` (`quote_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_quote_adjustments_sort` ON `quote_adjustments` (`quote_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `quote_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`catalog_task_id` text,
	`code_snapshot` text NOT NULL,
	`label_snapshot` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`measurement_json` text NOT NULL,
	`price_impact_ttc_cents` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`catalog_task_id`) REFERENCES `catalog_tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_quote_tasks_code` ON `quote_tasks` (`quote_id`,`code_snapshot`);--> statement-breakpoint
CREATE INDEX `idx_quote_tasks_priority` ON `quote_tasks` (`quote_id`,`priority`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`public_reference` text NOT NULL,
	`customer_user_id` text,
	`organization_id` text,
	`garden_id` text,
	`pricing_version_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`contact_email` text NOT NULL,
	`contact_phone` text,
	`request_snapshot` text NOT NULL,
	`pricing_snapshot` text,
	`pricing_fingerprint` text,
	`recommended_half_days` integer,
	`selected_half_days` integer,
	`subtotal_ht_cents` integer,
	`vat_cents` integer,
	`total_ttc_cents` integer,
	`eligible_sap_cents` integer,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`garden_id`) REFERENCES `gardens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pricing_version_id`) REFERENCES `pricing_versions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_quotes_duration" CHECK(("quotes"."recommended_half_days" IS NULL OR "quotes"."recommended_half_days" >= 1) AND ("quotes"."selected_half_days" IS NULL OR "quotes"."selected_half_days" >= 1)),
	CONSTRAINT "ck_quotes_amounts" CHECK(("quotes"."subtotal_ht_cents" IS NULL OR "quotes"."subtotal_ht_cents" >= 0) AND ("quotes"."vat_cents" IS NULL OR "quotes"."vat_cents" >= 0) AND ("quotes"."total_ttc_cents" IS NULL OR "quotes"."total_ttc_cents" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_quotes_public_reference` ON `quotes` (`public_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_quotes_pricing_fingerprint` ON `quotes` (`pricing_fingerprint`) WHERE "quotes"."pricing_fingerprint" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_quotes_customer_created` ON `quotes` (`customer_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_quotes_status_expiry` ON `quotes` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `recurring_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_plan_id` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`order_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`recurring_plan_id`) REFERENCES `recurring_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_recurring_occurrences_plan_date` ON `recurring_occurrences` (`recurring_plan_id`,`occurrence_date`);--> statement-breakpoint
CREATE INDEX `idx_recurring_occurrences_status_date` ON `recurring_occurrences` (`status`,`occurrence_date`);--> statement-breakpoint
CREATE TABLE `recurring_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_user_id` text NOT NULL,
	`organization_id` text,
	`garden_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`frequency` text NOT NULL,
	`interval_value` integer DEFAULT 1 NOT NULL,
	`preferred_period` text DEFAULT 'ANY' NOT NULL,
	`template_snapshot` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`next_occurrence_on` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`garden_id`) REFERENCES `gardens`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_recurring_plans_interval" CHECK("recurring_plans"."interval_value" >= 1)
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_plans_due` ON `recurring_plans` (`status`,`next_occurrence_on`);--> statement-breakpoint
CREATE INDEX `idx_recurring_plans_customer` ON `recurring_plans` (`customer_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`provider_reference` text,
	`idempotency_key` text NOT NULL,
	`created_by_user_id` text,
	`succeeded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_refunds_amount" CHECK("refunds"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_refunds_idempotency` ON `refunds` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_refunds_provider_reference` ON `refunds` (`provider_reference`) WHERE "refunds"."provider_reference" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_refunds_payment` ON `refunds` (`payment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `schedule_reservation_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_id` text NOT NULL,
	`team_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `schedule_reservations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_schedule_slots_range" CHECK("schedule_reservation_slots"."ends_at" > "schedule_reservation_slots"."starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_schedule_slots_team_start_active` ON `schedule_reservation_slots` (`team_id`,`starts_at`) WHERE "schedule_reservation_slots"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_schedule_slots_reservation_start` ON `schedule_reservation_slots` (`reservation_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_schedule_slots_range` ON `schedule_reservation_slots` (`team_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `schedule_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text,
	`order_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`expires_at` text,
	`idempotency_key` text NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_schedule_reservations_target" CHECK("schedule_reservations"."quote_id" IS NOT NULL OR "schedule_reservations"."order_id" IS NOT NULL OR "schedule_reservations"."kind" = 'BLOCK')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_schedule_reservations_idempotency` ON `schedule_reservations` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_schedule_reservations_quote` ON `schedule_reservations` (`quote_id`);--> statement-breakpoint
CREATE INDEX `idx_schedule_reservations_order` ON `schedule_reservations` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_schedule_reservations_expiry` ON `schedule_reservations` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `service_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`department_code` text NOT NULL,
	`min_lead_hours` integer DEFAULT 24 NOT NULL,
	`max_advance_days` integer DEFAULT 31 NOT NULL,
	`surcharge_ttc_cents` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`polygon_geojson` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ck_service_zones_lead" CHECK("service_zones"."min_lead_hours" >= 0 AND "service_zones"."max_advance_days" >= 1),
	CONSTRAINT "ck_service_zones_surcharge" CHECK("service_zones"."surcharge_ttc_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_service_zones_code` ON `service_zones` (`code`);--> statement-breakpoint
CREATE INDEX `idx_service_zones_department_active` ON `service_zones` (`department_code`,`active`);--> statement-breakpoint
CREATE TABLE `stored_files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text,
	`organization_id` text,
	`garden_id` text,
	`order_id` text,
	`intervention_id` text,
	`invoice_id` text,
	`kind` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`media_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`uploaded_by_user_id` text,
	`retention_until` text,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`garden_id`) REFERENCES `gardens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`intervention_id`) REFERENCES `interventions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_stored_files_size" CHECK("stored_files"."size_bytes" >= 0),
	CONSTRAINT "ck_stored_files_parent" CHECK("stored_files"."owner_user_id" IS NOT NULL OR "stored_files"."organization_id" IS NOT NULL OR "stored_files"."order_id" IS NOT NULL OR "stored_files"."intervention_id" IS NOT NULL OR "stored_files"."invoice_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_stored_files_storage_key` ON `stored_files` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_stored_files_owner` ON `stored_files` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_stored_files_order_kind` ON `stored_files` (`order_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_stored_files_intervention_kind` ON `stored_files` (`intervention_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_stored_files_retention` ON `stored_files` (`status`,`retention_until`);--> statement-breakpoint
CREATE TABLE `team_capabilities` (
	`team_id` text NOT NULL,
	`capability` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`team_id`, `capability`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'MEMBER' NOT NULL,
	`starts_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ends_at` text,
	PRIMARY KEY(`team_id`, `user_id`, `starts_at`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_team_members_user_active` ON `team_members` (`user_id`,`ends_at`);--> statement-breakpoint
CREATE TABLE `team_unavailabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`reason` text NOT NULL,
	`notes` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_team_unavailabilities_range" CHECK("team_unavailabilities"."ends_at" > "team_unavailabilities"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `idx_team_unavailabilities_range` ON `team_unavailabilities` (`team_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `team_weekly_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`iso_weekday` integer NOT NULL,
	`period` text NOT NULL,
	`starts_local` text NOT NULL,
	`ends_local` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_team_weekly_hours_weekday" CHECK("team_weekly_hours"."iso_weekday" BETWEEN 1 AND 7)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_team_weekly_hours_slot` ON `team_weekly_hours` (`team_id`,`iso_weekday`,`period`);--> statement-breakpoint
CREATE INDEX `idx_team_weekly_hours_lookup` ON `team_weekly_hours` (`iso_weekday`,`active`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`start_address_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`start_address_id`) REFERENCES `addresses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_teams_code` ON `teams` (`code`);--> statement-breakpoint
CREATE INDEX `idx_teams_active` ON `teams` (`active`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`granted_by_user_id` text,
	`granted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `role`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_roles_role` ON `user_roles` (`role`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_normalized` text NOT NULL,
	`email_verified_at` text,
	`full_name` text NOT NULL,
	`phone` text,
	`locale` text DEFAULT 'fr-FR' NOT NULL,
	`status` text DEFAULT 'INVITED' NOT NULL,
	`last_login_at` text,
	`disabled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_email_normalized` ON `users` (`email_normalized`);--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`status`);--> statement-breakpoint
CREATE TABLE `zone_municipalities` (
	`zone_id` text NOT NULL,
	`insee_code` text NOT NULL,
	`postal_code` text NOT NULL,
	`city_name` text NOT NULL,
	`included` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`zone_id`, `insee_code`, `postal_code`),
	FOREIGN KEY (`zone_id`) REFERENCES `service_zones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_zone_municipalities_lookup` ON `zone_municipalities` (`postal_code`,`insee_code`,`included`);
--> statement-breakpoint
CREATE TRIGGER `trg_audit_events_no_update`
BEFORE UPDATE ON `audit_events`
BEGIN
	SELECT RAISE(ABORT, 'audit events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_audit_events_no_delete`
BEFORE DELETE ON `audit_events`
BEGIN
	SELECT RAISE(ABORT, 'audit events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_order_status_history_no_update`
BEFORE UPDATE ON `order_status_history`
BEGIN
	SELECT RAISE(ABORT, 'order status history is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_order_status_history_no_delete`
BEFORE DELETE ON `order_status_history`
BEGIN
	SELECT RAISE(ABORT, 'order status history is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_intervention_events_no_update`
BEFORE UPDATE ON `intervention_events`
BEGIN
	SELECT RAISE(ABORT, 'intervention events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_intervention_events_no_delete`
BEFORE DELETE ON `intervention_events`
BEGIN
	SELECT RAISE(ABORT, 'intervention events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_provider_events_payload_immutable`
BEFORE UPDATE OF `provider`, `provider_event_id`, `event_type`, `payload_json`, `received_at`
ON `provider_events`
BEGIN
	SELECT RAISE(ABORT, 'provider event identity and payload are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_invoices_issued_financials_immutable`
BEFORE UPDATE OF
	`order_id`, `customer_user_id`, `organization_id`, `kind`, `original_invoice_id`,
	`number`, `series`, `sequence_number`, `issue_date`, `service_period_start`,
	`service_period_end`, `seller_snapshot`, `customer_snapshot`,
	`service_address_snapshot`, `subtotal_ht_cents`, `vat_cents`, `total_ttc_cents`,
	`eligible_sap_cents`, `payment_method`, `structured_data`, `document_hash`
ON `invoices`
WHEN OLD.`status` <> 'DRAFT'
BEGIN
	SELECT RAISE(ABORT, 'issued invoice financial data is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_invoices_issued_no_delete`
BEFORE DELETE ON `invoices`
WHEN OLD.`status` <> 'DRAFT'
BEGIN
	SELECT RAISE(ABORT, 'issued invoices cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_invoice_lines_issued_no_insert`
BEFORE INSERT ON `invoice_lines`
WHEN (SELECT `status` FROM `invoices` WHERE `id` = NEW.`invoice_id`) <> 'DRAFT'
BEGIN
	SELECT RAISE(ABORT, 'issued invoice lines are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_invoice_lines_issued_no_update`
BEFORE UPDATE ON `invoice_lines`
WHEN (SELECT `status` FROM `invoices` WHERE `id` = OLD.`invoice_id`) <> 'DRAFT'
BEGIN
	SELECT RAISE(ABORT, 'issued invoice lines are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_invoice_lines_issued_no_delete`
BEFORE DELETE ON `invoice_lines`
WHEN (SELECT `status` FROM `invoices` WHERE `id` = OLD.`invoice_id`) <> 'DRAFT'
BEGIN
	SELECT RAISE(ABORT, 'issued invoice lines are immutable');
END;
--> statement-breakpoint
PRAGMA optimize;
