CREATE TABLE `blocked_users` (
	`blocker_id` integer NOT NULL,
	`blocked_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_users_pair_idx` ON `blocked_users` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE TABLE `deal_events` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`actor_user_id` integer,
	`type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deal_events_deal_idx` ON `deal_events` (`deal_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_reset_idx` ON `rate_limits` (`reset_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` integer NOT NULL,
	`listing_id` text,
	`reported_user_id` integer,
	`deal_id` text,
	`reason` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reported_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_reporter_idx` ON `reports` (`reporter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wallet_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`payload` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_challenges_payload_idx` ON `wallet_challenges` (`payload`);--> statement-breakpoint
CREATE INDEX `wallet_challenges_user_idx` ON `wallet_challenges` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `deals` ADD `payment_boc_digest` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `seller_tx_hash` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `fee_tx_hash` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `media_key` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `moderation_status` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `wallet_network` text;--> statement-breakpoint
ALTER TABLE `users` ADD `wallet_verified_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `moderation_status` text DEFAULT 'active' NOT NULL;