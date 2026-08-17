"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRightIcon, HomeIcon } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
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

function DroppableLink({
  href,
  droppableId,
  droppablePath,
  className,
  children,
}: {
  href: string
  droppableId: string
  droppablePath: string
  className?: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: "breadcrumb", path: droppablePath },
  })

  return (
    <Link
      ref={setNodeRef}
      href={href}
      className={cn(
        "-m-1 rounded p-1 transition-colors hover:text-foreground",
        isOver && "bg-primary/15 ring-2 ring-primary/40",
        className
      )}
    >
      {children}
    </Link>
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

  const buildPath = (index: number) => {
    return segments.slice(0, index + 1).join("/")
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <DroppableLink
        href="/files"
        droppableId="breadcrumb-root"
        droppablePath=""
        className="flex items-center gap-1.5"
      >
        <HomeIcon className="size-4" />
        <span className="font-medium">Dosyalar</span>
      </DroppableLink>

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
        const isLast = index === segments.length - 1
        return (
          <React.Fragment key={index}>
            <ChevronRightIcon className="size-3.5 shrink-0 opacity-50" />
            {isLast ? (
              <span className="font-semibold text-foreground">{segment}</span>
            ) : (
              <DroppableLink
                href={buildHref(index)}
                droppableId={`breadcrumb-${buildPath(index)}`}
                droppablePath={buildPath(index)}
                className="capitalize"
              >
                {segment}
              </DroppableLink>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}