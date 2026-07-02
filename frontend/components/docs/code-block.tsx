"use client"

import { useState } from "react"
import { CopyIcon, CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  code: string
  language?: string
  className?: string
}

export function CodeBlock({ code, language = "bash", className }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("relative rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden", className)}>
      {language && (
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-1.5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {copied ? <CheckIcon className="size-3.5 text-green-400" /> : <CopyIcon className="size-3.5" />}
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm text-zinc-100 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}
