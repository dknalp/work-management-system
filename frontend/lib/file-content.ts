import fs from "fs/promises"

const MAX_BYTES = 64 * 1024 // 64 KB

export async function extractText(fullPath: string, ext: string): Promise<string | null> {
  const e = ext.toLowerCase().replace(/^\./, "")

  try {
    // Plain text types — read directly
    if (["txt", "md", "json", "js", "ts", "jsx", "tsx", "css", "html", "xml", "csv", "py", "sh", "yaml", "yml", "toml", "env"].includes(e)) {
      const buf = await fs.readFile(fullPath)
      const slice = buf.slice(0, MAX_BYTES)
      return slice.toString("utf-8")
    }

    if (e === "pdf") {
      // Cap PDF reads at 32 MB to avoid OOM on large files
      const MAX_PDF_BYTES = 32 * 1024 * 1024
      const stat = await fs.stat(fullPath)
      if (stat.size > MAX_PDF_BYTES) return null
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>
      const buf = await fs.readFile(fullPath)
      const data = await pdfParse(buf)
      return data.text ?? null
    }

    if (e === "docx" || e === "doc") {
      const mammoth = await import("mammoth")
      const result = await mammoth.extractRawText({ path: fullPath })
      return result.value ?? null
    }

    if (["xlsx", "xls", "ods"].includes(e)) {
      const XLSX = await import("xlsx")
      const workbook = XLSX.readFile(fullPath, { sheetRows: 200 })
      const texts: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        texts.push(csv)
      }
      return texts.join("\n")
    }

    // Binary / media / archives — skip
    return null
  } catch {
    return null
  }
}

export function getSnippet(text: string, query: string, contextChars = 60): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return ""
  const start = Math.max(0, idx - contextChars)
  const end = Math.min(text.length, idx + query.length + contextChars)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < text.length ? "…" : ""
  return prefix + text.slice(start, end).replace(/\s+/g, " ").trim() + suffix
}