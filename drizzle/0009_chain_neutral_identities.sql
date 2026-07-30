CREATE TABLE `account_identities` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `provider` text NOT NULL,
  `namespace` text NOT NULL,
  `subject` text NOT NULL,
  `proof_method` text NOT NULL,
  `verified_at` text NOT NULL,
  `revoked_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `account_identities_provider_subject_idx`
  ON `account_identities` (`provider`, `namespace`, `subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_identities_user_provider_idx`
  ON `account_identities` (`user_id`, `provider`, `namespace`);--> statement-breakpoint
CREATE INDEX `account_identities_user_idx`
  ON `account_identities` (`user_id`, `provider`, `revoked_at`);--> statement-breakpoint
INSERT INTO `account_identities` (
  `id`,
  `user_id`,
  `provider`,
  `namespace`,
  `subject`,
  `proof_method`,
  `verified_at`
)
SELECT
  'legacy-ton-' || `id`,
  `id`,
  'ton',
  `wallet_network`,
  `wallet_address`,
  'ton_proof',
  `wallet_verified_at`
FROM `users`
WHERE
  `wallet_network` IS NOT NULL
  AND `wallet_address` IS NOT NULL
  AND `wallet_verified_at` IS NOT NULL;--> statement-breakpoint
INSERT INTO `account_identities` (
  `id`,
  `user_id`,
  `provider`,
  `namespace`,
  `subject`,
  `proof_method`,
  `verified_at`
)
SELECT
  'legacy-telegram-' || `id`,
  `id`,
  'telegram',
  'user',
  `telegram_id`,
  'legacy_import',
  `created_at`
FROM `users`
WHERE `telegram_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `identity_link_tickets` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `source_identity_id` text NOT NULL,
  `secret_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `used_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`source_identity_id`) REFERENCES `account_identities`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_link_tickets_secret_idx`
  ON `identity_link_tickets` (`secret_hash`);--> statement-breakpoint
CREATE INDEX `identity_link_tickets_user_idx`
  ON `identity_link_tickets` (`user_id`, `created_at`);--> statement-breakpoint
CREATE INDEX `identity_link_tickets_expiry_idx`
  ON `identity_link_tickets` (`expires_at`);--> statement-breakpoint
CREATE TABLE `payment_rail_recipients` (
  `id` text PRIMARY KEY NOT NULL,
  `rail` text NOT NULL,
  `network` text NOT NULL,
  `asset` text NOT NULL,
  `role` text NOT NULL,
  `label` text NOT NULL,
  `address` text NOT NULL,
  `status` text DEFAULT 'unverified' NOT NULL,
  `verified_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_rail_recipients_scope_idx`
  ON `payment_rail_recipients` (`rail`, `network`, `asset`, `role`, `label`);--> statement-breakpoint
CREATE INDEX `payment_rail_recipients_status_idx`
  ON `payment_rail_recipients` (`status`, `rail`, `network`);--> statement-breakpoint
ALTER TABLE `wallet_auth_challenges`
  ADD `link_ticket_id` text REFERENCES `identity_link_tickets`(`id`);--> statement-breakpoint
CREATE INDEX `wallet_auth_challenges_link_ticket_idx`
  ON `wallet_auth_challenges` (`link_ticket_id`, `created_at`);
