import assert from "node:assert/strict";
import test from "node:test";
import {
  distanceMeters,
  normalizePublicCoordinates,
  PUBLIC_COORDINATE_STEP_E6,
} from "../lib/geo.ts";

test("stores only privacy-rounded public coordinates", () => {
  const location = normalizePublicCoordinates({
    latitude: 56.9496487,
    longitude: 24.1051864,
  });
  assert.deepEqual(location, {
    latitudeE6: 56_950_000,
    longitudeE6: 24_105_000,
    radiusMeters: 1_000,
  });
  assert.equal(location!.latitudeE6 % PUBLIC_COORDINATE_STEP_E6, 0);
  assert.equal(location!.longitudeE6 % PUBLIC_COORDINATE_STEP_E6, 0);
});

test("requires a coordinate pair and a privacy-safe radius", () => {
  assert.equal(normalizePublicCoordinates({}), null);
  assert.throws(
    () => normalizePublicCoordinates({ latitude: 56.95 }),
    /provided together/
  );
  assert.throws(
    () =>
      normalizePublicCoordinates({
        latitude: 91,
        longitude: 24.1,
      }),
    /valid range/
  );
  assert.throws(
    () =>
      normalizePublicCoordinates({
        latitude: 56.95,
        longitude: 24.1,
        radiusMeters: 100,
      }),
    /allowed range/
  );
});

test("calculates stable local distances from integer coordinates", () => {
  const centre = { latitudeE6: 56_950_000, longitudeE6: 24_105_000 };
  const oldTown = { latitudeE6: 56_947_000, longitudeE6: 24_106_000 };
  const distance = distanceMeters(centre, oldTown);
  assert.ok(distance >= 330 && distance <= 350);
  assert.equal(distanceMeters(centre, centre), 0);
});
