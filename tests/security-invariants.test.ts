import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function securityDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      moderation_status TEXT NOT NULL
    );
    CREATE TABLE listings (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      moderation_status TEXT NOT NULL
    );
    CREATE TABLE applications (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      applicant_id INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE deals (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      application_id TEXT,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL
    );
    CREATE TABLE identity_link_tickets (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      source_identity_id TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  db.exec(
    readFileSync(
      new URL("../drizzle/0011_security_invariants.sql", import.meta.url),
      "utf8"
    )
  );
  return db;
}

test("deal trigger keeps marketplace creation coupled to current seller consent", () => {
  const db = securityDatabase();
  try {
    db.exec(`
      INSERT INTO users (id, moderation_status)
      VALUES (1, 'active'), (2, 'active');
      INSERT INTO listings (id, owner_id, type, status, moderation_status)
      VALUES
        ('active-market', 2, 'physical', 'active', 'approved'),
        ('paused-market', 2, 'physical', 'paused', 'approved');
      INSERT INTO deals (id, listing_id, application_id, buyer_id, seller_id)
      VALUES ('accepted', 'active-market', NULL, 1, 2);
    `);
    assert.throws(
      () =>
        db.exec(`
          INSERT INTO deals
            (id, listing_id, application_id, buyer_id, seller_id)
          VALUES ('rejected', 'paused-market', NULL, 1, 2);
        `),
      /deal_listing_not_eligible/
    );
  } finally {
    db.close();
  }
});

test("deal trigger validates current job application and participant roles", () => {
  const db = securityDatabase();
  try {
    db.exec(`
      INSERT INTO users (id, moderation_status)
      VALUES (3, 'active'), (4, 'active');
      INSERT INTO listings (id, owner_id, type, status, moderation_status)
      VALUES ('job', 3, 'job', 'active', 'approved');
      INSERT INTO applications (id, listing_id, applicant_id, status)
      VALUES
        ('sent', 'job', 4, 'sent'),
        ('withdrawn', 'job', 4, 'withdrawn');
      INSERT INTO deals (id, listing_id, application_id, buyer_id, seller_id)
      VALUES ('accepted-job', 'job', 'sent', 3, 4);
    `);
    assert.throws(
      () =>
        db.exec(`
          INSERT INTO deals
            (id, listing_id, application_id, buyer_id, seller_id)
          VALUES ('rejected-job', 'job', 'withdrawn', 3, 4);
        `),
      /deal_listing_not_eligible/
    );
  } finally {
    db.close();
  }
});

test("claim tickets bind once and one challenge cannot own two tickets", () => {
  const db = securityDatabase();
  try {
    db.exec(`
      INSERT INTO identity_link_tickets (
        id, user_id, source_identity_id, secret_hash, expires_at, created_at
      ) VALUES
        ('ticket-1', 1, 'telegram-1', 'hash-1', '2099-01-01', '2026-01-01'),
        ('ticket-2', 2, 'telegram-2', 'hash-2', '2099-01-01', '2026-01-01');
    `);
    const exchange = db.prepare(`
      UPDATE identity_link_tickets
      SET exchanged_challenge_id = ?
      WHERE id = ? AND exchanged_challenge_id IS NULL
    `);
    assert.equal(exchange.run("challenge-1", "ticket-1").changes, 1);
    assert.equal(exchange.run("challenge-2", "ticket-1").changes, 0);
    assert.throws(
      () => exchange.run("challenge-1", "ticket-2"),
      /UNIQUE constraint failed/
    );
  } finally {
    db.close();
  }
});
