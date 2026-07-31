import { DEMO_USERS } from "@/infrastructure/auth/session";
import { ROLE_LABELS } from "@/domain/roles";
import { getBrand } from "@/lib/brand";

export type LoginOption = {
  email: string;
  label: string;
};

export type LoginPageView = {
  brandDisplayName: string;
  loginSubtitle: string;
  options: LoginOption[];
  defaultEmail: string;
};

export async function getLoginOptions(): Promise<LoginPageView> {
  const brand = getBrand();
  return {
    brandDisplayName: brand.displayName,
    loginSubtitle: brand.loginSubtitle,
    defaultEmail: "ceo@statuspro.local",
    options: DEMO_USERS.map((u) => ({
      email: u.email,
      label: `${ROLE_LABELS[u.role]} — ${u.email}`,
    })),
  };
}
