"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import getFeatureBbox from "@/lib/map/getFeatureBbox";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

type MapCanvasProps = {
  aoi: AOI | null;
  pins: EvidencePin[];
  stacEvidence?: GeoJSON.FeatureCollection | null;
  stacEvidenceCentroids?: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
  stacEvidenceCentroidsEnabled?: boolean;
  stacEvidenceRunId?: string | null;
  viewStorageKey?: string | null;
  initialViewportBbox?: [number, number, number, number] | null;
  selectedStacItemId?: string | null;
  onSelectStacItemId?: (id: string | null) => void;
  onSelectEvidence?: (selection: { id: string; source: "pin" | "polygon" }) => void;
  onViewportBboxChange?: (bbox: [number, number, number, number]) => void;
  onMapReady?: (map: MapLibreMap) => void;
  onMapDestroyed?: () => void;
};

function centerFromBbox(bbox: [number, number, number, number]): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

type LayerClickEvent = {
  features?: Array<{ id?: unknown; properties?: Record<string, unknown> | null }>;
};

type MapFailureCode = "env_unsupported" | "container_not_ready" | "init_failed" | "style_failed" | "webgl_failed";

type MapFailure = {
  code: MapFailureCode;
  message: string;
};

type MapState = "waiting_container" | "initializing" | "ready" | "failed";

const STAC_SOURCE_ID = "stac-evidence";
const STAC_LAYER_FILL = "stac-evidence-fill";
const STAC_LAYER_OUTLINE = "stac-evidence-outline";
const STAC_LAYER_POINTS = "stac-evidence-points";
const STAC_LAYER_OUTLINE_SELECTED = "stac-evidence-outline-selected";
const STAC_LAYER_POINTS_SELECTED = "stac-evidence-points-selected";

const STAC_CENTROID_SOURCE_ID = "stac-evidence-centroids";
const STAC_CENTROID_LAYER = "stac-evidence-centroids-points";
const STAC_CENTROID_LAYER_SELECTED = "stac-evidence-centroids-selected";

function isStyleReady(map: MapLibreMap): boolean {
  try {
    const styleLoaded = typeof map.isStyleLoaded === "function" ? map.isStyleLoaded() : true;
    return Boolean(styleLoaded);
  } catch {
    return false;
  }
}

function safeCall(label: string, context: Record<string, unknown>, fn: () => void) {
  try {
    fn();
  } catch (error) {
    console.warn(`[map] ${label} failed`, { ...context, error });
  }
}

function hasVisibleSize(node: HTMLDivElement | null): boolean {
  if (!node) return false;
  return node.clientWidth > 0 && node.clientHeight > 0;
}

function filterRenderableEvidence(fc: GeoJSON.FeatureCollection | null | undefined): GeoJSON.FeatureCollection {
  const features = Array.isArray(fc?.features) ? fc.features : [];
  return {
    type: "FeatureCollection",
    features: features.filter((feature) => Boolean(getFeatureBbox(feature))),
  };
}

function classifyMapError(message: string): MapFailureCode | null {
  const lower = message.toLowerCase();
  if (lower.includes("webgl") || lower.includes("context lost") || lower.includes("failed to initialize webgl")) {
    return "webgl_failed";
  }
  if (
    lower.includes("token") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("failed to fetch")
  ) {
    return "init_failed";
  }
  return null;
}

function browserSupportsWebgl(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function failureCopy(failure: MapFailure): { title: string; detail: string } {
  switch (failure.code) {
    case "env_unsupported":
      return { title: "Map unsupported", detail: failure.message };
    case "webgl_failed":
      return { title: "WebGL unavailable", detail: failure.message };
    case "style_failed":
      return { title: "Map could not initialize.", detail: failure.message };
    case "init_failed":
      return { title: "Map could not initialize.", detail: failure.message };
    case "container_not_ready":
      return { title: "Map container is not ready yet.", detail: failure.message };
  }
}

function upsertStacEvidence(map: MapLibreMap, context: Record<string, unknown>) {
  safeCall("upsert STAC source/layers", context, () => {
    if (!isStyleReady(map)) return;

    if (!map.getSource?.(STAC_SOURCE_ID)) {
      map.addSource(STAC_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    }

    if (!map.getSource?.(STAC_CENTROID_SOURCE_ID)) {
      map.addSource(STAC_CENTROID_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
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

    if (!map.getLayer?.(STAC_CENTROID_LAYER)) {
      map.addLayer({
        id: STAC_CENTROID_LAYER,
        type: "circle",
        source: STAC_CENTROID_SOURCE_ID,
        paint: {
          "circle-color": "#f97316",
          "circle-radius": 6,
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 2,
        },
      });
    }

    if (!map.getLayer?.(STAC_CENTROID_LAYER_SELECTED)) {
      map.addLayer({
        id: STAC_CENTROID_LAYER_SELECTED,
        type: "circle",
        source: STAC_CENTROID_SOURCE_ID,
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-color": "#0ea5e9",
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  });
}

export default function MapCanvas({
  aoi,
  pins,
  stacEvidence,
  stacEvidenceCentroids,
  stacEvidenceCentroidsEnabled,
  stacEvidenceRunId,
  viewStorageKey,
  initialViewportBbox,
  selectedStacItemId,
  onSelectStacItemId,
  onSelectEvidence,
  onViewportBboxChange,
  onMapReady,
  onMapDestroyed,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [mapState, setMapState] = useState<MapState>("waiting_container");
  const [mapFailure, setMapFailure] = useState<MapFailure | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  const onMapDestroyedRef = useRef(onMapDestroyed);
  const onSelectStacItemIdRef = useRef(onSelectStacItemId);
  const onSelectEvidenceRef = useRef(onSelectEvidence);
  const onViewportBboxChangeRef = useRef(onViewportBboxChange);
  const stacEvidenceRunIdRef = useRef<string | null | undefined>(stacEvidenceRunId);
  const viewStorageKeyRef = useRef<MapCanvasProps["viewStorageKey"]>(viewStorageKey);
  const initialViewportBboxRef = useRef<MapCanvasProps["initialViewportBbox"]>(initialViewportBbox);
  const hasAppliedInitialViewportRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const pendingViewRef = useRef<{ center: { lng: number; lat: number }; zoom: number; bbox: [number, number, number, number] } | null>(null);
  const applyInitialViewportRef = useRef<(map: MapLibreMap) => void>(() => {});
  const loadFiredRef = useRef(false);
  const styleLoadFiredRef = useRef(false);
  const errorEventFiredRef = useRef(false);

  const reportFailure = (failure: MapFailure) => {
    setMapState("failed");
    setMapFailure((prev) => prev ?? failure);
  };

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onMapDestroyedRef.current = onMapDestroyed;
  }, [onMapDestroyed]);

  useEffect(() => {
    onSelectStacItemIdRef.current = onSelectStacItemId;
  }, [onSelectStacItemId]);

  useEffect(() => {
    onSelectEvidenceRef.current = onSelectEvidence;
  }, [onSelectEvidence]);

  useEffect(() => {
    onViewportBboxChangeRef.current = onViewportBboxChange;
  }, [onViewportBboxChange]);

  useEffect(() => {
    stacEvidenceRunIdRef.current = stacEvidenceRunId;
  }, [stacEvidenceRunId]);

  useEffect(() => {
    viewStorageKeyRef.current = viewStorageKey;
  }, [viewStorageKey]);

  useEffect(() => {
    initialViewportBboxRef.current = initialViewportBbox;
  }, [initialViewportBbox]);

  const storageId = useMemo(() => {
    const key = (viewStorageKey ?? "").trim();
    return key ? `a6:mapview:${key}` : null;
  }, [viewStorageKey]);

  useEffect(() => {
    applyInitialViewportRef.current = (map: MapLibreMap) => {
      if (hasAppliedInitialViewportRef.current) return;

      const fromUrl = initialViewportBboxRef.current;
      if (fromUrl) {
        hasAppliedInitialViewportRef.current = true;
        safeCall("apply initial viewport (url bbox)", { bbox: fromUrl }, () => {
          map.fitBounds(
            [
              [fromUrl[0], fromUrl[1]],
              [fromUrl[2], fromUrl[3]],
            ],
            { padding: 30, duration: 0 },
          );
        });
        return;
      }

      if (!storageId) return;

      const raw = (() => {
        try {
          return window.localStorage.getItem(storageId);
        } catch {
          return null;
        }
      })();
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return;
        const record = parsed as Record<string, unknown>;
        const center =
          record.center && typeof record.center === "object" ? (record.center as Record<string, unknown>) : null;
        const zoom = typeof record.zoom === "number" ? record.zoom : null;
        const bbox = Array.isArray(record.bbox) ? (record.bbox as unknown[]) : null;
        const lng = center && typeof center.lng === "number" ? center.lng : null;
        const lat = center && typeof center.lat === "number" ? center.lat : null;
        const bboxNums =
          bbox && bbox.length >= 4 && bbox.slice(0, 4).every((n) => typeof n === "number" && Number.isFinite(n))
            ? (bbox.slice(0, 4) as [number, number, number, number])
            : null;

        hasAppliedInitialViewportRef.current = true;

        if (lng != null && lat != null && zoom != null && Number.isFinite(zoom)) {
          safeCall("apply initial viewport (storage center/zoom)", { lng, lat, zoom }, () => {
            map.jumpTo({ center: [lng, lat], zoom });
          });
          return;
        }

        if (bboxNums) {
          safeCall("apply initial viewport (storage bbox)", { bbox: bboxNums }, () => {
            map.fitBounds(
              [
                [bboxNums[0], bboxNums[1]],
                [bboxNums[2], bboxNums[3]],
              ],
              { padding: 30, duration: 0 },
            );
          });
        }
      } catch {
        // ignore
      }
    };
  }, [storageId]);

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
    let initObserver: ResizeObserver | null = null;
    if (!containerRef.current) return;
    if (mapRef.current) return;
    if (typeof window === "undefined" || typeof document === "undefined") {
      reportFailure({ code: "env_unsupported", message: "Browser DOM APIs are unavailable for map rendering." });
      return;
    }
    if (!browserSupportsWebgl()) {
      reportFailure({ code: "webgl_failed", message: "This browser does not provide the WebGL support required for the map." });
      return;
    }

    const initMap = async () => {
      try {
        if (!containerRef.current || !hasVisibleSize(containerRef.current)) {
          setMapState("waiting_container");
          setMapFailure(null);
          return false;
        }
        setMapState("initializing");
        setMapFailure(null);
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
          errorEventFiredRef.current = true;
          const message =
            event && typeof event === "object" && "error" in event && (event as { error?: unknown }).error instanceof Error
              ? (event as { error: Error }).error.message
              : "Map failed to load.";
          const code = classifyMapError(message);
          if (code) {
            reportFailure({ code, message });
          }
        });

        map.on?.("load", () => {
          loadFiredRef.current = true;
          upsertStacEvidence(map, { runId: stacEvidenceRunIdRef.current ?? null });
          safeCall("resize after load", {}, () => map.resize?.());
          applyInitialViewportRef.current(map);
          setMapState("ready");
          setMapFailure(null);
          setMapReadyTick((value) => value + 1);
        });

        map.on?.("style.load", () => {
          styleLoadFiredRef.current = true;
          upsertStacEvidence(map, { runId: stacEvidenceRunIdRef.current ?? null });
          setMapState("ready");
          setMapFailure(null);
          setMapReadyTick((value) => value + 1);
        });

        mapRef.current = map;
        setMapReadyTick((value) => value + 1);
        onMapReadyRef.current?.(map);
        applyInitialViewportRef.current(map);

        window.setTimeout(() => {
          if (cancelled) return;
          if (!mapRef.current) return;
          if (!styleLoadFiredRef.current && !loadFiredRef.current) {
            reportFailure({ code: "style_failed", message: "Map style did not finish loading." });
          }
        }, 8000);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reportFailure({ code: "init_failed", message });
        return true;
      }
    };

    void (async () => {
      const initialized = await initMap();
      if (initialized || cancelled || !containerRef.current) return;

      initObserver = new ResizeObserver(() => {
        if (cancelled || mapRef.current) return;
        if (!hasVisibleSize(containerRef.current)) {
          setMapState("waiting_container");
          return;
        }
        void initMap().then((done) => {
          if (done) initObserver?.disconnect();
        });
      });
      initObserver.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      initObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      loadFiredRef.current = false;
      styleLoadFiredRef.current = false;
      errorEventFiredRef.current = false;
      setMapReadyTick((value) => value + 1);
      onMapDestroyedRef.current?.();

      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      safeCall("set AOI data", {}, () => {
        const source = map.getSource?.("aoi") as unknown as GeoJSONSource | undefined;
        if (!source?.setData) return;

        const data: GeoJSON.FeatureCollection<GeoJSON.Geometry> =
          aoi?.feature_collection
            ? aoi.feature_collection
            : {
                type: "FeatureCollection",
                features: aoi?.geojson ? ([aoi.geojson] as unknown as Array<GeoJSON.Feature<GeoJSON.Geometry>>) : [],
              };
        source.setData(data);

        if (aoi?.bbox && !hasAppliedInitialViewportRef.current) {
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
      safeCall("set pins data", {}, () => {
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
      const context = { runId: stacEvidenceRunIdRef.current ?? null, featureCount: stacEvidence?.features?.length ?? 0 };
      upsertStacEvidence(map, context);
      const totalFeatures = Array.isArray(stacEvidence?.features) ? stacEvidence.features.length : 0;
      const sanitized = filterRenderableEvidence(stacEvidence);
      const renderableFeatures = sanitized.features.length;
      if (totalFeatures > 0 && renderableFeatures === 0) {
        setOverlayError("Evidence layer data is present but has no valid geometry or bbox to render on the map.");
      } else {
        setOverlayError(null);
      }
      safeCall("set STAC evidence data", context, () => {
        const source = map.getSource?.(STAC_SOURCE_ID) as unknown as GeoJSONSource | undefined;
        if (!source?.setData) return;
        const data: GeoJSON.FeatureCollection =
          totalFeatures && renderableFeatures ? sanitized : { type: "FeatureCollection", features: [] };
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
      const context = {
        runId: stacEvidenceRunIdRef.current ?? null,
        centroidCount: stacEvidenceCentroids?.features?.length ?? 0,
        enabled: Boolean(stacEvidenceCentroidsEnabled),
      };
      upsertStacEvidence(map, context);
      safeCall("set STAC evidence centroids data", context, () => {
        const source = map.getSource?.(STAC_CENTROID_SOURCE_ID) as unknown as GeoJSONSource | undefined;
        if (!source?.setData) return;
        const data: GeoJSON.FeatureCollection<GeoJSON.Point> =
          stacEvidenceCentroidsEnabled && stacEvidenceCentroids?.features?.length
            ? stacEvidenceCentroids
            : { type: "FeatureCollection", features: [] };
        source.setData(data);
      });
    };

    if (!map.isStyleLoaded?.()) {
      map.once?.("load", apply);
      return;
    }

    apply();
  }, [mapReadyTick, stacEvidenceCentroids, stacEvidenceCentroidsEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const id = selectedStacItemId ?? "";
      const context = { runId: stacEvidenceRunIdRef.current ?? null, selectedId: id || null };
      upsertStacEvidence(map, context);
      safeCall("set STAC selected filters", context, () => {
        map.setFilter?.(STAC_LAYER_OUTLINE_SELECTED, ["==", ["get", "id"], id]);
        map.setFilter?.(STAC_LAYER_POINTS_SELECTED, ["==", ["get", "id"], id]);
        map.setFilter?.(STAC_CENTROID_LAYER_SELECTED, ["==", ["get", "id"], id]);
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

    const getIdFromEvent = (event: LayerClickEvent): string | null => {
      const feature = event.features?.[0];
      const props = feature?.properties ?? null;
      const propId = props && typeof props.id === "string" ? props.id : null;
      const featureId = feature && typeof feature.id === "string" ? feature.id : null;
      const id = propId ?? featureId;
      return id ?? null;
    };

    const select = (id: string, source: "pin" | "polygon") => {
      onSelectStacItemIdRef.current?.(id);
      onSelectEvidenceRef.current?.({ id, source });
    };

    const handleSelectPolygon = (event: LayerClickEvent) => {
      const id = getIdFromEvent(event);
      if (!id) return;
      select(id, "polygon");
    };

    const handleSelectPin = (event: LayerClickEvent) => {
      const id = getIdFromEvent(event);
      if (!id) return;
      select(id, "pin");
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
      const context = { runId: stacEvidenceRunIdRef.current ?? null };
      upsertStacEvidence(map, context);
      safeCall("attach STAC click handlers", context, () => {
        map.on?.("click", STAC_LAYER_OUTLINE, handleSelectPolygon);
        map.on?.("click", STAC_LAYER_POINTS, handleSelectPolygon);
        map.on?.("click", STAC_LAYER_OUTLINE_SELECTED, handleSelectPolygon);
        map.on?.("click", STAC_LAYER_POINTS_SELECTED, handleSelectPolygon);
        map.on?.("click", STAC_CENTROID_LAYER, handleSelectPin);
        map.on?.("click", STAC_CENTROID_LAYER_SELECTED, handleSelectPin);
        map.on?.("mouseenter", STAC_LAYER_OUTLINE, setPointer);
        map.on?.("mouseenter", STAC_LAYER_POINTS, setPointer);
        map.on?.("mouseenter", STAC_LAYER_OUTLINE_SELECTED, setPointer);
        map.on?.("mouseenter", STAC_LAYER_POINTS_SELECTED, setPointer);
        map.on?.("mouseenter", STAC_CENTROID_LAYER, setPointer);
        map.on?.("mouseenter", STAC_CENTROID_LAYER_SELECTED, setPointer);
        map.on?.("mouseleave", STAC_LAYER_OUTLINE, unsetPointer);
        map.on?.("mouseleave", STAC_LAYER_POINTS, unsetPointer);
        map.on?.("mouseleave", STAC_LAYER_OUTLINE_SELECTED, unsetPointer);
        map.on?.("mouseleave", STAC_LAYER_POINTS_SELECTED, unsetPointer);
        map.on?.("mouseleave", STAC_CENTROID_LAYER, unsetPointer);
        map.on?.("mouseleave", STAC_CENTROID_LAYER_SELECTED, unsetPointer);
      });
    };

    if (!map.isStyleLoaded?.()) {
      map.once?.("load", apply);
    } else {
      apply();
    }

    return () => {
      safeCall("detach STAC click handlers", {}, () => {
        map.off?.("click", STAC_LAYER_OUTLINE, handleSelectPolygon);
        map.off?.("click", STAC_LAYER_POINTS, handleSelectPolygon);
        map.off?.("click", STAC_LAYER_OUTLINE_SELECTED, handleSelectPolygon);
        map.off?.("click", STAC_LAYER_POINTS_SELECTED, handleSelectPolygon);
        map.off?.("click", STAC_CENTROID_LAYER, handleSelectPin);
        map.off?.("click", STAC_CENTROID_LAYER_SELECTED, handleSelectPin);
        map.off?.("mouseenter", STAC_LAYER_OUTLINE, setPointer);
        map.off?.("mouseenter", STAC_LAYER_POINTS, setPointer);
        map.off?.("mouseenter", STAC_LAYER_OUTLINE_SELECTED, setPointer);
        map.off?.("mouseenter", STAC_LAYER_POINTS_SELECTED, setPointer);
        map.off?.("mouseenter", STAC_CENTROID_LAYER, setPointer);
        map.off?.("mouseenter", STAC_CENTROID_LAYER_SELECTED, setPointer);
        map.off?.("mouseleave", STAC_LAYER_OUTLINE, unsetPointer);
        map.off?.("mouseleave", STAC_LAYER_POINTS, unsetPointer);
        map.off?.("mouseleave", STAC_LAYER_OUTLINE_SELECTED, unsetPointer);
        map.off?.("mouseleave", STAC_LAYER_POINTS_SELECTED, unsetPointer);
        map.off?.("mouseleave", STAC_CENTROID_LAYER, unsetPointer);
        map.off?.("mouseleave", STAC_CENTROID_LAYER_SELECTED, unsetPointer);
        map.off?.("load", apply);
      });
    };
  }, [mapReadyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const emit = () => {
      if (!onViewportBboxChangeRef.current) return;
      try {
        const bounds = map.getBounds?.();
        if (!bounds) return;
        const arr = bounds.toArray();
        const west = arr[0][0];
        const south = arr[0][1];
        const east = arr[1][0];
        const north = arr[1][1];
        onViewportBboxChangeRef.current([west, south, east, north]);

        const center = map.getCenter?.();
        const zoom = typeof map.getZoom === "function" ? map.getZoom() : null;
        if (!center || typeof center.lng !== "number" || typeof center.lat !== "number") return;
        if (zoom == null || typeof zoom !== "number" || !Number.isFinite(zoom)) return;
        const key = storageId;
        if (!key) return;

        pendingViewRef.current = {
          center: { lng: center.lng, lat: center.lat },
          zoom,
          bbox: [west, south, east, north],
        };

        if (saveTimerRef.current != null) return;
        saveTimerRef.current = window.setTimeout(() => {
          saveTimerRef.current = null;
          const pending = pendingViewRef.current;
          if (!pending) return;
          try {
            window.localStorage.setItem(
              key,
              JSON.stringify({
                center: pending.center,
                zoom: pending.zoom,
                bbox: pending.bbox,
                updatedAt: new Date().toISOString(),
              }),
            );
          } catch {
            // ignore
          }
        }, 250);
      } catch {
        // ignore
      }
    };

    const apply = () => {
      emit();
      map.on?.("moveend", emit);
      map.on?.("zoomend", emit);
    };

    if (!map.isStyleLoaded?.()) map.once?.("load", apply);
    else apply();

    return () => {
      map.off?.("moveend", emit);
      map.off?.("zoomend", emit);
      map.off?.("load", apply);
    };
  }, [mapReadyTick, storageId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!containerRef.current) return;

    const node = containerRef.current;
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) return;
        requestAnimationFrame(() => {
          setMapState((prev) => (prev === "ready" ? prev : "initializing"));
          safeCall("resize on resume", {}, () => map.resize?.());
          upsertStacEvidence(map, { runId: stacEvidenceRunIdRef.current ?? null, reason: "resume" });
          setMapReadyTick((value) => value + 1);
        });
      },
      { root: null, threshold: 0.01 },
    );

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      requestAnimationFrame(() => {
        setMapState((prev) => (prev === "ready" ? prev : "initializing"));
        safeCall("resize on container size change", { width, height }, () => map.resize?.());
      });
    });

    visibilityObserver.observe(node);
    resizeObserver.observe(node);
    return () => {
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [mapReadyTick]);

  const visibleFailure = mapFailure ? failureCopy(mapFailure) : null;

  return (
    <div className="relative h-[26rem] w-full rounded-xl border border-slate-200 bg-slate-100">
      {mapState !== "ready" && !visibleFailure ? (
        <div className="absolute left-3 top-3 z-10 max-w-[24rem] rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-800 shadow">
          <div className="font-semibold">{mapState === "waiting_container" ? "Initializing map..." : "Loading map..."}</div>
          <div className="pt-1 text-[11px] text-slate-600">
            {mapState === "waiting_container" ? "Waiting for the map panel to finish sizing." : "Preparing the base map."}
          </div>
        </div>
      ) : null}
      {visibleFailure ? (
        <div className="absolute left-3 top-3 z-10 max-w-[24rem] rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 shadow">
          <div className="font-semibold">{visibleFailure.title}</div>
          <div className="pt-1 text-[11px] text-rose-700">{visibleFailure.detail}</div>
        </div>
      ) : overlayError ? (
        <div className="absolute left-3 top-3 z-10 max-w-[24rem] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow">
          <div className="font-semibold">Evidence layer unavailable</div>
          <div className="pt-1 text-[11px] text-amber-800">{overlayError}</div>
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
