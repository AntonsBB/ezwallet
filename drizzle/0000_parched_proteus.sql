CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`applicant_id` integer NOT NULL,
	`offer_nano` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`applicant_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_listing_applicant_idx` ON `applications` (`listing_id`,`applicant_id`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` integer NOT NULL,
	`seller_id` integer NOT NULL,
	`buyer_wallet_address` text NOT NULL,
	`seller_wallet_address` text NOT NULL,
	`platform_wallet_address` text NOT NULL,
	`gross_nano` text NOT NULL,
	`platform_fee_nano` text NOT NULL,
	`seller_amount_nano` text NOT NULL,
	`fee_bps` integer DEFAULT 100 NOT NULL,
	`network` text NOT NULL,
	`status` text DEFAULT 'pending_wallet' NOT NULL,
	`transaction_ref` text,
	`submitted_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deals_buyer_idx` ON `deals` (`buyer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `deals_seller_idx` ON `deals` (`seller_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`account_user_id` integer,
	`kind` text NOT NULL,
	`amount_nano` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`transaction_ref` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_deal_idx` ON `ledger_entries` (`deal_id`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` integer NOT NULL,
	`section` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`price_nano` text NOT NULL,
	`currency` text DEFAULT 'TON' NOT NULL,
	`image_url` text,
	`location` text DEFAULT 'Remote' NOT NULL,
	`delivery` text DEFAULT 'Arrange in chat' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listings_section_status_idx` ON `listings` (`section`,`status`);--> statement-breakpoint
CREATE INDEX `listings_owner_idx` ON `listings` (`owner_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`reviewer_id` integer NOT NULL,
	`reviewee_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_deal_reviewer_idx` ON `reviews` (`deal_id`,`reviewer_id`);--> statement-breakpoint
CREATE INDEX `reviews_reviewee_idx` ON `reviews` (`reviewee_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_id` text NOT NULL,
	`username` text,
	`display_name` text NOT NULL,
	`photo_url` text,
	`bio` text DEFAULT '' NOT NULL,
	`city` text DEFAULT 'Riga' NOT NULL,
	`wallet_address` text,
	`rating_milli` integer DEFAULT 5000 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`deals_completed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_id_idx` ON `users` (`telegram_id`);