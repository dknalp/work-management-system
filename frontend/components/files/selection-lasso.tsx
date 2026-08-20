"use client"

import * as React from "react"

interface LassoRect {
  left: number
  top: number
  width: number
  height: number
}

interface SelectionLassoProps {
  containerRef: React.RefObject<HTMLElement | null>
  onSelectionChange: (rect: LassoRect | null) => void
  onEmptyClick?: () => void
}

export function SelectionLasso({
  containerRef,
  onSelectionChange,
  onEmptyClick,
}: SelectionLassoProps) {
  const [lasso, setLasso] = React.useState<LassoRect | null>(null)

  // Keep callback refs so we never need to re-register DOM listeners
  const onSelectionChangeRef = React.useRef(onSelectionChange)
  const onEmptyClickRef = React.useRef(onEmptyClick)
  React.useEffect(() => { onSelectionChangeRef.current = onSelectionChange }, [onSelectionChange])
  React.useEffect(() => { onEmptyClickRef.current = onEmptyClick }, [onEmptyClick])

  React.useEffect(() => {
    // Poll until container mounts — avoids the null-at-first-render trap
    let container: HTMLElement | null = null
    let raf = 0

    const startPos = { x: 0, y: 0 }
    let active = false
    let dragging = false

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('button, a, input, select, textarea, [role="menuitem"], [role="menu"]')) return
      if (target.closest("[data-file-path]")) return

      // Prevent the browser from starting a native HTML5 drag session when the
      // mouse moves over a draggable <TableRow>. Without this, the browser
      // hijacks the gesture and stops firing mousemove, so the lasso never draws.
      e.preventDefault()
      document.body.style.userSelect = "none"

      startPos.x = e.clientX
      startPos.y = e.clientY
      active = true
      dragging = false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!active) return
      const dx = e.clientX - startPos.x
      const dy = e.clientY - startPos.y
      if (!dragging && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      dragging = true

      const rect: LassoRect = {
        left: Math.min(startPos.x, e.clientX),
        top: Math.min(startPos.y, e.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      }
      setLasso(rect)

      // Convert to container-relative for intersection testing
      if (container) {
        const cRect = container.getBoundingClientRect()
        onSelectionChangeRef.current({
          left: rect.left - cRect.left + container.scrollLeft,
          top: rect.top - cRect.top + container.scrollTop,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (!active) return

      if (!dragging) {
        // Plain click on empty space
        const target = e.target as HTMLElement
        if (!target.closest("[data-file-path]")) {
          onEmptyClickRef.current?.()
        }
      }

      active = false
      dragging = false
      setLasso(null)
      onSelectionChangeRef.current(null)
      document.body.style.userSelect = ""
    }

    const attach = (el: HTMLElement) => {
      container = el
      el.addEventListener("mousedown", onMouseDown, { capture: true })
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
    }

    const detach = () => {
      if (!container) return
      container.removeEventListener("mousedown", onMouseDown, { capture: true })
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      container = null
    }

    // Try immediately, then poll every frame until available
    const tryAttach = () => {
      const el = containerRef.current
      if (el) {
        attach(el)
      } else {
        raf = requestAnimationFrame(tryAttach)
      }
    }

    tryAttach()

    return () => {
      cancelAnimationFrame(raf)
      detach()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run ONCE — callbacks read from refs, container polled until available

  if (!lasso) return null

  return (
    <div
      className="pointer-events-none fixed z-[9999] rounded-[2px] border border-primary bg-primary/15"
      style={{
        left: lasso.left,
        top: lasso.top,
        width: lasso.width,
        height: lasso.height,
      }}
    />
  )
}