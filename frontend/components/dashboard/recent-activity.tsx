"use client"

import { useMemo } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import {
  CheckCircle2,
  PlusCircle,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
  Pencil,
} from "lucide-react"
import { useTasks, ActivityType } from "@/contexts/task-context"
import { cn } from "@/lib/utils"

const ACTIVITY_META: Record<
  ActivityType,
  { label: (title: string, detail?: string) => string; icon: React.ElementType; color: string }
> = {
  task_created: {
    label: (t) => `"${t}" oluşturuldu`,
    icon: PlusCircle,
    color: "text-blue-500",
  },
  task_completed: {
    label: (t) => `"${t}" tamamlandı`,
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
  task_reopened: {
    label: (t) => `"${t}" yeniden açıldı`,
    icon: RefreshCw,
    color: "text-amber-500",
  },
  task_status_changed: {
    label: (t, d) => `"${t}" taşındı${d ? ` (${d})` : ""}`,
    icon: ArrowRightLeft,
    color: "text-violet-500",
  },
  task_deleted: {
    label: (t) => `"${t}" silindi`,
    icon: Trash2,
    color: "text-rose-500",
  },
  task_updated: {
    label: (t) => `"${t}" güncellendi`,
    icon: Pencil,
    color: "text-muted-foreground",
  },
}

export function RecentActivity() {
  const { activity } = useTasks()

  const visible = useMemo(() => activity.slice(0, 8), [activity])

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Son Etkinlik</h3>
        <p className="text-sm text-muted-foreground text-center py-6">
          Henüz etkinlik yok. Görev eklemeye veya güncellemeye başlayın.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">Son Etkinlik</h3>
      <div className="flex flex-col divide-y divide-border">
        {visible.map((entry) => {
          const meta = ACTIVITY_META[entry.type]
          const Icon = meta.icon
          return (
            <div key={entry.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className={cn("mt-0.5 shrink-0", meta.color)}>
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug truncate">
                  {meta.label(entry.taskTitle, entry.detail)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(parseISO(entry.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}