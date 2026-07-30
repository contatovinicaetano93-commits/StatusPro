import { formatKpiValue } from "@/domain/kpis/engine";
import type { KpiDefinition, ThresholdBand } from "@/domain/types";

type KpiCardProps = {
  definition: KpiDefinition;
  value: number;
  target?: number | null;
  band: ThresholdBand;
  formatted: string;
  quality: string;
};

export function KpiStrip({ items }: { items: KpiCardProps[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.definition.id}
          className="rounded-2xl border border-border bg-card p-4 animate-rise"
          title={item.definition.formula}
        >
          <div className="mb-2 text-xs uppercase tracking-wide text-muted">{item.definition.name}</div>
          <div
            className={`text-2xl font-semibold ${
              item.band === "green"
                ? "text-success"
                : item.band === "yellow"
                  ? "text-warning"
                  : "text-danger"
            }`}
          >
            {item.formatted}
          </div>
          <div className="mt-2 text-xs text-muted">
            {item.target != null ? `Meta ${formatKpiValue(item.definition, item.target)} · ` : ""}
            {item.band} · {item.quality}
          </div>
        </article>
      ))}
    </div>
  );
}
