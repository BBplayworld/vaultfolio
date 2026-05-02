import { ReactNode } from "react";

import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { AssetDataProvider } from "@/contexts/asset-data-context";
import { ReactQueryProvider } from "@/components/react-query-provider";
import { ScrollToTop } from "@/components/scroll-to-top";
import { TopBar } from "./_components/top-nav/top-bar";

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
              "data-[content-layout=centered]:!mx-auto data-[content-layout=centered]:max-w-[1400px]",
            )}
          >
            <header
              data-navbar-style={navbarStyle}
              className={cn(
                "flex h-12 sm:h-14 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14 relative z-50",
                "sticky top-0 bg-background/95 backdrop-blur-sm rounded-t-[inherit] overflow-hidden",
                "mt-1",
              )}
            >
              <TopBar />
            </header>
            <div className="h-full px-2 py-2 md:px-12 md:py-2 mt-2 sm:mt-0">{children}</div>
            <ScrollToTop />
          </SidebarInset>
        </SidebarProvider>
      </AssetDataProvider>
    </ReactQueryProvider>
  );
}
