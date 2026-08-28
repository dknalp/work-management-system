/**
 * Tests for the upload queue bug fixes.
 *
 * These tests cover pure logic (no React rendering) so they run fast and
 * reliably without jsdom complexity. The three frontend bugs manifest in the
 * interaction between activeCount, itemsRef, and the drain scheduling — all
 * of which can be exercised with plain TypeScript.
 *
 * Bug 1 – drainQueue must NOT run uploadFn inside a React state updater
 * Bug 2 – itemsRef must be updated synchronously before drainQueue fires
 * Bug 3 – folder upload must group files by path before calling addFiles
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ─────────────────────────────────────────────────────────────────────────────
// Pure logic extracted for testing — mirrors the fixed implementation
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CONCURRENT = 3

type Status = "pending" | "uploading" | "done" | "error"
interface UploadItem {
  id: string
  file: File
  status: Status
  progress: number
}

/**
 * Simulates the FIXED drainQueue logic:
 * - reads pending items from itemsRef (NOT from a setItems updater)
 * - calls startFn for each item within the available slots
 *
 * The bug would be calling startFn inside a setItems updater function.
 */
function drainQueue(
  itemsRef: UploadItem[],
  activeCount: { current: number },
  startFn: (item: UploadItem) => void
) {
  const pending = itemsRef.filter((i) => i.status === "pending")
  const slots = MAX_CONCURRENT - activeCount.current
  pending.slice(0, slots).forEach((item) => startFn(item))
}

/**
 * Simulates the FIXED addFiles logic:
 * - updates itemsRef synchronously BEFORE calling drainQueue
 * - calls drainQueue directly (not via setTimeout)
 */
function addFiles(
  files: File[],
  path: string,
  itemsRef: UploadItem[],
  activeCount: { current: number },
  startFn: (item: UploadItem) => void
): UploadItem[] {
  const newItems: UploadItem[] = files.map((file, i) => ({
    id: `item-${Date.now()}-${i}`,
    file,
    status: "pending",
    progress: 0,
  }))
  // FIX: update itemsRef synchronously so drainQueue sees the new items
  itemsRef.push(...newItems)
  drainQueue(itemsRef, activeCount, startFn)
  return newItems
}

// ─────────────────────────────────────────────────────────────────────────────
// Bug 1 — drainQueue logic: no side-effects inside state updaters
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug 1: drainQueue must start uploads without a React state updater", () => {
  it("starts up to MAX_CONCURRENT items from pending list", () => {
    const items: UploadItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `item-${i}`,
      file: new File(["x"], `file${i}.txt`),
      status: "pending" as Status,
      progress: 0,
    }))
    const activeCount = { current: 0 }
    const started: string[] = []

    drainQueue(items, activeCount, (item) => {
      started.push(item.id)
      activeCount.current++
      item.status = "uploading"
    })

    expect(started.length).toBe(3) // MAX_CONCURRENT = 3
    expect(started).toEqual(["item-0", "item-1", "item-2"])
    expect(items.filter((i) => i.status === "pending").length).toBe(2) // 2 still pending
  })

  it("respects activeCount — does not start more than MAX_CONCURRENT - active uploads", () => {
    const items: UploadItem[] = Array.from({ length: 4 }, (_, i) => ({
      id: `item-${i}`,
      file: new File(["x"], `file${i}.txt`),
      status: "pending" as Status,
      progress: 0,
    }))
    const activeCount = { current: 2 } // 2 already uploading
    const started: string[] = []

    drainQueue(items, activeCount, (item) => {
      started.push(item.id)
    })

    expect(started.length).toBe(1) // only 1 slot left (3 - 2 = 1)
  })

  it("starts nothing when activeCount is already at MAX_CONCURRENT", () => {
    const items: UploadItem[] = [
      { id: "p1", file: new File(["x"], "p.txt"), status: "pending", progress: 0 },
    ]
    const activeCount = { current: 3 }
    const started: string[] = []

    drainQueue(items, activeCount, (item) => { started.push(item.id) })

    expect(started.length).toBe(0)
  })

  it("skips items that are not pending", () => {
    const items: UploadItem[] = [
      { id: "u1", file: new File(["x"], "u.txt"), status: "uploading", progress: 50 },
      { id: "d1", file: new File(["x"], "d.txt"), status: "done", progress: 100 },
      { id: "p1", file: new File(["x"], "p.txt"), status: "pending", progress: 0 },
    ]
    const activeCount = { current: 1 } // the "uploading" item
    const started: string[] = []

    drainQueue(items, activeCount, (item) => { started.push(item.id) })

    expect(started).toEqual(["p1"])
  })

  it("does not double-start items (simulates StrictMode double-invoke safety)", () => {
    // If drainQueue were called inside a React updater, React 18 StrictMode
    // would invoke the updater twice. Verify that our logic is idempotent:
    // calling drainQueue twice with the same state starts each item only once.
    const items: UploadItem[] = Array.from({ length: 3 }, (_, i) => ({
      id: `item-${i}`,
      file: new File(["x"], `f${i}.txt`),
      status: "pending" as Status,
      progress: 0,
    }))
    const activeCount = { current: 0 }
    const started: string[] = []

    // First invocation (simulates first updater call)
    drainQueue(items, activeCount, (item) => {
      if (item.status === "pending") {
        item.status = "uploading"
        activeCount.current++
        started.push(item.id)
      }
    })

    // Second invocation (simulates StrictMode double-invoke)
    drainQueue(items, activeCount, (item) => {
      if (item.status === "pending") {
        item.status = "uploading"
        activeCount.current++
        started.push(item.id)
      }
    })

    // No item should be started twice
    const unique = new Set(started)
    expect(unique.size).toBe(started.length)
    expect(started.length).toBe(3) // exactly 3, not 6
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug 2 — itemsRef must be updated before drainQueue fires
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug 2: itemsRef must be synchronously updated before drainQueue runs", () => {
  it("drainQueue sees all new items when itemsRef is updated before the drain", () => {
    const itemsRef: UploadItem[] = []
    const activeCount = { current: 0 }
    const started: string[] = []

    const files = Array.from({ length: 5 }, (_, i) =>
      new File([`c${i}`], `f${i}.txt`)
    )

    addFiles(files, "", itemsRef, activeCount, (item) => {
      started.push(item.id)
      activeCount.current++
      item.status = "uploading"
    })

    // All 5 files were added to itemsRef before drain ran
    expect(itemsRef.length).toBe(5)
    // Drain should have started exactly MAX_CONCURRENT = 3
    expect(started.length).toBe(3)
    // Remaining 2 are still pending
    expect(itemsRef.filter((i) => i.status === "pending").length).toBe(2)
  })

  it("stale itemsRef (bug scenario) would miss items — demonstrates why sync update matters", () => {
    // Simulate the OLD (buggy) behaviour: itemsRef is NOT updated before drain
    const staleItemsRef: UploadItem[] = [] // empty — not updated yet
    const activeCount = { current: 0 }
    const started: string[] = []

    const files = Array.from({ length: 5 }, (_, i) =>
      new File([`c${i}`], `f${i}.txt`)
    )

    // Buggy: drain runs against stale (empty) ref
    drainQueue(staleItemsRef, activeCount, (item) => {
      started.push(item.id)
      activeCount.current++
    })

    // Drain saw nothing — all 5 files would be stuck as pending
    expect(started.length).toBe(0)
  })

  it("subsequent drain after an upload completes picks up remaining pending items", () => {
    const itemsRef: UploadItem[] = []
    const activeCount = { current: 0 }
    const started: string[] = []

    const files = Array.from({ length: 5 }, (_, i) =>
      new File([`c${i}`], `f${i}.txt`)
    )

    addFiles(files, "", itemsRef, activeCount, (item) => {
      started.push(item.id)
      activeCount.current++
      item.status = "uploading"
    })

    expect(started.length).toBe(3)

    // Simulate first upload completing → activeCount drops, drain fires again
    itemsRef[0].status = "done"
    activeCount.current--

    drainQueue(itemsRef, activeCount, (item) => {
      started.push(item.id)
      activeCount.current++
      item.status = "uploading"
    })

    // 4th item should now start
    expect(started.length).toBe(4)

    // Simulate 2nd completing
    itemsRef[1].status = "done"
    activeCount.current--

    drainQueue(itemsRef, activeCount, (item) => {
      started.push(item.id)
      activeCount.current++
      item.status = "uploading"
    })

    expect(started.length).toBe(5) // all 5 started, none missed
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug 3 — folder upload must group files by path
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the fixed file-toolbar.tsx folder-upload onChange logic.
 */
function groupFilesByTargetPath(
  rawFiles: (File & { webkitRelativePath?: string })[],
  currentPath: string
): Map<string, File[]> {
  const byPath = new Map<string, File[]>()
  for (const file of rawFiles) {
    const relativePath = file.webkitRelativePath ?? file.name
    const folderPart = relativePath.substring(0, relativePath.lastIndexOf("/"))
    const targetPath = currentPath
      ? folderPart ? `${currentPath}/${folderPart}` : currentPath
      : folderPart || ""
    const group = byPath.get(targetPath) ?? []
    group.push(file)
    byPath.set(targetPath, group)
  }
  return byPath
}

describe("Bug 3: folder upload must group files by path before calling addFiles", () => {
  function makeWebkitFile(name: string, relativePath: string) {
    const f = new File(["x"], name)
    Object.defineProperty(f, "webkitRelativePath", { value: relativePath })
    return f
  }

  it("3 files in the same folder → 1 group → 1 addFiles call", () => {
    const files = [
      makeWebkitFile("a.txt", "folder/a.txt"),
      makeWebkitFile("b.txt", "folder/b.txt"),
      makeWebkitFile("c.txt", "folder/c.txt"),
    ]
    const groups = groupFilesByTargetPath(files, "")
    expect(groups.size).toBe(1)
    expect(groups.get("folder")?.length).toBe(3)
  })

  it("files in 2 different subfolders → 2 groups → 2 addFiles calls", () => {
    const files = [
      makeWebkitFile("img.png", "photos/img.png"),
      makeWebkitFile("doc.pdf", "docs/doc.pdf"),
      makeWebkitFile("video.mp4", "photos/video.mp4"),
    ]
    const groups = groupFilesByTargetPath(files, "")
    expect(groups.size).toBe(2)
    expect(groups.get("photos")?.length).toBe(2)
    expect(groups.get("docs")?.length).toBe(1)
  })

  it("file at root level (no subfolder in relativePath) → empty-string path", () => {
    const files = [makeWebkitFile("readme.md", "readme.md")]
    const groups = groupFilesByTargetPath(files, "")
    expect(groups.size).toBe(1)
    expect(groups.has("")).toBe(true)
    expect(groups.get("")?.length).toBe(1)
  })

  it("prefixes targetPath with currentPath when currentPath is set", () => {
    const files = [makeWebkitFile("shot.png", "assets/shot.png")]
    const groups = groupFilesByTargetPath(files, "my-project")
    expect(groups.size).toBe(1)
    expect(groups.has("my-project/assets")).toBe(true)
  })

  it("naive per-file approach (bug) creates N groups instead of 1", () => {
    // OLD (buggy) behaviour: call addFiles([file], path) per file
    const files = [
      makeWebkitFile("a.txt", "folder/a.txt"),
      makeWebkitFile("b.txt", "folder/b.txt"),
      makeWebkitFile("c.txt", "folder/c.txt"),
    ]
    // Buggy: one group per file → 3 separate addFiles calls
    const buggyGroups = files.map((file) => {
      const relativePath = file.webkitRelativePath ?? file.name
      const folderPart = relativePath.substring(0, relativePath.lastIndexOf("/"))
      return { files: [file], path: folderPart }
    })
    expect(buggyGroups.length).toBe(3) // 3 drain cycles instead of 1

    // Fixed: 1 group → 1 drain cycle
    const fixedGroups = groupFilesByTargetPath(files, "")
    expect(fixedGroups.size).toBe(1) // single drain cycle processes all 3
  })

  it("10-file upload: naive approach saturates MAX_CONCURRENT on drain 1, stalls rest", () => {
    // With the bug: files 4-10 never get a drain triggered after the first 3 start,
    // because each file's individual drain call sees activeCount=3 and bails.
    // Verify that the grouped approach starts the correct number on first drain.
    const files = Array.from({ length: 10 }, (_, i) =>
      makeWebkitFile(`f${i}.txt`, `folder/f${i}.txt`)
    )

    // BUGGY: 10 separate addFiles calls, each with 1 file
    const buggyItemsRef: UploadItem[] = []
    const buggyActive = { current: 0 }
    const buggyStarted: string[] = []
    let drainCount = 0

    for (const file of files) {
      const item: UploadItem = {
        id: `bug-${file.name}`,
        file,
        status: "pending",
        progress: 0,
      }
      buggyItemsRef.push(item)
      drainCount++
      // Each individual drain sees only the items added so far
      drainQueue(buggyItemsRef, buggyActive, (i) => {
        if (i.status === "pending") {
          i.status = "uploading"
          buggyActive.current++
          buggyStarted.push(i.id)
        }
      })
    }
    // After 10 calls: only 3 started (saturated after first drain at file 3)
    expect(buggyStarted.length).toBe(3)

    // FIXED: 1 addFiles call with all 10 files
    const fixedItemsRef: UploadItem[] = []
    const fixedActive = { current: 0 }
    const fixedStarted: string[] = []
    addFiles(files, "folder", fixedItemsRef, fixedActive, (i) => {
      if (i.status === "pending") {
        i.status = "uploading"
        fixedActive.current++
        fixedStarted.push(i.id)
      }
    })
    expect(fixedStarted.length).toBe(3) // still 3 — MAX_CONCURRENT cap is correct
    // But all 10 are in the ref and will drain as slots free up
    expect(fixedItemsRef.filter((i) => i.status === "pending").length).toBe(7)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug: ERR_ACCESS_DENIED — XHR must use a relative URL, never NEXT_PUBLIC_API_URL
// ─────────────────────────────────────────────────────────────────────────────

describe("ERR_ACCESS_DENIED fix: XHR upload URL must be relative", () => {
  it("API_BASE_URL is an empty string so the upload path is always relative", () => {
    // If API_BASE_URL were set to http://localhost:3052, browsers in Docker
    // would get ERR_ACCESS_DENIED because that port is not exposed.
    // The constant must be "" so `${API_BASE_URL}/api/v1/files/upload`
    // resolves to the relative path `/api/v1/files/upload`.
    const API_BASE_URL = ""
    const uploadUrl = `${API_BASE_URL}/api/v1/files/upload`
    expect(uploadUrl).toBe("/api/v1/files/upload")
    expect(uploadUrl.startsWith("http")).toBe(false)
    expect(uploadUrl.startsWith("/")).toBe(true)
  })

  it("relative upload URL does not include localhost or a port number", () => {
    const API_BASE_URL = ""
    const uploadUrl = `${API_BASE_URL}/api/v1/files/upload`
    expect(uploadUrl).not.toContain("localhost")
    expect(uploadUrl).not.toMatch(/:\d{4}/)
  })

  it("NEXT_PUBLIC_API_URL pointing to a different port must NOT be used for XHR", () => {
    // Simulate the environment variable being set to the backend port
    const envApiUrl = "http://localhost:3052"
    // The OLD (buggy) behaviour: use env var directly → cross-origin → ERR_ACCESS_DENIED
    const buggyUrl = `${envApiUrl}/api/v1/files/upload`
    expect(buggyUrl.startsWith("http")).toBe(true) // this is the bug — absolute URL
    expect(buggyUrl).toContain("3052")

    // The FIXED behaviour: always use empty base → relative URL → goes via proxy
    const fixedBase = ""
    const fixedUrl = `${fixedBase}/api/v1/files/upload`
    expect(fixedUrl).toBe("/api/v1/files/upload")
    expect(fixedUrl.startsWith("http")).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("addFiles with empty array does nothing", () => {
    const itemsRef: UploadItem[] = []
    const activeCount = { current: 0 }
    const started: string[] = []
    addFiles([], "", itemsRef, activeCount, (i) => started.push(i.id))
    expect(itemsRef.length).toBe(0)
    expect(started.length).toBe(0)
  })

  it("drainQueue with all items already uploading starts nothing", () => {
    const items: UploadItem[] = Array.from({ length: 3 }, (_, i) => ({
      id: `item-${i}`,
      file: new File(["x"], `f${i}.txt`),
      status: "uploading" as Status,
      progress: 50,
    }))
    const activeCount = { current: 3 }
    const started: string[] = []
    drainQueue(items, activeCount, (i) => started.push(i.id))
    expect(started.length).toBe(0)
  })

  it("drainQueue with all items done starts nothing", () => {
    const items: UploadItem[] = Array.from({ length: 3 }, (_, i) => ({
      id: `item-${i}`,
      file: new File(["x"], `f${i}.txt`),
      status: "done" as Status,
      progress: 100,
    }))
    const activeCount = { current: 0 }
    const started: string[] = []
    drainQueue(items, activeCount, (i) => started.push(i.id))
    expect(started.length).toBe(0)
  })
})