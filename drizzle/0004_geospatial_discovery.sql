ALTER TABLE `listings` ADD `latitude_e6` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `longitude_e6` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `location_radius_meters` integer;--> statement-breakpoint
CREATE INDEX `listings_geo_idx`
  ON `listings` (`section`, `status`, `latitude_e6`, `longitude_e6`);
