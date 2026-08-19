"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useTheme } from "next-themes"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import hljs from "highlight.js"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileIcon,
  Music2Icon,
  ExternalLinkIcon,
  MaximizeIcon,
  AlertCircleIcon,
  XIcon,
} from "lucide-react"
import { getPreviewUrl } from "@/lib/actions/files"
import type { FileItem } from "./file-utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PreviewType =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "office"
  | "markdown"
  | "code"
  | "csv"
  | "unsupported"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPreviewType(file: FileItem): PreviewType {
  const mime = file.mimeType || ""
  const ext = (file.name.split(".").pop() || "").toLowerCase()

  if (mime.startsWith("image/")) return "image"
  if (mime === "application/pdf" || ext === "pdf") return "pdf"
  if (
    mime.startsWith("video/") ||
    ["mp4", "webm", "mov", "mkv", "avi"].includes(ext)
  )
    return "video"
  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)
  )
    return "audio"
  if (["docx", "doc", "xlsx", "xls", "pptx", "ppt"].includes(ext))
    return "office"
  if (["md", "mdx"].includes(ext)) return "markdown"
  if (["csv", "tsv"].includes(ext)) return "csv"
  if (
    [
      "js", "ts", "tsx", "jsx", "py", "json", "yaml", "yml", "toml",
      "css", "html", "sh", "sql", "rs", "go", "rb", "php", "c", "cpp",
      "h", "java", "kt", "swift", "vue", "svelte", "xml", "env",
    ].includes(ext)
  )
    return "code"
  return "unsupported"
}

const CODE_LANG_MAP: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  py: "python",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  css: "css",
  html: "html",
  sh: "bash",
  sql: "sql",
  rs: "rust",
  go: "go",
  toml: "toml",
  md: "markdown",
  rb: "ruby",
  php: "php",
  c: "c",
  cpp: "cpp",
  h: "c",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  vue: "vue",
  svelte: "svelte",
  xml: "xml",
  env: "bash",
}

async function fetchText(url: string, maxBytes = 1_000_000): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("fetch failed")
  const size = parseInt(res.headers.get("content-length") || "0", 10)
  if (size > maxBytes) throw new Error("too large")
  const text = await res.text()
  if (text.length > maxBytes) throw new Error("too large")
  return text
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

function ImagePreview({ url, name }: { url: string; name: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="flex items-center justify-center w-full">
      {!loaded && <Skeleton className="w-full h-64 rounded-md" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name}
        className={`max-w-full max-h-[70vh] object-contain transition-opacity ${
          loaded ? "opacity-100" : "opacity-0 absolute"
        }`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

function PdfPreview({ url, name }: { url: string; name: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative w-full h-[70vh]">
      {!loaded && <Skeleton className="absolute inset-0 rounded-md" />}
      <iframe
        src={url}
        className="w-full h-full border-0"
        title={name}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

function VideoPreview({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen()
    }
  }

  return (
    <div className="relative w-full">
      <video
        ref={videoRef}
        src={url}
        controls
        className="w-full max-h-[70vh] bg-black"
        preload="metadata"
      >
        Tarayıcınız video oynatmayı desteklemiyor.
      </video>
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7"
        onClick={handleFullscreen}
        title="Tam ekran"
      >
        <MaximizeIcon className="w-4 h-4" />
      </Button>
    </div>
  )
}

function AudioPreview({ url, name }: { url: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
        <Music2Icon className="w-10 h-10 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">{name}</p>
      <audio src={url} controls className="w-full" preload="metadata" />
    </div>
  )
}

function OfficePreview({ url, name }: { url: string; name: string }) {
  const [loading, setLoading] = useState(true)
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`

  return (
    <div className="relative w-full h-[70vh]">
      {loading && <Skeleton className="absolute inset-0 rounded-md" />}
      <iframe
        src={viewerUrl}
        className="w-full h-full rounded-md border-0"
        onLoad={() => setLoading(false)}
        title={name}
      />
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2"
        onClick={() => window.open(viewerUrl, "_blank")}
      >
        <ExternalLinkIcon className="w-4 h-4 mr-1" /> Ayrı sekmede aç
      </Button>
    </div>
  )
}

function MarkdownPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!cancelled) { setLoading(true); setError(false) }
      try {
        const text = await fetchText(url)
        if (!cancelled) {
          setContent(text)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [url])

  if (loading) return <Skeleton className="w-full h-64 rounded-md" />
  if (error || content === null)
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
        <AlertCircleIcon className="w-4 h-4" />
        Önizleme yüklenemedi.
      </div>
    )

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none p-6 overflow-auto max-h-[70vh]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

function CodePreview({ url, fileName }: { url: string; fileName: string }) {
  const { resolvedTheme } = useTheme()
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const ext = (fileName.split(".").pop() || "").toLowerCase()
    const lang = CODE_LANG_MAP[ext] || "text"
    const isDark = resolvedTheme === "dark"

    async function load() {
      if (!cancelled) { setLoading(true); setError(false) }
      try {
        const text = await fetchText(url)
        const highlighted = lang !== "text" && hljs.getLanguage(lang)
          ? hljs.highlight(text, { language: lang }).value
          : hljs.highlightAuto(text).value
        const result = `<pre class="hljs ${isDark ? "hljs-dark" : "hljs-light"}"><code>${highlighted}</code></pre>`
        if (!cancelled) {
          setHtml(result)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [url, fileName, resolvedTheme])

  if (loading) return <Skeleton className="w-full h-64 rounded-md" />
  if (error || html === null)
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
        <AlertCircleIcon className="w-4 h-4" />
        Önizleme yüklenemedi.
      </div>
    )

  return (
    <div
      className="overflow-auto max-h-[70vh] text-sm [&>pre]:!m-0 [&>pre]:p-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function CsvPreview({ url, fileName }: { url: string; fileName: string }) {
  const [rows, setRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const MAX_ROWS = 500
  const isTab = fileName.endsWith(".tsv")

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!cancelled) { setLoading(true); setError(false) }
      try {
        const text = await fetchText(url, 5_000_000)
        const result = Papa.parse<string[]>(text, {
          delimiter: isTab ? "\t" : ",",
          skipEmptyLines: true,
        })
        const all = result.data as string[][]
        if (!cancelled) {
          if (all.length === 0) {
            setRows([])
            setHeaders([])
            setTotal(0)
          } else {
            const [head, ...body] = all
            setHeaders(head)
            setTotal(body.length)
            setRows(body.slice(0, MAX_ROWS))
          }
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [url, isTab])

  if (loading) return <Skeleton className="w-full h-64 rounded-md" />
  if (error)
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
        <AlertCircleIcon className="w-4 h-4" />
        Önizleme yüklenemedi.
      </div>
    )

  return (
    <div className="overflow-auto max-h-[70vh]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/60 sticky top-0">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left px-3 py-2 font-medium border-b border-border whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              {headers.map((_, ci) => (
                <td key={ci} className="px-3 py-1.5 whitespace-nowrap">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {total > MAX_ROWS && (
        <p className="text-xs text-muted-foreground px-3 py-2 border-t bg-muted/30">
          İlk {MAX_ROWS} satır gösteriliyor — ve {total - MAX_ROWS} satır daha
        </p>
      )}
    </div>
  )
}

function UnsupportedPreview({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
      <FileIcon className="w-12 h-12" />
      <p className="text-sm">
        <span className="font-medium">{name}</span> için önizleme desteklenmiyor.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface FilePreviewPanelProps {
  file: FileItem | null
  open: boolean
  onClose: () => void
}

export function FilePreviewPanel({
  file,
  open,
  onClose,
}: FilePreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState(false)

  const fetchUrl = useCallback(async (f: FileItem) => {
    setUrlLoading(true)
    setUrlError(false)
    setPreviewUrl(null)
    try {
      const url = await getPreviewUrl(f.id)
      setPreviewUrl(url)
    } catch {
      setUrlError(true)
    } finally {
      setUrlLoading(false)
    }
  }, [])

  useEffect(() => {
    async function run() {
      if (!open || !file) {
        setPreviewUrl(null)
        setUrlError(false)
        return
      }
      await fetchUrl(file)
    }
    run()
  }, [open, file, fetchUrl])

  const previewType = file ? getPreviewType(file) : "unsupported"

  function renderContent() {
    if (!file) return null

    if (urlLoading) {
      return <Skeleton className="w-full h-64 rounded-md" />
    }

    if (urlError || !previewUrl) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
          <AlertCircleIcon className="w-4 h-4" />
          Önizleme URL&apos;si alınamadı.
        </div>
      )
    }

    switch (previewType) {
      case "image":
        return <ImagePreview url={previewUrl} name={file.name} />
      case "pdf":
        return <PdfPreview url={previewUrl} name={file.name} />
      case "video":
        return <VideoPreview url={previewUrl} />
      case "audio":
        return <AudioPreview url={previewUrl} name={file.name} />
      case "office":
        return <OfficePreview url={previewUrl} name={file.name} />
      case "markdown":
        return <MarkdownPreview url={previewUrl} />
      case "code":
        return <CodePreview url={previewUrl} fileName={file.name} />
      case "csv":
        return <CsvPreview url={previewUrl} fileName={file.name} />
      default:
        return <UnsupportedPreview name={file.name} />
    }
  }

  // Escape key closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open || !file) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: "fadeIn 0.15s ease" }}
    >
      {/* Backdrop — click outside closes */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div
        className="relative z-10 flex flex-col w-full max-w-3xl max-h-[90vh] mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        style={{ animation: "scaleIn 0.15s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {previewType !== "unsupported" ? previewType : "desteklenmiyor"}
              {file.mimeType ? ` · ${file.mimeType}` : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  )
}