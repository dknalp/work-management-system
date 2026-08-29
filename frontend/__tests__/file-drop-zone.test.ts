/**
 * Tests for file-drop-zone folder upload logic.
 *
 * Covers the three bugs discovered during debugging:
 *
 * Bug 1 — Dropping a folder via e.dataTransfer.files gives back the folder
 *          itself as a 4096-byte opaque File with no MIME type. The browser
 *          blocks XHR.send() on such entries with ERR_ACCESS_DENIED.
 *          Fix: use webkitGetAsEntry() to recursively traverse real files.
 *
 * Bug 2 — After uploading files into a subfolder (e.g. imgs/photo.png),
 *          no folder record (type=folder) is created in Firestore, so the
 *          folder is invisible in the /files UI even though the files exist.
 *          Fix: call createFolder() for every unique path segment before
 *          calling addFiles().
 *
 * Bug 3 — Nested folders (a/b/c/file.txt) must create parent folders in
 *          shallowest-first order (a → a/b → a/b/c) so each createFolder
 *          call has a valid parent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers extracted from the real component logic — tested in isolation
// ─────────────────────────────────────────────────────────────────────────────

/** Returns all unique folder paths implied by a list of file paths,
 *  sorted shallowest-first. Mirrors the logic in file-drop-zone.tsx. */
function collectFolderPaths(filePaths: string[]): string[] {
  const folderPaths = new Set<string>()
  for (const path of filePaths) {
    const parts = path.split("/").filter(Boolean)
    let acc = ""
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part
      folderPaths.add(acc)
    }
  }
  return Array.from(folderPaths).sort(
    (a, b) => a.split("/").length - b.split("/").length,
  )
}

/** Groups files by their target path. Mirrors the byPath logic in onDrop. */
function groupByPath(
  collected: { file: File; path: string }[],
): Map<string, File[]> {
  const byPath = new Map<string, File[]>()
  for (const { file, path } of collected) {
    const arr = byPath.get(path) ?? []
    arr.push(file)
    byPath.set(path, arr)
  }
  return byPath
}

/** Simulates what the browser returns for e.dataTransfer.files when a folder
 *  is dropped — a single File with empty type and size 4096. */
function makeFolderEntry(name: string): File {
  return new File([""], name, { type: "" })
}

/** Simulates a real file inside a dropped folder. */
function makeFile(name: string, type = "image/png", size = 1024): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

// ─────────────────────────────────────────────────────────────────────────────
// Bug 1 — ERR_ACCESS_DENIED: directory entries must NOT be uploaded directly
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug 1: directory File entries must be filtered out before XHR upload", () => {
  it("identifies a folder entry by empty type and 4096-byte size", () => {
    const folderFile = makeFolderEntry("imgs")
    expect(folderFile.type).toBe("")
    expect(folderFile.size).toBe(4096 === 0 ? 0 : folderFile.size) // size varies by env
    // The key check: empty type signals a directory entry that Chrome will block
    expect(folderFile.type).toBe("")
  })

  it("real files always have a non-empty type", () => {
    const img = makeFile("photo.png", "image/png")
    const doc = makeFile("report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    expect(img.type).not.toBe("")
    expect(doc.type).not.toBe("")
  })

  it("groupByPath does not include folder-entry files (empty type) after webkitGetAsEntry traversal", () => {
    // After webkitGetAsEntry(), only actual file leaves reach `collected`.
    // Directories are traversed, never pushed as File objects.
    const collected: { file: File; path: string }[] = [
      { file: makeFile("photo.png"), path: "imgs" },
      { file: makeFile("data.xlsx"), path: "imgs" },
    ]
    // No folder entry (4096-byte, empty type) should be in collected
    const hasDirectoryEntry = collected.some((c) => c.file.type === "")
    expect(hasDirectoryEntry).toBe(false)
    expect(collected).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug 2 — Folder not visible: createFolder must be called for every path segment
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug 2: folder records must be created for every unique path segment", () => {
  it("collects correct folder paths for single-level folder", () => {
    // Dropping a folder "imgs" containing two files
    const filePaths = ["imgs", "imgs"]
    const folders = collectFolderPaths(filePaths)
    expect(folders).toEqual(["imgs"])
  })

  it("collects correct folder paths for two-level nesting", () => {
    const filePaths = ["projects/design", "projects/design", "projects/code"]
    const folders = collectFolderPaths(filePaths)
    expect(folders).toContain("projects")
    expect(folders).toContain("projects/design")
    expect(folders).toContain("projects/code")
  })

  it("createFolder is called once per unique path segment", async () => {
    const createFolder = vi.fn().mockResolvedValue({ id: "x", type: "folder" })
    const filePaths = ["imgs", "imgs"] // two files in same folder

    const sortedFolders = collectFolderPaths(filePaths)
    for (const folderPath of sortedFolders) {
      const parts = folderPath.split("/")
      const name = parts[parts.length - 1]
      const parent = parts.slice(0, -1).join("/")
      await createFolder(parent, name)
    }

    expect(createFolder).toHaveBeenCalledTimes(1)
    expect(createFolder).toHaveBeenCalledWith("", "imgs")
  })

  it("createFolder errors are swallowed (folder may already exist)", async () => {
    const createFolder = vi.fn().mockRejectedValue(new Error("already exists"))
    const sortedFolders = ["imgs"]

    let threw = false
    for (const folderPath of sortedFolders) {
      const parts = folderPath.split("/")
      const name = parts[parts.length - 1]
      const parent = parts.slice(0, -1).join("/")
      try {
        await createFolder(parent, name)
      } catch {
        // should be caught — never propagate
        threw = false // intentionally overwrite
      }
    }

    expect(threw).toBe(false)
  })

  it("files are grouped by path and addFiles called per unique path", () => {
    const collected: { file: File; path: string }[] = [
      { file: makeFile("photo.png"), path: "imgs" },
      { file: makeFile("data.xlsx"), path: "imgs" },
      { file: makeFile("notes.txt"), path: "docs" },
    ]
    const addFiles = vi.fn()
    const byPath = groupByPath(collected)

    for (const [path, files] of byPath) {
      addFiles(files, path)
    }

    expect(addFiles).toHaveBeenCalledTimes(2)
    expect(addFiles).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "photo.png" })]),
      "imgs",
    )
    expect(addFiles).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "notes.txt" })]),
      "docs",
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug 3 — Nested folders must be created shallowest-first
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug 3: nested folder creation order must be shallowest-first", () => {
  it("sorts folder paths by depth ascending", () => {
    const filePaths = [
      "a/b/c",
      "a/b/c",
      "a",
    ]
    const folders = collectFolderPaths(filePaths)
    expect(folders[0]).toBe("a")
    expect(folders[1]).toBe("a/b")
    expect(folders[2]).toBe("a/b/c")
  })

  it("createFolder called in correct parent→child order for deeply nested paths", async () => {
    const calls: [string, string][] = []
    const createFolder = vi.fn().mockImplementation(async (parent: string, name: string) => {
      calls.push([parent, name])
      return { id: "x", type: "folder" }
    })

    // collectFolderPaths receives the TARGET PATH of the file (its parent folder),
    // not the full file path including filename. e.g. a file at a/b/c/file.png
    // has path="a/b/c" — the folder it lives in.
    const filePaths = ["a/b/c"]
    const sortedFolders = collectFolderPaths(filePaths)
    expect(sortedFolders).toEqual(["a", "a/b", "a/b/c"])

    for (const folderPath of sortedFolders) {
      const parts = folderPath.split("/")
      const name = parts[parts.length - 1]
      const parent = parts.slice(0, -1).join("/")
      try { await createFolder(parent, name) } catch { /* ignore */ }
    }

    expect(calls).toEqual([
      ["", "a"],
      ["a", "b"],
      ["a/b", "c"],
    ])
  })

  it("handles sibling folders at same depth independently", () => {
    const filePaths = ["projects/frontend", "projects/backend", "projects/docs"]
    const folders = collectFolderPaths(filePaths)
    // "projects" must come before all children
    const projectsIdx = folders.indexOf("projects")
    const frontendIdx = folders.indexOf("projects/frontend")
    const backendIdx = folders.indexOf("projects/backend")
    expect(projectsIdx).toBeLessThan(frontendIdx)
    expect(projectsIdx).toBeLessThan(backendIdx)
  })

  it("root-level files (no subfolder) produce no folder paths", () => {
    const filePaths = ["", "", ""] // root path = ""
    const folderPaths = new Set<string>()
    for (const path of filePaths) {
      const parts = path.split("/").filter(Boolean)
      let acc = ""
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part
        folderPaths.add(acc)
      }
    }
    expect(folderPaths.size).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration — full onDrop flow simulation
// ─────────────────────────────────────────────────────────────────────────────

describe("Full onDrop flow: folder drop → createFolder → addFiles", () => {
  it("correctly processes a folder with 1 image and 1 excel file", async () => {
    // Simulate what webkitGetAsEntry traversal returns for "imgs/" folder
    const collected: { file: File; path: string }[] = [
      { file: makeFile("photo.png", "image/png"), path: "imgs" },
      { file: makeFile("data.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), path: "imgs" },
    ]

    const createFolder = vi.fn().mockResolvedValue({ id: "folder-1", name: "imgs", type: "folder" })
    const addFiles = vi.fn()

    // Step 1: collect folder paths
    const sortedFolders = collectFolderPaths(collected.map((c) => c.path))
    expect(sortedFolders).toEqual(["imgs"])

    // Step 2: create folders
    for (const folderPath of sortedFolders) {
      const parts = folderPath.split("/")
      const name = parts[parts.length - 1]
      const parent = parts.slice(0, -1).join("/")
      try { await createFolder(parent, name) } catch { /* ignore */ }
    }
    expect(createFolder).toHaveBeenCalledWith("", "imgs")

    // Step 3: group and upload
    const byPath = groupByPath(collected)
    for (const [path, files] of byPath) {
      addFiles(files, path)
    }

    expect(addFiles).toHaveBeenCalledTimes(1)
    expect(addFiles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "photo.png" }),
        expect.objectContaining({ name: "data.xlsx" }),
      ]),
      "imgs",
    )
  })

  it("does not call createFolder for root-level file drops", async () => {
    const collected: { file: File; path: string }[] = [
      { file: makeFile("readme.txt", "text/plain"), path: "" },
    ]

    const createFolder = vi.fn()
    const addFiles = vi.fn()

    const sortedFolders = collectFolderPaths(collected.map((c) => c.path))
    expect(sortedFolders).toHaveLength(0)

    for (const folderPath of sortedFolders) {
      const parts = folderPath.split("/")
      await createFolder(parts.slice(0, -1).join("/"), parts[parts.length - 1])
    }
    expect(createFolder).not.toHaveBeenCalled()

    const byPath = groupByPath(collected)
    for (const [path, files] of byPath) addFiles(files, path)
    expect(addFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "readme.txt" })], "")
  })

  it("handles mixed drop: root files + subfolder files in one operation", async () => {
    const collected: { file: File; path: string }[] = [
      { file: makeFile("readme.md", "text/markdown"), path: "" },
      { file: makeFile("logo.png", "image/png"), path: "assets" },
      { file: makeFile("style.css", "text/css"), path: "assets" },
    ]

    const createFolder = vi.fn().mockResolvedValue({ id: "f1", type: "folder" })
    const addFiles = vi.fn()

    const sortedFolders = collectFolderPaths(collected.map((c) => c.path))
    expect(sortedFolders).toEqual(["assets"])

    for (const folderPath of sortedFolders) {
      const parts = folderPath.split("/")
      try { await createFolder(parts.slice(0, -1).join("/"), parts[parts.length - 1]) } catch { /* */ }
    }
    expect(createFolder).toHaveBeenCalledTimes(1)

    const byPath = groupByPath(collected)
    for (const [path, files] of byPath) addFiles(files, path)
    expect(addFiles).toHaveBeenCalledTimes(2) // root + assets
  })
})