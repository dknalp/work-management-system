/**
 * Files page (server component) — resolves the current path from URL params
 * and renders FileClientPage which handles all client-side state and auth.
 *
 * The sidebar shell is provided by FileClientPage itself (via AppShellDynamic)
 * rather than here, because AppShellDynamic requires a client boundary.
 */

import React, { Suspense } from "react"
import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"
import { FileClientPage } from "@/components/files/file-client-page"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  params: Promise<{
    path?: string[]
  }>
}

export default async function FilesPage({ params }: PageProps) {
  const resolvedParams = await params
  const pathSegments = resolvedParams.path ?? []
  const currentPath = pathSegments.join("/")

  // Files are fetched client-side (auth tokens live in localStorage).
  // FileClientPage loads items via useEffect → listFiles(currentPath).

  return (
    <AppShellDynamic>
      <main className="flex flex-1 flex-col">
        <Suspense fallback={
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        }>
          <FileClientPage
            initialItems={[]}
            currentPath={currentPath}
            isDrivePath={false}
          />
        </Suspense>
      </main>
    </AppShellDynamic>
  )
}