import { getBinding, getD1 } from ".";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL UNIQUE,
    username TEXT,
    display_name TEXT NOT NULL,
    photo_url TEXT,
    bio TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT 'Riga',
    wallet_address TEXT,
    wallet_network TEXT,
    wallet_verified_at TEXT,
    moderation_status TEXT NOT NULL DEFAULT 'active',
    rating_milli INTEGER NOT NULL DEFAULT 5000,
    review_count INTEGER NOT NULL DEFAULT 0,
    deals_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    section TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price_nano TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TON',
    image_url TEXT,
    media_key TEXT,
    location TEXT NOT NULL DEFAULT 'Remote',
    delivery TEXT NOT NULL DEFAULT 'Arrange in chat',
    status TEXT NOT NULL DEFAULT 'active',
    moderation_status TEXT NOT NULL DEFAULT 'approved',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES listings(id),
    applicant_id INTEGER NOT NULL REFERENCES users(id),
    offer_nano TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(listing_id, applicant_id)
  )`,
  `CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES listings(id),
    application_id TEXT REFERENCES applications(id),
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    buyer_wallet_address TEXT NOT NULL,
    seller_wallet_address TEXT NOT NULL,
    platform_wallet_address TEXT NOT NULL,
    arbitrator_wallet_address TEXT,
    asset TEXT NOT NULL DEFAULT 'TON',
    gross_nano TEXT NOT NULL,
    buyer_fee_nano TEXT NOT NULL DEFAULT '0',
    seller_fee_nano TEXT NOT NULL DEFAULT '0',
    buyer_total_nano TEXT NOT NULL DEFAULT '0',
    platform_fee_nano TEXT NOT NULL,
    seller_amount_nano TEXT NOT NULL,
    fee_bps INTEGER NOT NULL DEFAULT 100,
    network TEXT NOT NULL,
    escrow_address TEXT,
    escrow_code_hash TEXT,
    escrow_data_hash TEXT,
    escrow_funding_amount_nano TEXT,
    escrow_funding_tx_hash TEXT,
    escrow_settlement_tx_hash TEXT,
    escrow_status TEXT NOT NULL DEFAULT 'legacy',
    delivery_deadline_unix INTEGER,
    review_window_seconds INTEGER,
    review_deadline_unix INTEGER,
    status TEXT NOT NULL DEFAULT 'pending_wallet',
    transaction_ref TEXT,
    payment_boc_digest TEXT,
    seller_tx_hash TEXT,
    fee_tx_hash TEXT,
    submitted_at TEXT,
    verified_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS deal_chain_actions (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    actor_user_id INTEGER REFERENCES users(id),
    actor_wallet_address TEXT NOT NULL,
    kind TEXT NOT NULL,
    query_id TEXT NOT NULL,
    detail_hash TEXT NOT NULL DEFAULT '0',
    payload_base64 TEXT NOT NULL,
    message_value_nano TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'prepared',
    transaction_ref TEXT,
    submission_boc_digest TEXT,
    tx_hash TEXT,
    submitted_at TEXT,
    confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    account_user_id INTEGER REFERENCES users(id),
    kind TEXT NOT NULL,
    amount_nano TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    transaction_ref TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS deal_events (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    actor_user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    reviewee_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(deal_id, reviewer_id)
  )`,
  `CREATE TABLE IF NOT EXISTS wallet_challenges (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    payload TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    listing_id TEXT REFERENCES listings(id),
    reported_user_id INTEGER REFERENCES users(id),
    deal_id TEXT REFERENCES deals(id),
    reason TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_id INTEGER NOT NULL REFERENCES users(id),
    blocked_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blocker_id, blocked_id)
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS listings_section_status_idx ON listings(section, status)`,
  `CREATE INDEX IF NOT EXISTS listings_owner_idx ON listings(owner_id)`,
  `CREATE INDEX IF NOT EXISTS deals_buyer_idx ON deals(buyer_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS deals_seller_idx ON deals(seller_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS deal_chain_actions_deal_idx ON deal_chain_actions(deal_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS deal_chain_actions_status_idx ON deal_chain_actions(status, submitted_at)`,
  `CREATE INDEX IF NOT EXISTS ledger_deal_idx ON ledger_entries(deal_id)`,
  `CREATE INDEX IF NOT EXISTS deal_events_deal_idx ON deal_events(deal_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON reviews(reviewee_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS wallet_challenges_user_idx ON wallet_challenges(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits(reset_at)`,
];

const seedStatements = [
  {
    sql: `INSERT OR IGNORE INTO users
      (id, telegram_id, username, display_name, photo_url, bio, city, wallet_address, rating_milli, review_count, deals_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      1,
      "demo-anton",
      "anton",
      "Anton",
      null,
      "Building useful things and trading locally.",
      "Riga",
      "kQAREREREREREREREREREREREREREREREREREREREREREV2Z",
      4900,
      18,
      12,
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO users
      (id, telegram_id, username, display_name, photo_url, bio, city, wallet_address, rating_milli, review_count, deals_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      2,
      "demo-mara",
      "maradesigns",
      "Mara",
      "/listings/mara.webp",
      "Independent designer. Fast, clear and friendly.",
      "Riga",
      "kQAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiZI",
      4980,
      42,
      31,
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO users
      (id, telegram_id, username, display_name, photo_url, bio, city, wallet_address, rating_milli, review_count, deals_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      3,
      "demo-janis",
      "janisworks",
      "Jānis",
      null,
      "Careful home services and same-day help.",
      "Riga",
      "kQAzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMw8H",
      4870,
      27,
      24,
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO listings
      (id, owner_id, section, type, title, description, category, price_nano, image_url, location, delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      "market-bike",
      2,
      "market",
      "physical",
      "Espresso electric bike",
      "Low-mileage city e-bike with charger, wide tires and a recent service. Test ride in central Riga.",
      "Mobility",
      "3400000000",
      "/listings/electric-bike.webp",
      "Riga · Centre",
      "Meet in person",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO listings
      (id, owner_id, section, type, title, description, category, price_nano, image_url, location, delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      "market-drone",
      3,
      "market",
      "physical",
      "DJI Mini 2 SE bundle",
      "Fly More bundle in excellent condition. Includes controller, batteries, charger and original box.",
      "Electronics",
      "5900000000",
      "/listings/dji-drone.webp",
      "Riga · Āgenskalns",
      "Meet or parcel locker",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO listings
      (id, owner_id, section, type, title, description, category, price_nano, image_url, location, delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      "market-template",
      2,
      "market",
      "digital",
      "Freelancer proposal kit",
      "A polished editable proposal, scope and invoice pack for independent professionals.",
      "Digital",
      "120000000",
      "/listings/creative-work.webp",
      "Instant download",
      "Telegram delivery",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO listings
      (id, owner_id, section, type, title, description, category, price_nano, image_url, location, delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      "work-cleaning",
      3,
      "work",
      "service",
      "Home reset & sofa cleaning",
      "Two-hour home reset with careful fabric cleaning. Supplies included.",
      "Home",
      "850000000",
      "/listings/home-service.webp",
      "Riga · up to 8 km",
      "Available tomorrow",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO listings
      (id, owner_id, section, type, title, description, category, price_nano, image_url, location, delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      "work-brand",
      2,
      "work",
      "service",
      "One-day brand sprint",
      "A focused remote session: positioning, visual direction and a practical launch kit.",
      "Design",
      "2200000000",
      "/listings/creative-work.webp",
      "Remote",
      "1 business day",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO listings
      (id, owner_id, section, type, title, description, category, price_nano, image_url, location, delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      "work-job",
      1,
      "work",
      "job",
      "Photograph five menu items",
      "Looking for a local photographer for a small restaurant shoot. Editing included.",
      "Creative",
      "1600000000",
      null,
      "Riga · Old Town",
      "This Friday",
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO listings
      (id, owner_id, section, type, title, description, category, price_nano, image_url, location, delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      "work-photo-assist",
      2,
      "work",
      "job",
      "Assist on a product photo set",
      "Help prepare six tabletop scenes, keep the prop list organized, and pack the set after the shoot.",
      "Creative",
      "900000000",
      "/listings/creative-work.webp",
      "Riga · Centre",
      "Saturday · 4 hours",
    ],
  },
];

export async function ensureDatabase() {
  const database = getD1();
  await database.batch(
    schemaStatements.map((statement) => database.prepare(statement))
  );
  const dealColumns = await database
    .prepare("PRAGMA table_info(deals)")
    .all<{ name: string }>();
  const existingDealColumns = new Set(
    dealColumns.results.map((column) => column.name)
  );
  const missingDealColumns = [
    ["buyer_fee_nano", "ALTER TABLE deals ADD buyer_fee_nano TEXT NOT NULL DEFAULT '0'"],
    ["seller_fee_nano", "ALTER TABLE deals ADD seller_fee_nano TEXT NOT NULL DEFAULT '0'"],
    ["buyer_total_nano", "ALTER TABLE deals ADD buyer_total_nano TEXT NOT NULL DEFAULT '0'"],
    ["arbitrator_wallet_address", "ALTER TABLE deals ADD arbitrator_wallet_address TEXT"],
    ["application_id", "ALTER TABLE deals ADD application_id TEXT REFERENCES applications(id)"],
    ["asset", "ALTER TABLE deals ADD asset TEXT NOT NULL DEFAULT 'TON'"],
    ["escrow_address", "ALTER TABLE deals ADD escrow_address TEXT"],
    ["escrow_code_hash", "ALTER TABLE deals ADD escrow_code_hash TEXT"],
    ["escrow_data_hash", "ALTER TABLE deals ADD escrow_data_hash TEXT"],
    ["escrow_funding_amount_nano", "ALTER TABLE deals ADD escrow_funding_amount_nano TEXT"],
    ["escrow_funding_tx_hash", "ALTER TABLE deals ADD escrow_funding_tx_hash TEXT"],
    ["escrow_settlement_tx_hash", "ALTER TABLE deals ADD escrow_settlement_tx_hash TEXT"],
    ["escrow_status", "ALTER TABLE deals ADD escrow_status TEXT NOT NULL DEFAULT 'legacy'"],
    ["delivery_deadline_unix", "ALTER TABLE deals ADD delivery_deadline_unix INTEGER"],
    ["review_window_seconds", "ALTER TABLE deals ADD review_window_seconds INTEGER"],
    ["review_deadline_unix", "ALTER TABLE deals ADD review_deadline_unix INTEGER"],
  ].filter(([name]) => !existingDealColumns.has(name));
  for (const [, statement] of missingDealColumns) {
    await database.prepare(statement).run();
  }
  await database.batch([
    database.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS deals_escrow_address_idx ON deals(escrow_address)"
    ),
    database.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS deals_listing_active_idx ON deals(listing_id) WHERE status IN ('pending_wallet', 'payment_submitted', 'awaiting_delivery', 'disputed')"
    ),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS deal_chain_actions_deal_idx ON deal_chain_actions(deal_id, created_at)"
    ),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS deal_chain_actions_status_idx ON deal_chain_actions(status, submitted_at)"
    ),
  ]);
  if (
    getBinding("SEED_DEMO_DATA") === "true" ||
    getBinding("ENVIRONMENT") !== "production"
  ) {
    await database.batch(
      seedStatements.map(({ sql, values }) =>
        database.prepare(sql).bind(...values)
      )
    );
  }
}
