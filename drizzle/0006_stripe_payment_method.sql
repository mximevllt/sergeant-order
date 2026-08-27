ALTER TABLE `payments` ADD `provider_payment_method_reference` text;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_payments_provider_payment_method`
ON `payments` (`method`, `provider_payment_method_reference`)
WHERE `provider_payment_method_reference` IS NOT NULL;
