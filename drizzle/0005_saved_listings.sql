CREATE TABLE `listing_favorites` (
  `user_id` integer NOT NULL,
  `listing_id` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `listing_favorites_user_listing_idx`
  ON `listing_favorites` (`user_id`, `listing_id`);--> statement-breakpoint
CREATE INDEX `listing_favorites_user_created_idx`
  ON `listing_favorites` (`user_id`, `created_at`);
