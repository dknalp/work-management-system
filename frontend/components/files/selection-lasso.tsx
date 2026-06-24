"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SelectionLassoProps {
  containerRef: React.RefObject<HTMLElement | null>
  onSelectionChange: (
    selectedRect: {
      top: number
      left: number
      width: number
      height: number
    } | null
  ) => void
}

export function SelectionLasso({
  containerRef,
  onSelectionChange,
}: SelectionLassoProps) {
  const [startPos, setStartPos] = React.useState<{
    x: number
    y: number
  } | null>(null)
  const [currentPos, setCurrentPos] = React.useState<{
    x: number
    y: number
  } | null>(null)

  const handleMouseDown = (e: MouseEvent) => {
    // Only handle left click on the container itself or empty space
    if (e.button !== 0) return

    const target = e.target as HTMLElement
    // Prevent starting lasso if clicking an interactive element or a drag handle
    if (
      target.closest(
        'button, a, [role="menuitem"], [data-radix-collection-item], [data-drag-handle]'
      )
    )
      return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setStartPos({ x, y })
    setCurrentPos({ x, y })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!startPos) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))

    setCurrentPos({ x, y })
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (startPos && currentPos) {
      const dx = Math.abs(currentPos.x - startPos.x)
      const dy = Math.abs(currentPos.y - startPos.y)
      if (dx > 5 || dy > 5) {
        // Was dragging - prevent the subsequent click event from clearing the selection
        const preventClick = (clickEvent: MouseEvent) => {
          clickEvent.stopPropagation()
          clickEvent.preventDefault()
          window.removeEventListener("click", preventClick, true)
        }
        window.addEventListener("click", preventClick, true)
        setTimeout(
          () => window.removeEventListener("click", preventClick, true),
          50
        )
      }
    }

    setStartPos(null)
    setCurrentPos(null)
    onSelectionChange(null)
  }

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      container.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [containerRef, startPos, currentPos])

  React.useEffect(() => {
    if (startPos && currentPos) {
      const left = Math.min(startPos.x, currentPos.x)
      const top = Math.min(startPos.y, currentPos.y)
      const width = Math.abs(startPos.x - currentPos.x)
      const height = Math.abs(startPos.y - currentPos.y)

      onSelectionChange({ left, top, width, height })
    }
  }, [startPos, currentPos, onSelectionChange])

  if (!startPos || !currentPos) return null

  const left = Math.min(startPos.x, currentPos.x)
  const top = Math.min(startPos.y, currentPos.y)
  const width = Math.abs(startPos.x - currentPos.x)
  const height = Math.abs(startPos.y - currentPos.y)

  return (
    <div
      className="pointer-events-none absolute z-50 rounded-[2px] border border-primary bg-primary/20"
      style={{
        left,
        top,
        width,
        height,
      }}
    />
  )
}
