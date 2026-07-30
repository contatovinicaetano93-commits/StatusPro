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
    <div className="grid-kpi">
      {items.map((item) => (
        <article key={item.definition.id} className="panel" title={item.definition.formula}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {item.definition.name}
          </div>
          <div className={`band-${item.band}`} style={{ fontSize: "1.45rem", fontWeight: 600 }}>
            {item.formatted}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {item.target != null ? `Meta ${formatKpiValue(item.definition, item.target)} · ` : ""}
            {item.band} · {item.quality}
          </div>
        </article>
      ))}
    </div>
  );
}
