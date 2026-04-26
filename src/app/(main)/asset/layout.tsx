import { ReactNode } from "react";

import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { AssetDataProvider } from "@/contexts/asset-data-context";
import { ReactQueryProvider } from "@/components/react-query-provider";
import { ScrollToTop } from "@/components/scroll-to-top";
import { ThemeSwitcher } from "./_components/top-nav/theme-switcher";
import { NavUser } from "./_components/top-nav/tool-menu";
import { GuideMiniButton } from "./_components/top-nav/guide-mini-banner";
import { ShareScreenshotButton } from "./_components/top-nav/share/share-screenshot-button";
import { rootUser } from "@/config/users";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  // Configuration forms have been removed; hardcode best-looking defaults
  const contentLayout = "centered";

  const navbarStyle = "scroll";

  return (
    <ReactQueryProvider>
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
                "flex h-10 sm:h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 relative z-50",
                "sticky top-0 bg-background/95 backdrop-blur-sm rounded-t-[inherit] overflow-hidden",
                "mt-1",
              )}
            >
              <div className="flex w-full items-center justify-between px-3 lg:px-12">
                <div className="flex items-center gap-1 lg:gap-2">
                  <GuideMiniButton />
                </div>
                <div className="flex items-center gap-2">
                  <ShareScreenshotButton />
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
    </ReactQueryProvider>
  );
}
