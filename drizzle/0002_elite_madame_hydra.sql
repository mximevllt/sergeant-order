ALTER TABLE `magic_link_tokens` ADD `requested_name` text;--> statement-breakpoint
CREATE INDEX `idx_magic_link_tokens_email_created` ON `magic_link_tokens` (`email_normalized`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_magic_link_tokens_ip_created` ON `magic_link_tokens` (`requested_ip_hash`,`created_at`);