ALTER TABLE `deals` ADD `buyer_fee_nano` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `seller_fee_nano` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `buyer_total_nano` text DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE `deals`
SET
  `seller_fee_nano` = `platform_fee_nano`,
  `buyer_total_nano` = `gross_nano`
WHERE `buyer_total_nano` = '0';
