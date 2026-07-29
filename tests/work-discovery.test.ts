import assert from "node:assert/strict";
import test from "node:test";
import {
  approximateDistance,
  formatApproximateDistance,
  sortListingsByDistance,
} from "../lib/work-discovery.ts";

const origin = { latitudeE6: 56_950_000, longitudeE6: 24_105_000 };

test("sorts mapped work by distance and leaves unmapped work last", () => {
  const listings = [
    { id: "remote", latitudeE6: null, longitudeE6: null },
    { id: "far", latitudeE6: 56_970_000, longitudeE6: 24_120_000 },
    { id: "near", latitudeE6: 56_951_000, longitudeE6: 24_105_000 },
  ];

  assert.deepEqual(
    sortListingsByDistance(listings, origin).map(({ id }) => id),
    ["near", "far", "remote"]
  );
  assert.deepEqual(
    sortListingsByDistance(listings, null).map(({ id }) => id),
    ["remote", "far", "near"]
  );
});

test("calculates and labels approximate public-area distances", () => {
  const nearby = {
    id: "nearby",
    latitudeE6: 56_951_000,
    longitudeE6: 24_105_000,
  };
  const distance = approximateDistance(nearby, origin);
  assert.ok(distance !== null && distance >= 110 && distance <= 112);
  assert.equal(formatApproximateDistance(distance), "about 100 m away");
  assert.equal(
    formatApproximateDistance(12_300),
    "about 12 km away"
  );
  assert.equal(formatApproximateDistance(null), null);
});
