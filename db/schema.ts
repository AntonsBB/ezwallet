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
    buyerId: integer("buyer_id")
      .notNull()
      .references(() => users.id),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => users.id),
    buyerWalletAddress: text("buyer_wallet_address").notNull(),
    sellerWalletAddress: text("seller_wallet_address").notNull(),
    platformWalletAddress: text("platform_wallet_address").notNull(),
    grossNano: text("gross_nano").notNull(),
    platformFeeNano: text("platform_fee_nano").notNull(),
    sellerAmountNano: text("seller_amount_nano").notNull(),
    feeBps: integer("fee_bps").notNull().default(100),
    network: text("network", { enum: ["mainnet", "testnet"] }).notNull(),
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

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: text("reset_at").notNull(),
  },
  (table) => [index("rate_limits_reset_idx").on(table.resetAt)]
);
