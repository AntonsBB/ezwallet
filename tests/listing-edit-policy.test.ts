import assert from "node:assert/strict";
import test from "node:test";
import { listingEditConflict } from "../lib/listing-edit-policy";

const listing = {
  section: "work",
  type: "job",
  status: "active",
  updatedAt: "2026-07-29T18:00:00.000Z",
  hasActiveDeal: false,
  hasOpenApplication: false,
};

const request = {
  section: "work",
  type: "job",
  expectedUpdatedAt: listing.updatedAt,
};

test("allows a current owner edit with no dependent transaction", () => {
  assert.equal(listingEditConflict(listing, request), null);
});

test("rejects stale edits and immutable type changes", () => {
  assert.match(
    listingEditConflict(listing, {
      ...request,
      expectedUpdatedAt: "stale-version",
    }) ?? "",
    /changed/
  );
  assert.match(
    listingEditConflict(listing, { ...request, type: "service" }) ?? "",
    /cannot be changed/
  );
});

test("rejects edits during active deals or open applications", () => {
  assert.match(
    listingEditConflict(
      { ...listing, hasActiveDeal: true },
      request
    ) ?? "",
    /active deal/
  );
  assert.match(
    listingEditConflict(
      { ...listing, hasOpenApplication: true },
      request
    ) ?? "",
    /open application/
  );
});

test("rejects terminal listing states", () => {
  assert.match(
    listingEditConflict({ ...listing, status: "closed" }, request) ?? "",
    /live or paused/
  );
});
