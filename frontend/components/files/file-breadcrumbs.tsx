"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRightIcon, HomeIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileBreadcrumbsProps {
  currentPath: string
  isDrivePath?: boolean
}

function DriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M6.28 3L1 12.95 6.28 21H17.72L23 12.95 17.72 3H6.28zM7.5 5h9l4.08 7H3.42L7.5 5zm-.78 9h10.56l-2.64 4.62H9.36L6.72 14z" />
    </svg>
  )
}

export function FileBreadcrumbs({ currentPath, isDrivePath = false }: FileBreadcrumbsProps) {
  const segments = currentPath.split("/").filter(Boolean)

  const buildHref = (index: number) => {
    const parts = segments.slice(0, index + 1)
    if (isDrivePath) {
      return `/files/drive${parts.length ? "/" + parts.join("/") : ""}`
    }
    return parts.length ? `/files/${parts.join("/")}` : "/files"
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        href="/files"
        className="-m-1 flex items-center gap-1.5 rounded p-1 transition-colors hover:text-foreground"
      >
        <HomeIcon className="size-4" />
        <span className="font-medium">Dosyalar</span>
      </Link>

      {isDrivePath && (
        <>
          <ChevronRightIcon className="size-3.5 shrink-0 opacity-50" />
          <Link
            href="/files/drive"
            className={cn(
              "-m-1 flex items-center gap-1 rounded p-1 transition-colors hover:text-foreground",
              segments.length === 0 && "font-semibold text-foreground"
            )}
          >
            <DriveIcon className="size-3.5 text-blue-500" />
            Google Drive
          </Link>
        </>
      )}

      {segments.map((segment, index) => {
        return (
          <React.Fragment key={index}>
            <ChevronRightIcon className="size-3.5 shrink-0 opacity-50" />
            <Link
              href={buildHref(index)}
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