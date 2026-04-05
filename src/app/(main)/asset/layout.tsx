import { ReactNode } from "react";

import { cookies } from "next/headers";

import { AppSidebar } from "@/app/(main)/asset/_components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { AssetDataProvider } from "@/contexts/asset-data-context";
import { ScrollToTop } from "@/components/scroll-to-top";
import { ThemeSwitcher } from "./_components/sidebar/theme-switcher";
import { NavUser } from "./_components/sidebar/nav-user";
import { rootUser } from "@/config/users";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  // Configuration forms have been removed; hardcode best-looking defaults
  const sidebarVariant = "inset";
  const sidebarCollapsible = "icon";
  const contentLayout = "centered";

  const navbarStyle = "scroll";

  return (
    <AssetDataProvider>
      <SidebarProvider defaultOpen={defaultOpen} className="bg-sidebar">
        <SidebarInset
          data-content-layout={contentLayout}
          className={cn(
            "data-[content-layout=centered]:!mx-auto data-[content-layout=centered]:max-w-screen-2xl",
            "max-[113rem]:peer-data-[variant=inset]:!mr-2 min-[101rem]:peer-data-[variant=inset]:peer-data-[state=collapsed]:!mr-auto",
          )}
        >
          <header
            data-navbar-style={navbarStyle}
            className={cn(
              "flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 relative z-50",
              "data-[navbar-style=sticky]:bg-background/50 data-[navbar-style=sticky]:sticky data-[navbar-style=sticky]:top-0 data-[navbar-style=sticky]:overflow-hidden data-[navbar-style=sticky]:rounded-t-[inherit] data-[navbar-style=sticky]:backdrop-blur-md",
              "bg-background/95 backdrop-blur-sm",
              "mt-1"
            )}
          >
            <div className="flex w-full items-center justify-between px-3 lg:px-12">
              <div className="flex items-center gap-1 lg:gap-2">
              </div>
              <div className="flex items-center gap-2">
                <NavUser user={rootUser} />
                <ThemeSwitcher />
              </div>
            </div>
          </header>
          <div className="h-full px-2 py-2 md:px-12 md:py-6">{children}</div>
          <ScrollToTop />
        </SidebarInset>
      </SidebarProvider>
    </AssetDataProvider>
  );
}
