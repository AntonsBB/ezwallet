"use client";

import type {
  LayerGroup,
  Map as LeafletMap,
  TileLayer,
} from "leaflet";
import { Check, Crosshair, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalizePublicCoordinates } from "@/lib/geo";

export type PublicMapPoint = {
  latitudeE6: number;
  longitudeE6: number;
};

export type WorkMapListing = {
  id: string;
  type: "physical" | "digital" | "service" | "job";
  title: string;
  location: string;
  latitudeE6: number | null;
  longitudeE6: number | null;
  locationRadiusMeters: number | null;
};

type MapStatus = "loading" | "ready" | "degraded";

const defaultCentre: [number, number] = [56.9496, 24.1052];
const tileUrl =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function areaLabel(radiusMeters: number | null) {
  const radius = radiusMeters ?? 1_000;
  if (radius < 1_000) return `${radius} m area`;
  return `${Number((radius / 1_000).toFixed(1))} km area`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function WorkMap({
  listings,
  referencePoint,
  onReferencePointChange,
  onOpen,
}: {
  listings: WorkMapListing[];
  referencePoint: PublicMapPoint | null;
  onReferencePointChange: (point: PublicMapPoint | null) => void;
  onOpen: (listingId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const resultsLayerRef = useRef<LayerGroup | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [mapReady, setMapReady] = useState(false);
  const [locationPending, setLocationPending] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !hostRef.current || mapRef.current) return;

      leafletRef.current = leaflet;
      const map = leaflet.map(hostRef.current, {
        attributionControl: true,
        boxZoom: false,
        doubleClickZoom: true,
        keyboard: true,
        scrollWheelZoom: false,
        tapHold: false,
        zoomControl: false,
      });
      map.setView(defaultCentre, 12);
      leaflet.control.zoom({ position: "topright" }).addTo(map);

      const tiles = leaflet
        .tileLayer(tileUrl, {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        })
        .on("load", () => setMapStatus("ready"))
        .on("tileerror", () => setMapStatus("degraded"))
        .addTo(map);

      mapRef.current = map;
      tileLayerRef.current = tiles;
      resultsLayerRef.current = leaflet.layerGroup().addTo(map);
      setMapReady(true);

      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      tileLayerRef.current?.off();
      mapRef.current?.remove();
      tileLayerRef.current = null;
      resultsLayerRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layer = resultsLayerRef.current;
    if (!leaflet || !map || !layer || !mapReady) return;

    layer.clearLayers();
    const bounds: Array<[number, number]> = [];

    for (const listing of listings) {
      if (listing.latitudeE6 === null || listing.longitudeE6 === null) continue;
      const point: [number, number] = [
        listing.latitudeE6 / 1_000_000,
        listing.longitudeE6 / 1_000_000,
      ];
      const isJob = listing.type === "job";
      const circle = leaflet
        .circle(point, {
          bubblingMouseEvents: false,
          color: isJob ? "#1b3c89" : "#1d4f34",
          fillColor: isJob ? "#5d8cff" : "#58c685",
          fillOpacity: 0.32,
          opacity: 0.92,
          radius: listing.locationRadiusMeters ?? 1_000,
          weight: 2,
        })
        .bindTooltip(
          `<strong>${escapeHtml(listing.title)}</strong><br>${escapeHtml(listing.location)} · ${areaLabel(listing.locationRadiusMeters)}`,
          { direction: "top" }
        )
        .on("click", () => onOpen(listing.id));

      circle.addTo(layer);
      bounds.push(point);
    }

    if (referencePoint) {
      const point: [number, number] = [
        referencePoint.latitudeE6 / 1_000_000,
        referencePoint.longitudeE6 / 1_000_000,
      ];
      leaflet
        .circleMarker(point, {
          color: "#111111",
          fillColor: "#ffffff",
          fillOpacity: 1,
          radius: 7,
          weight: 3,
        })
        .bindTooltip("Your approximate area", { direction: "top" })
        .addTo(layer);
      bounds.push(point);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 14, { animate: false });
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, {
        animate: false,
        maxZoom: 14,
        padding: [34, 34],
      });
    } else {
      map.setView(defaultCentre, 12, { animate: false });
    }

    window.setTimeout(() => map.invalidateSize(), 0);
  }, [listings, mapReady, onOpen, referencePoint]);

  const useApproximateArea = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Location is not available in this browser.");
      return;
    }

    setLocationPending(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const rounded = normalizePublicCoordinates({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (rounded) {
          onReferencePointChange({
            latitudeE6: rounded.latitudeE6,
            longitudeE6: rounded.longitudeE6,
          });
          setLocationMessage(
            "Using a rounded area. Your exact position was discarded."
          );
        }
        setLocationPending(false);
      },
      (error) => {
        setLocationPending(false);
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was not granted. You can still browse the map."
            : "Your area could not be found. Try again or browse manually."
        );
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 8_000,
      }
    );
  };

  return (
    <section className="work-map-panel" aria-labelledby="nearby-map-title">
      <div className="work-map-heading">
        <div>
          <span className="eyebrow">
            <MapPin size={13} /> Approximate areas
          </span>
          <h2 id="nearby-map-title">What is nearby?</h2>
        </div>
        <span className="mapped-count">
          {listings.length} {listings.length === 1 ? "area" : "areas"}
        </span>
      </div>

      <div className="work-map-frame">
        <div
          ref={hostRef}
          className="work-map-canvas"
          role="region"
          aria-label="Interactive map of approximate work and service areas"
        />
        {mapStatus === "loading" && (
          <div className="work-map-status" role="status">
            <LocateFixed size={18} />
            Loading map…
          </div>
        )}
        {mapStatus === "degraded" && (
          <div className="work-map-status is-warning" role="status">
            <MapPin size={18} />
            Map tiles are unavailable. The nearby list still works.
          </div>
        )}
        {!listings.length && mapStatus !== "loading" && (
          <div className="work-map-empty">
            <MapPin size={20} />
            <strong>No approximate areas in this view</strong>
            <span>Remote posts and posts without an area remain in List.</span>
          </div>
        )}
      </div>

      <div className="work-location-control">
        <button
          type="button"
          onClick={
            referencePoint
              ? () => {
                  onReferencePointChange(null);
                  setLocationMessage("Nearby sorting cleared.");
                }
              : useApproximateArea
          }
          disabled={locationPending}
        >
          {referencePoint ? <Check size={15} /> : <Crosshair size={15} />}
          {locationPending
            ? "Finding your area…"
            : referencePoint
              ? "Area enabled"
              : "Use my area"}
        </button>
        <span>
          <ShieldCheck size={13} />
          Exact coordinates are never retained
        </span>
      </div>
      {locationMessage && (
        <p className="work-location-message" role="status">
          {locationMessage}
        </p>
      )}
    </section>
  );
}
