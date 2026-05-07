"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRightIcon, HomeIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileBreadcrumbsProps {
  currentPath: string
}

export function FileBreadcrumbs({ currentPath }: FileBreadcrumbsProps) {
  const segments = currentPath.split("/").filter(Boolean)

  return (
    <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        href="/files"
        className="-m-1 flex items-center gap-1.5 rounded p-1 transition-colors hover:text-foreground"
      >
        <HomeIcon className="size-4" />
        <span className="font-medium">Files</span>
      </Link>

      {segments.map((segment, index) => {
        const path = segments.slice(0, index + 1).join("/")
        return (
          <React.Fragment key={path}>
            <ChevronRightIcon className="size-3.5 shrink-0 opacity-50" />
            <Link
              href={`/files/${path}`}
              className={cn(
                "-m-1 rounded p-1 capitalize transition-colors hover:text-foreground",
                index === segments.length - 1 && "font-semibold text-foreground"
              )}
            >
              {segment}
            </Link>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
