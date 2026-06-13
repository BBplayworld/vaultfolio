import { ReactNode } from "react";

import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { AssetDataProvider } from "@/contexts/asset-data-context";
import { ReactQueryProvider } from "@/components/react-query-provider";
import { TopBar } from "./_components/header-menu/top-bar";
import { TutorialStoreProvider } from "@/stores/tutorial/tutorial-provider";
import { NavigationProvider } from "./_components/layout/navigation/navigation-context";
import { CloudSyncProvider } from "@/lib/cloud-sync/cloud-sync-provider";
import { CloudSyncConnectDialog } from "./_components/functions/cloud-sync/cloud-sync-connect-dialog";


export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  // Configuration forms have been removed; hardcode best-looking defaults
  const contentLayout = "centered";

  return (
    <ReactQueryProvider>
      <AssetDataProvider>
        <CloudSyncProvider>
        <CloudSyncConnectDialog />
        <NavigationProvider>
          <TutorialStoreProvider>
            <SidebarProvider defaultOpen={defaultOpen} className="bg-sidebar">
              <SidebarInset
                data-content-layout={contentLayout}
                className={cn(
                  "data-[content-layout=centered]:!mx-auto data-[content-layout=centered]:max-w-[1400px]",
                )}
              >
                <TopBar />
                <div className="h-full px-3 pt-2 pb-10 md:px-12 md:pt-2 md:pb-14 mt-2 sm:mt-0">{children}</div>
              </SidebarInset>
            </SidebarProvider>
          </TutorialStoreProvider>
        </NavigationProvider>
        </CloudSyncProvider>
      </AssetDataProvider>
    </ReactQueryProvider>
  );

}
