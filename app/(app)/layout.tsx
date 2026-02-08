import { headers } from "next/headers";
import { APP_CONFIG_DEFAULTS } from "@/app-config";
import type { AppConfig } from "@/lib/types";
import { getAppConfig } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const hdrs = await headers();
  const config: Partial<AppConfig> = await getAppConfig(hdrs);

  const {
    logo = APP_CONFIG_DEFAULTS.logo,
    logoDark = APP_CONFIG_DEFAULTS.logoDark,
  } = config;

  return <>{children}</>;
}
