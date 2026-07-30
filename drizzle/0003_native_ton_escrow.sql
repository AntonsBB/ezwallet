ALTER TABLE `deals` ADD `arbitrator_wallet_address` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `application_id` text REFERENCES `applications`(`id`);--> statement-breakpoint
ALTER TABLE `deals` ADD `asset` text DEFAULT 'TON' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `escrow_address` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `escrow_code_hash` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `escrow_data_hash` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `escrow_funding_amount_nano` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `escrow_funding_tx_hash` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `escrow_settlement_tx_hash` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `escrow_status` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `delivery_deadline_unix` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `review_window_seconds` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `review_deadline_unix` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `deals_escrow_address_idx` ON `deals` (`escrow_address`);--> statement-breakpoint
CREATE UNIQUE INDEX `deals_listing_active_idx` ON `deals` (`listing_id`)
  WHERE `status` IN ('pending_wallet', 'payment_submitted', 'awaiting_delivery', 'disputed');--> statement-breakpoint
CREATE TABLE `deal_chain_actions` (
  `id` text PRIMARY KEY NOT NULL,
  `deal_id` text NOT NULL,
  `actor_user_id` integer,
  `actor_wallet_address` text NOT NULL,
  `kind` text NOT NULL,
  `query_id` text NOT NULL,
  `detail_hash` text DEFAULT '0' NOT NULL,
  `payload_base64` text NOT NULL,
  `message_value_nano` text NOT NULL,
  `status` text DEFAULT 'prepared' NOT NULL,
  `transaction_ref` text,
  `submission_boc_digest` text,
  `tx_hash` text,
  `submitted_at` text,
  `confirmed_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `deal_chain_actions_deal_idx`
  ON `deal_chain_actions` (`deal_id`, `created_at`);--> statement-breakpoint
CREATE INDEX `deal_chain_actions_status_idx`
  ON `deal_chain_actions` (`status`, `submitted_at`);
