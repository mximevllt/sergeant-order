UPDATE `schedule_reservation_slots`
SET `status` = 'RELEASED'
WHERE `status` = 'ACTIVE'
  AND `reservation_id` IN (
    SELECT `id`
    FROM `schedule_reservations`
    WHERE `kind` = 'HOLD'
      AND `status` = 'ACTIVE'
      AND `quote_id` IS NOT NULL
      AND `id` NOT IN (
        SELECT MIN(`id`)
        FROM `schedule_reservations`
        WHERE `kind` = 'HOLD' AND `status` = 'ACTIVE' AND `quote_id` IS NOT NULL
        GROUP BY `quote_id`
      )
  );

--> statement-breakpoint
UPDATE `schedule_reservations`
SET `status` = 'RELEASED', `updated_at` = CURRENT_TIMESTAMP
WHERE `kind` = 'HOLD'
  AND `status` = 'ACTIVE'
  AND `quote_id` IS NOT NULL
  AND `id` NOT IN (
    SELECT MIN(`id`)
    FROM `schedule_reservations`
    WHERE `kind` = 'HOLD' AND `status` = 'ACTIVE' AND `quote_id` IS NOT NULL
    GROUP BY `quote_id`
  );

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_schedule_reservations_quote_active_hold`
ON `schedule_reservations` (`quote_id`)
WHERE `status` = 'ACTIVE' AND `kind` = 'HOLD' AND `quote_id` IS NOT NULL;
