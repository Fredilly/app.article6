import React from "react";

export default function SidePane() {
  return (
    <div className="h-full p-4 space-y-3">
      <h2 className="text-lg font-semibold">Project tools</h2>
      <ul className="text-sm list-disc pl-5 space-y-1">
        <li>Map upload (KML/GeoJSON) — coming next</li>
        <li>Compliance presets (Art. 6.4)</li>
        <li>Risk preview &amp; evidence</li>
      </ul>
      <p className="text-xs text-gray-500">
        Backend currently set to <strong>echo</strong>. Switch to QWEN by
        setting <code>QWEN_PROVIDER=local|hf</code> and configuring env vars.
      </p>
    </div>
  );
}
