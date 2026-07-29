import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    telegramId: text("telegram_id").notNull(),
    username: text("username"),
    displayName: text("display_name").notNull(),
    photoUrl: text("photo_url"),
    bio: text("bio").notNull().default(""),
    city: text("city").notNull().default("Riga"),
    walletAddress: text("wallet_address"),
    walletNetwork: text("wallet_network", {
      enum: ["mainnet", "testnet"],
    }),
    walletVerifiedAt: text("wallet_verified_at"),
    moderationStatus: text("moderation_status", {
      enum: ["active", "restricted", "banned"],
    })
      .notNull()
      .default("active"),
    ratingMilli: integer("rating_milli").notNull().default(5000),
    reviewCount: integer("review_count").notNull().default(0),
    dealsCompleted: integer("deals_completed").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("users_telegram_id_idx").on(table.telegramId)]
);

export const listings = sqliteTable(
  "listings",
  {
    id: text("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id),
    section: text("section", { enum: ["market", "work"] }).notNull(),
    type: text("type", {
      enum: ["physical", "digital", "service", "job"],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    priceNano: text("price_nano").notNull(),
    currency: text("currency").notNull().default("TON"),
    imageUrl: text("image_url"),
    mediaKey: text("media_key"),
    location: text("location").notNull().default("Remote"),
    latitudeE6: integer("latitude_e6"),
    longitudeE6: integer("longitude_e6"),
    locationRadiusMeters: integer("location_radius_meters"),
    delivery: text("delivery").notNull().default("Arrange in chat"),
    status: text("status", {
      enum: ["draft", "active", "paused", "sold", "closed", "removed"],
    })
      .notNull()
      .default("active"),
    moderationStatus: text("moderation_status", {
      enum: ["pending", "approved", "rejected"],
    })
      .notNull()
      .default("approved"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("listings_section_status_idx").on(table.section, table.status),
    index("listings_geo_idx").on(
      table.section,
      table.status,
      table.latitudeE6,
      table.longitudeE6
    ),
    index("listings_owner_idx").on(table.ownerId),
  ]
);

export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    applicantId: integer("applicant_id")
      .notNull()
      .references(() => users.id),
    offerNano: text("offer_nano").notNull(),
    message: text("message").notNull(),
    status: text("status", {
      enum: ["sent", "accepted", "declined", "withdrawn"],
    })
      .notNull()
      .default("sent"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("applications_listing_applicant_idx").on(
      table.listingId,
      table.applicantId
    ),
  ]
);

export const deals = sqliteTable(
  "deals",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    applicationId: text("application_id").references(() => applications.id),
    buyerId: integer("buyer_id")
      .notNull()
      .references(() => users.id),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => users.id),
    buyerWalletAddress: text("buyer_wallet_address").notNull(),
    sellerWalletAddress: text("seller_wallet_address").notNull(),
    platformWalletAddress: text("platform_wallet_address").notNull(),
    arbitratorWalletAddress: text("arbitrator_wallet_address"),
    asset: text("asset", { enum: ["TON"] }).notNull().default("TON"),
    grossNano: text("gross_nano").notNull(),
    buyerFeeNano: text("buyer_fee_nano").notNull().default("0"),
    sellerFeeNano: text("seller_fee_nano").notNull().default("0"),
    buyerTotalNano: text("buyer_total_nano").notNull().default("0"),
    platformFeeNano: text("platform_fee_nano").notNull(),
    sellerAmountNano: text("seller_amount_nano").notNull(),
    feeBps: integer("fee_bps").notNull().default(100),
    network: text("network", { enum: ["mainnet", "testnet"] }).notNull(),
    escrowAddress: text("escrow_address"),
    escrowCodeHash: text("escrow_code_hash"),
    escrowDataHash: text("escrow_data_hash"),
    escrowFundingAmountNano: text("escrow_funding_amount_nano"),
    escrowFundingTxHash: text("escrow_funding_tx_hash"),
    escrowSettlementTxHash: text("escrow_settlement_tx_hash"),
    escrowStatus: text("escrow_status", {
      enum: [
        "legacy",
        "awaiting_funding",
        "funded",
        "delivered",
        "disputed",
        "released",
        "refunded",
      ],
    })
      .notNull()
      .default("legacy"),
    deliveryDeadlineUnix: integer("delivery_deadline_unix"),
    reviewWindowSeconds: integer("review_window_seconds"),
    reviewDeadlineUnix: integer("review_deadline_unix"),
    status: text("status", {
      enum: [
        "pending_wallet",
        "payment_submitted",
        "awaiting_delivery",
        "fulfilled",
        "cancelled",
        "disputed",
      ],
    })
      .notNull()
      .default("pending_wallet"),
    transactionRef: text("transaction_ref"),
    paymentBocDigest: text("payment_boc_digest"),
    sellerTxHash: text("seller_tx_hash"),
    feeTxHash: text("fee_tx_hash"),
    submittedAt: text("submitted_at"),
    verifiedAt: text("verified_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("deals_buyer_idx").on(table.buyerId, table.createdAt),
    index("deals_seller_idx").on(table.sellerId, table.createdAt),
    uniqueIndex("deals_listing_active_idx")
      .on(table.listingId)
      .where(
        sql`${table.status} IN ('pending_wallet', 'payment_submitted', 'awaiting_delivery', 'disputed')`
      ),
    uniqueIndex("deals_escrow_address_idx").on(table.escrowAddress),
  ]
);

export const dealChainActions = sqliteTable(
  "deal_chain_actions",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id),
    actorUserId: integer("actor_user_id").references(() => users.id),
    actorWalletAddress: text("actor_wallet_address").notNull(),
    kind: text("kind", {
      enum: [
        "mark_delivered",
        "confirm_received",
        "open_dispute",
        "refund_expired",
        "release_after_review",
        "resolve_release",
        "resolve_refund",
      ],
    }).notNull(),
    queryId: text("query_id").notNull(),
    detailHash: text("detail_hash").notNull().default("0"),
    payloadBase64: text("payload_base64").notNull(),
    messageValueNano: text("message_value_nano").notNull(),
    status: text("status", {
      enum: ["prepared", "submitted", "confirmed", "failed", "expired"],
    })
      .notNull()
      .default("prepared"),
    transactionRef: text("transaction_ref"),
    submissionBocDigest: text("submission_boc_digest"),
    txHash: text("tx_hash"),
    submittedAt: text("submitted_at"),
    confirmedAt: text("confirmed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("deal_chain_actions_deal_idx").on(table.dealId, table.createdAt),
    index("deal_chain_actions_status_idx").on(table.status, table.submittedAt),
  ]
);

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id),
    accountUserId: integer("account_user_id").references(() => users.id),
    kind: text("kind", {
      enum: ["seller_proceeds", "platform_fee", "buyer_payment"],
    }).notNull(),
    amountNano: text("amount_nano").notNull(),
    status: text("status", {
      enum: ["created", "submitted", "recorded", "void"],
    })
      .notNull()
      .default("created"),
    transactionRef: text("transaction_ref"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("ledger_deal_idx").on(table.dealId)]
);

export const dealEvents = sqliteTable(
  "deal_events",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id),
    actorUserId: integer("actor_user_id").references(() => users.id),
    type: text("type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    detail: text("detail").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("deal_events_deal_idx").on(table.dealId, table.createdAt)]
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => users.id),
    revieweeId: integer("reviewee_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(),
    body: text("body").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("reviews_deal_reviewer_idx").on(
      table.dealId,
      table.reviewerId
    ),
    index("reviews_reviewee_idx").on(table.revieweeId, table.createdAt),
  ]
);

export const walletChallenges = sqliteTable(
  "wallet_challenges",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    payload: text("payload").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("wallet_challenges_payload_idx").on(table.payload),
    index("wallet_challenges_user_idx").on(table.userId, table.createdAt),
  ]
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => users.id),
    listingId: text("listing_id").references(() => listings.id),
    reportedUserId: integer("reported_user_id").references(() => users.id),
    dealId: text("deal_id").references(() => deals.id),
    reason: text("reason").notNull(),
    detail: text("detail").notNull().default(""),
    status: text("status", {
      enum: ["open", "reviewing", "resolved", "dismissed"],
    })
      .notNull()
      .default("open"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("reports_status_idx").on(table.status, table.createdAt),
    index("reports_reporter_idx").on(table.reporterId, table.createdAt),
  ]
);

export const blockedUsers = sqliteTable(
  "blocked_users",
  {
    blockerId: integer("blocker_id")
      .notNull()
      .references(() => users.id),
    blockedId: integer("blocked_id")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("blocked_users_pair_idx").on(table.blockerId, table.blockedId),
  ]
);

export const listingFavorites = sqliteTable(
  "listing_favorites",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("listing_favorites_user_listing_idx").on(
      table.userId,
      table.listingId
    ),
    index("listing_favorites_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  ]
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: text("reset_at").notNull(),
  },
  (table) => [index("rate_limits_reset_idx").on(table.resetAt)]
);
