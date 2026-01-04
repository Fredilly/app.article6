"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

type MapCanvasProps = {
  aoi: AOI | null;
  pins: EvidencePin[];
};

function centerFromBbox(bbox: [number, number, number, number]): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

export default function MapCanvas({ aoi, pins }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

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
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded?.()) return;
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
  }, [aoi]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded?.()) return;
    const source = map.getSource?.("pins") as unknown as GeoJSONSource | undefined;
    if (!source?.setData) return;
    source.setData(pointsGeoJson);
  }, [pointsGeoJson]);

  return <div ref={containerRef} className="h-[26rem] w-full rounded-xl border border-slate-200 bg-slate-100" />;
}
