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
          "stac-evidence": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          pins: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm" },
          { id: "aoi-fill", type: "fill", source: "aoi", paint: { "fill-color": "#60a5fa", "fill-opacity": 0.18 } },
          { id: "aoi-line", type: "line", source: "aoi", paint: { "line-color": "#2563eb", "line-width": 2 } },
          {
            id: "stac-evidence-fill",
            type: "fill",
            source: "stac-evidence",
            filter: ["in", "$type", "Polygon", "MultiPolygon"],
            paint: { "fill-color": "#7c3aed", "fill-opacity": 0.06 },
          },
          {
            id: "stac-evidence-outline",
            type: "line",
            source: "stac-evidence",
            filter: ["in", "$type", "Polygon", "MultiPolygon"],
            paint: { "line-color": "#7c3aed", "line-width": 1 },
          },
          {
            id: "stac-evidence-points",
            type: "circle",
            source: "stac-evidence",
            filter: ["==", "$type", "Point"],
            paint: { "circle-color": "#7c3aed", "circle-radius": 4, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 },
          },
          {
            id: "stac-evidence-outline-selected",
            type: "line",
            source: "stac-evidence",
            filter: ["==", ["get", "id"], ""],
            paint: { "line-color": "#0ea5e9", "line-width": 2 },
          },
          {
            id: "stac-evidence-points-selected",
            type: "circle",
            source: "stac-evidence",
            filter: ["==", ["get", "id"], ""],
            paint: { "circle-color": "#0ea5e9", "circle-radius": 6, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
          },
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
      mapRef.current = map;
      setMapReadyTick((value) => value + 1);
      onMapReadyRef.current?.(map);
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
      const source = map.getSource?.("pins") as unknown as GeoJSONSource | undefined;
      if (!source?.setData) return;
      source.setData(pointsGeoJson);
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
      const source = map.getSource?.("stac-evidence") as unknown as GeoJSONSource | undefined;
      if (!source?.setData) return;
      const data: GeoJSON.FeatureCollection =
        stacEvidence?.features?.length ? stacEvidence : { type: "FeatureCollection", features: [] };
      source.setData(data);
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
      try {
        map.setFilter?.("stac-evidence-outline-selected", ["==", ["get", "id"], id]);
        map.setFilter?.("stac-evidence-points-selected", ["==", ["get", "id"], id]);
      } catch {
        // ignore
      }
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

    type LayerClickEvent = {
      features?: Array<{ id?: unknown; properties?: Record<string, unknown> | null }>;
    };

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
      map.on?.("click", "stac-evidence-outline", handleSelect);
      map.on?.("click", "stac-evidence-points", handleSelect);
      map.on?.("mouseenter", "stac-evidence-outline", setPointer);
      map.on?.("mouseenter", "stac-evidence-points", setPointer);
      map.on?.("mouseleave", "stac-evidence-outline", unsetPointer);
      map.on?.("mouseleave", "stac-evidence-points", unsetPointer);
    };

    if (!map.isStyleLoaded?.()) {
      map.once?.("load", apply);
    } else {
      apply();
    }

    return () => {
      map.off?.("click", "stac-evidence-outline", handleSelect);
      map.off?.("click", "stac-evidence-points", handleSelect);
      map.off?.("mouseenter", "stac-evidence-outline", setPointer);
      map.off?.("mouseenter", "stac-evidence-points", setPointer);
      map.off?.("mouseleave", "stac-evidence-outline", unsetPointer);
      map.off?.("mouseleave", "stac-evidence-points", unsetPointer);
    };
  }, [mapReadyTick]);

  return <div ref={containerRef} className="h-[26rem] w-full rounded-xl border border-slate-200 bg-slate-100" />;
}
