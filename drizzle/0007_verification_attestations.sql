CREATE TABLE `verification_attestations` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `kind` text NOT NULL,
  `status` text NOT NULL,
  `provider` text NOT NULL,
  `provider_reference_hash` text NOT NULL,
  `assurance_level` integer DEFAULT 1 NOT NULL,
  `verified_at` text,
  `expires_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `verification_provider_reference_idx`
  ON `verification_attestations` (`provider`, `provider_reference_hash`);--> statement-breakpoint
CREATE INDEX `verification_user_status_idx`
  ON `verification_attestations` (`user_id`, `status`, `expires_at`);
