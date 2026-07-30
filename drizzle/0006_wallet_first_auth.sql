PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `users_wallet_first` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `telegram_id` text,
  `username` text,
  `display_name` text NOT NULL,
  `photo_url` text,
  `bio` text DEFAULT '' NOT NULL,
  `city` text DEFAULT 'Riga' NOT NULL,
  `wallet_address` text,
  `wallet_network` text,
  `wallet_verified_at` text,
  `moderation_status` text DEFAULT 'active' NOT NULL,
  `rating_milli` integer DEFAULT 5000 NOT NULL,
  `review_count` integer DEFAULT 0 NOT NULL,
  `deals_completed` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
INSERT INTO `users_wallet_first` (
  `id`,
  `telegram_id`,
  `username`,
  `display_name`,
  `photo_url`,
  `bio`,
  `city`,
  `wallet_address`,
  `wallet_network`,
  `wallet_verified_at`,
  `moderation_status`,
  `rating_milli`,
  `review_count`,
  `deals_completed`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `telegram_id`,
  `username`,
  `display_name`,
  `photo_url`,
  `bio`,
  `city`,
  `wallet_address`,
  `wallet_network`,
  `wallet_verified_at`,
  `moderation_status`,
  `rating_milli`,
  `review_count`,
  `deals_completed`,
  `created_at`,
  `updated_at`
FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `users_wallet_first` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_id_idx`
  ON `users` (`telegram_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_wallet_identity_idx`
  ON `users` (`wallet_network`, `wallet_address`)
  WHERE `wallet_network` IS NOT NULL AND `wallet_address` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `wallet_auth_challenges` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` integer,
  `payload` text NOT NULL,
  `expires_at` text NOT NULL,
  `used_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_auth_challenges_payload_idx`
  ON `wallet_auth_challenges` (`payload`);--> statement-breakpoint
CREATE INDEX `wallet_auth_challenges_user_idx`
  ON `wallet_auth_challenges` (`user_id`, `created_at`);--> statement-breakpoint
CREATE INDEX `wallet_auth_challenges_expiry_idx`
  ON `wallet_auth_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `auth_method` text NOT NULL,
  `expires_at` text NOT NULL,
  `revoked_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx`
  ON `auth_sessions` (`user_id`, `created_at`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_idx`
  ON `auth_sessions` (`expires_at`);--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
