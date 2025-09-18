import { formatJsonValue } from "@/lib/query/format";
import type { JsonValue } from "@/lib/query/schema";

interface MetricsTableProps {
  metrics: Record<string, JsonValue>;
}

export default function MetricsTable({ metrics }: MetricsTableProps) {
  const entries = Object.entries(metrics ?? {});
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-2">Metric</th>
            <th className="px-4 py-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr className="odd:bg-white even:bg-gray-50" key={key}>
              <td className="px-4 py-2 font-medium text-gray-700">{key}</td>
              <td className="px-4 py-2 text-gray-600">{formatJsonValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
