export const PUBLIC_COORDINATE_STEP_E6 = 1_000;
export const DEFAULT_LOCATION_RADIUS_METERS = 1_000;
export const MIN_LOCATION_RADIUS_METERS = 250;
export const MAX_LOCATION_RADIUS_METERS = 100_000;

type CoordinateInput = {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
};

export function normalizePublicCoordinates(input: CoordinateInput) {
  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;
  if (!hasLatitude && !hasLongitude) return null;
  if (!hasLatitude || !hasLongitude) {
    throw new Error("Latitude and longitude must be provided together.");
  }

  const latitude = input.latitude!;
  const longitude = input.longitude!;
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Location coordinates are outside the valid range.");
  }

  const radiusMeters =
    input.radiusMeters ?? DEFAULT_LOCATION_RADIUS_METERS;
  if (
    !Number.isInteger(radiusMeters) ||
    radiusMeters < MIN_LOCATION_RADIUS_METERS ||
    radiusMeters > MAX_LOCATION_RADIUS_METERS
  ) {
    throw new Error("Location radius is outside the allowed range.");
  }

  const latitudeE6 =
    Math.round((latitude * 1_000_000) / PUBLIC_COORDINATE_STEP_E6) *
    PUBLIC_COORDINATE_STEP_E6;
  const longitudeE6 =
    Math.round((longitude * 1_000_000) / PUBLIC_COORDINATE_STEP_E6) *
    PUBLIC_COORDINATE_STEP_E6;
  return { latitudeE6, longitudeE6, radiusMeters };
}

export function distanceMeters(
  from: { latitudeE6: number; longitudeE6: number },
  to: { latitudeE6: number; longitudeE6: number }
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const fromLatitude = radians(from.latitudeE6 / 1_000_000);
  const toLatitude = radians(to.latitudeE6 / 1_000_000);
  const latitudeDelta = toLatitude - fromLatitude;
  const longitudeDelta = radians(
    (to.longitudeE6 - from.longitudeE6) / 1_000_000
  );
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(
    2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(haversine)))
  );
}
