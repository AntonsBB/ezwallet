import assert from "node:assert/strict";
import test from "node:test";
import { nextListingStatus } from "../lib/listing-lifecycle";

test("allows only explicit reversible listing lifecycle transitions", () => {
  assert.equal(nextListingStatus("active", "pause"), "paused");
  assert.equal(nextListingStatus("paused", "activate"), "active");
  assert.equal(nextListingStatus("active", "close"), "closed");
  assert.equal(nextListingStatus("paused", "close"), "closed");
});

test("keeps terminal and invalid listing lifecycle transitions closed", () => {
  assert.equal(nextListingStatus("draft", "activate"), null);
  assert.equal(nextListingStatus("active", "activate"), null);
  assert.equal(nextListingStatus("paused", "pause"), null);
  assert.equal(nextListingStatus("sold", "activate"), null);
  assert.equal(nextListingStatus("closed", "activate"), null);
  assert.equal(nextListingStatus("removed", "close"), null);
});
