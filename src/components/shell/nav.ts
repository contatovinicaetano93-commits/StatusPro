import {
  Activity,
  AlertTriangle,
  Boxes,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Sun,
  Truck,
  Wallet,
} from "lucide-react";

export const APP_NAV = [
  { href: "/ceo", label: "Pulse / Hoje", shortLabel: "Hoje", icon: Sun },
  { href: "/cash", label: "Caixa & Recebíveis", shortLabel: "Caixa", icon: Wallet },
  { href: "/inventory", label: "Estoque & Rupturas", shortLabel: "Estoque", icon: Boxes },
  { href: "/sales", label: "Vendas & Margem", shortLabel: "Vendas", icon: LayoutDashboard },
  { href: "/service", label: "Serviço", shortLabel: "Serviço", icon: Truck },
  { href: "/risk", label: "Risco", shortLabel: "Risco", icon: ShieldAlert },
  { href: "/alerts", label: "Alertas", shortLabel: "Alertas", icon: AlertTriangle },
  { href: "/horizons/weekly", label: "Horizontes", shortLabel: "Horizonte", icon: Activity },
] as const;

export const BOTTOM_NAV = APP_NAV.slice(0, 4);

export const SECONDARY_NAV = [
  { href: "/sync", label: "Sync Center", icon: Activity },
  { href: "/config", label: "Config", icon: Settings },
] as const;

export function pageTitleFromPath(pathname: string) {
  if (pathname.startsWith("/ceo")) return "Pulse do dia";
  if (pathname.startsWith("/cash")) return "Caixa & Recebíveis";
  if (pathname.startsWith("/inventory")) return "Estoque & Rupturas";
  if (pathname.startsWith("/sales")) return "Vendas & Margem";
  if (pathname.startsWith("/service")) return "Serviço";
  if (pathname.startsWith("/risk")) return "Risco";
  if (pathname.startsWith("/alerts")) return "Alertas & Playbooks";
  if (pathname.startsWith("/horizons")) return "Horizontes";
  if (pathname.startsWith("/sync")) return "Sync Center";
  if (pathname.startsWith("/config")) return "Config";
  return "StatusPro";
}
