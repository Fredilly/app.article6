"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

type MapCanvasProps = {
  aoi: AOI | null;
  pins: EvidencePin[];
  stacEvidence?: GeoJSON.FeatureCollection | null;
  selectedStacItemId?: string | null;
  onSelectStacItemId?: (id: string | null) => void;
  onMapReady?: (map: MapLibreMap) => void;
  onMapDestroyed?: () => void;
};

function centerFromBbox(bbox: [number, number, number, number]): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

type LayerClickEvent = {
  features?: Array<{ id?: unknown; properties?: Record<string, unknown> | null }>;
};

const STAC_SOURCE_ID = "stac-evidence";
const STAC_LAYER_FILL = "stac-evidence-fill";
const STAC_LAYER_OUTLINE = "stac-evidence-outline";
const STAC_LAYER_POINTS = "stac-evidence-points";
const STAC_LAYER_OUTLINE_SELECTED = "stac-evidence-outline-selected";
const STAC_LAYER_POINTS_SELECTED = "stac-evidence-points-selected";

function isStyleReady(map: MapLibreMap): boolean {
  try {
    return Boolean(map.isStyleLoaded?.());
  } catch {
    return false;
  }
}

function safeCall(label: string, fn: () => void) {
  try {
    fn();
  } catch (error) {
    console.warn(`[map] ${label} failed`, error);
  }
}

function isFatalMapError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("token") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("failed to fetch") ||
    lower.includes("style") ||
    lower.includes("not done loading")
  );
}

function upsertStacEvidence(map: MapLibreMap) {
  safeCall("upsert STAC source/layers", () => {
    if (!isStyleReady(map)) return;

    if (!map.getSource?.(STAC_SOURCE_ID)) {
      map.addSource(STAC_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    }

    if (!map.getLayer?.(STAC_LAYER_FILL)) {
      map.addLayer({
        id: STAC_LAYER_FILL,
        type: "fill",
        source: STAC_SOURCE_ID,
        filter: ["in", "$type", "Polygon", "MultiPolygon"],
        paint: { "fill-color": "#7c3aed", "fill-opacity": 0.06 },
      });
    }

    if (!map.getLayer?.(STAC_LAYER_OUTLINE)) {
      map.addLayer({
        id: STAC_LAYER_OUTLINE,
        type: "line",
        source: STAC_SOURCE_ID,
        filter: ["in", "$type", "Polygon", "MultiPolygon"],
        paint: { "line-color": "#7c3aed", "line-width": 1 },
      });
    }

    if (!map.getLayer?.(STAC_LAYER_POINTS)) {
      map.addLayer({
        id: STAC_LAYER_POINTS,
        type: "circle",
        source: STAC_SOURCE_ID,
        filter: ["==", "$type", "Point"],
        paint: { "circle-color": "#7c3aed", "circle-radius": 4, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 },
      });
    }

    if (!map.getLayer?.(STAC_LAYER_OUTLINE_SELECTED)) {
      map.addLayer({
        id: STAC_LAYER_OUTLINE_SELECTED,
        type: "line",
        source: STAC_SOURCE_ID,
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#0ea5e9", "line-width": 2 },
      });
    }

    if (!map.getLayer?.(STAC_LAYER_POINTS_SELECTED)) {
      map.addLayer({
        id: STAC_LAYER_POINTS_SELECTED,
        type: "circle",
        source: STAC_SOURCE_ID,
        filter: ["==", ["get", "id"], ""],
        paint: { "circle-color": "#0ea5e9", "circle-radius": 6, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
      });
    }
  });
}

export default function MapCanvas({
  aoi,
  pins,
  stacEvidence,
  selectedStacItemId,
  onSelectStacItemId,
  onMapReady,
  onMapDestroyed,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  const onMapDestroyedRef = useRef(onMapDestroyed);
  const onSelectStacItemIdRef = useRef(onSelectStacItemId);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onMapDestroyedRef.current = onMapDestroyed;
  }, [onMapDestroyed]);

  useEffect(() => {
    onSelectStacItemIdRef.current = onSelectStacItemId;
  }, [onSelectStacItemId]);

  const pointsGeoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const fallback = aoi ? centerFromBbox(aoi.bbox) : null;
    const features: Array<GeoJSON.Feature<GeoJSON.Point>> = [];

    for (const pin of pins) {
      const lng = pin.location?.lng ?? (fallback ? fallback[0] : null);
      const lat = pin.location?.lat ?? (fallback ? fallback[1] : null);
      if (lng == null || lat == null) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: { id: pin.id, title: pin.title, kind: pin.kind },
      });
    }

    return { type: "FeatureCollection", features };
  }, [aoi, pins]);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;
    if (mapRef.current) return;

    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        const style: StyleSpecification = {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
            aoi: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
            pins: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          },
          layers: [
            { id: "osm", type: "raster", source: "osm" },
            { id: "aoi-fill", type: "fill", source: "aoi", paint: { "fill-color": "#60a5fa", "fill-opacity": 0.18 } },
            { id: "aoi-line", type: "line", source: "aoi", paint: { "line-color": "#2563eb", "line-width": 2 } },
            { id: "pins", type: "circle", source: "pins", paint: { "circle-color": "#f97316", "circle-radius": 6, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } },
          ],
        };

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [0, 0],
          zoom: 1,
          attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

        map.on?.("error", (event: unknown) => {
          const message =
            event && typeof event === "object" && "error" in event && (event as { error?: unknown }).error instanceof Error
              ? (event as { error: Error }).error.message
              : "Map failed to load.";
          console.warn("[map] error event", event);
          if (isFatalMapError(message)) setMapError((prev) => prev ?? message);
        });

        map.on?.("load", () => {
          upsertStacEvidence(map);
          safeCall("resize after load", () => map.resize?.());
          setMapReadyTick((value) => value + 1);
        });

        map.on?.("style.load", () => {
          upsertStacEvidence(map);
          setMapReadyTick((value) => value + 1);
        });

        mapRef.current = map;
        setMapReadyTick((value) => value + 1);
        onMapReadyRef.current?.(map);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMapError(message);
        console.warn("[map] init failed", error);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReadyTick((value) => value + 1);
      onMapDestroyedRef.current?.();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      safeCall("set AOI data", () => {
        const source = map.getSource?.("aoi") as unknown as GeoJSONSource | undefined;
        if (!source?.setData) return;

        const data: GeoJSON.FeatureCollection<GeoJSON.Geometry> = {
          type: "FeatureCollection",
          features: aoi ? ([aoi.geojson] as unknown as Array<GeoJSON.Feature<GeoJSON.Geometry>>) : [],
        };
        source.setData(data);

        if (aoi?.bbox) {
          try {
            map.fitBounds(
              [
                [aoi.bbox[0], aoi.bbox[1]],
                [aoi.bbox[2], aoi.bbox[3]],
              ],
              { padding: 30, duration: 0 },
            );
          } catch {
            // ignore
          }
        }
      });
    };

    if (!map.isStyleLoaded?.()) {
      map.once?.("load", apply);
      return;
    }

    apply();
  }, [aoi, mapReadyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      safeCall("set pins data", () => {
        const source = map.getSource?.("pins") as unknown as GeoJSONSource | undefined;
        if (!source?.setData) return;
        source.setData(pointsGeoJson);
      });
    };

    if (!map.isStyleLoaded?.()) {
      map.once?.("load", apply);
      return;
    }

    apply();
  }, [mapReadyTick, pointsGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      upsertStacEvidence(map);
      safeCall("set STAC evidence data", () => {
        const source = map.getSource?.(STAC_SOURCE_ID) as unknown as GeoJSONSource | undefined;
        if (!source?.setData) return;
        const data: GeoJSON.FeatureCollection =
          stacEvidence?.features?.length ? stacEvidence : { type: "FeatureCollection", features: [] };
        source.setData(data);
      });
    };

    if (!map.isStyleLoaded?.()) {
      map.once?.("load", apply);
      return;
    }

    apply();
  }, [mapReadyTick, stacEvidence]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const id = selectedStacItemId ?? "";
      upsertStacEvidence(map);
      safeCall("set STAC selected filters", () => {
        map.setFilter?.(STAC_LAYER_OUTLINE_SELECTED, ["==", ["get", "id"], id]);
        map.setFilter?.(STAC_LAYER_POINTS_SELECTED, ["==", ["get", "id"], id]);
      });
    };

    if (!map.isStyleLoaded?.()) {
      map.once?.("load", apply);
      return;
    }

    apply();
  }, [mapReadyTick, selectedStacItemId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleSelect = (event: LayerClickEvent) => {
      const feature = event.features?.[0];
      const props = feature?.properties ?? null;
      const propId = props && typeof props.id === "string" ? props.id : null;
      const featureId = feature && typeof feature.id === "string" ? feature.id : null;
      const id = propId ?? featureId;
      if (!id) return;
      onSelectStacItemIdRef.current?.(id);
    };

    const setPointer = () => {
      if (!map.getCanvas?.()) return;
      map.getCanvas().style.cursor = "pointer";
    };
    const unsetPointer = () => {
      if (!map.getCanvas?.()) return;
      map.getCanvas().style.cursor = "";
    };

    const apply = () => {
      upsertStacEvidence(map);
      safeCall("attach STAC click handlers", () => {
        map.on?.("click", STAC_LAYER_OUTLINE, handleSelect);
        map.on?.("click", STAC_LAYER_POINTS, handleSelect);
        map.on?.("mouseenter", STAC_LAYER_OUTLINE, setPointer);
        map.on?.("mouseenter", STAC_LAYER_POINTS, setPointer);
        map.on?.("mouseleave", STAC_LAYER_OUTLINE, unsetPointer);
        map.on?.("mouseleave", STAC_LAYER_POINTS, unsetPointer);
      });
    };

    if (!map.isStyleLoaded?.()) {
      map.once?.("load", apply);
    } else {
      apply();
    }

    return () => {
      map.off?.("click", STAC_LAYER_OUTLINE, handleSelect);
      map.off?.("click", STAC_LAYER_POINTS, handleSelect);
      map.off?.("mouseenter", STAC_LAYER_OUTLINE, setPointer);
      map.off?.("mouseenter", STAC_LAYER_POINTS, setPointer);
      map.off?.("mouseleave", STAC_LAYER_OUTLINE, unsetPointer);
      map.off?.("mouseleave", STAC_LAYER_POINTS, unsetPointer);
      map.off?.("load", apply);
    };
  }, [mapReadyTick]);

  return (
    <div className="relative h-[26rem] w-full rounded-xl border border-slate-200 bg-slate-100">
      {mapError ? (
        <div className="absolute left-3 top-3 z-10 max-w-[24rem] rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 shadow">
          Map unavailable in this environment (missing token/style).{" "}
          <span className="block pt-1 font-mono text-[11px] text-rose-700">{mapError}</span>
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
