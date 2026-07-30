ALTER TABLE `listings`
  ADD `fulfillment_mode` text DEFAULT 'service' NOT NULL;--> statement-breakpoint
UPDATE `listings`
SET `fulfillment_mode` = CASE
  WHEN `type` = 'physical' THEN 'shipping'
  WHEN `type` = 'digital' THEN 'digital'
  ELSE 'service'
END;--> statement-breakpoint
CREATE TABLE `deal_fulfillments` (
  `deal_id` text PRIMARY KEY NOT NULL,
  `mode` text NOT NULL,
  `delivery_address_ciphertext` text,
  `delivery_address_version` integer,
  `carrier` text,
  `tracking_code` text,
  `shipped_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `deal_fulfillments_mode_idx`
  ON `deal_fulfillments` (`mode`, `shipped_at`);
