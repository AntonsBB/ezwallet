ALTER TABLE `identity_link_tickets`
  ADD `exchanged_challenge_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `identity_link_tickets_challenge_idx`
  ON `identity_link_tickets` (`exchanged_challenge_id`)
  WHERE `exchanged_challenge_id` IS NOT NULL;--> statement-breakpoint
CREATE TRIGGER `deals_require_current_listing_eligibility`
BEFORE INSERT ON `deals`
WHEN NOT EXISTS (
  SELECT 1
  FROM `listings` AS `listing`
  INNER JOIN `users` AS `buyer`
    ON `buyer`.`id` = NEW.`buyer_id`
  INNER JOIN `users` AS `seller`
    ON `seller`.`id` = NEW.`seller_id`
  WHERE
    `listing`.`id` = NEW.`listing_id`
    AND `listing`.`status` = 'active'
    AND `listing`.`moderation_status` = 'approved'
    AND `buyer`.`moderation_status` = 'active'
    AND `seller`.`moderation_status` = 'active'
    AND (
      (
        `listing`.`type` = 'job'
        AND `listing`.`owner_id` = NEW.`buyer_id`
        AND NEW.`application_id` IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM `applications` AS `application`
          WHERE
            `application`.`id` = NEW.`application_id`
            AND `application`.`listing_id` = NEW.`listing_id`
            AND `application`.`applicant_id` = NEW.`seller_id`
            AND `application`.`status` = 'sent'
        )
      )
      OR
      (
        `listing`.`type` IN ('physical', 'digital', 'service')
        AND `listing`.`owner_id` = NEW.`seller_id`
        AND NEW.`application_id` IS NULL
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'deal_listing_not_eligible');
END;
