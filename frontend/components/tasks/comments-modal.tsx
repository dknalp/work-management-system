"use client"

import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Comment, Reply } from "@/types/task"
import { useAuth } from "@/contexts/auth-context"

interface CommentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskTitle: string
  comments: Comment[]
  onCommentsChange: (comments: Comment[]) => void
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function CommentsModal({
  open,
  onOpenChange,
  taskTitle,
  comments,
  onCommentsChange,
}: CommentsModalProps) {
  const { user } = useAuth()
  const [commentInput, setCommentInput] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyInput, setReplyInput] = useState("")

  function submitComment() {
    if (!commentInput.trim()) return
    onCommentsChange([
      ...comments,
      {
        id: crypto.randomUUID(),
        author_id: user?.id ?? "",
        author_name: user?.name ?? "You",
        body: commentInput.trim(),
        created_at: new Date().toISOString(),
        replies: [],
      },
    ])
    setCommentInput("")
  }

  function submitReply(commentId: string) {
    if (!replyInput.trim()) return
    const updated = comments.map((c) => {
      if (c.id !== commentId) return c
      const newReply: Reply = {
        id: crypto.randomUUID(),
        author_id: user?.id ?? "",
        author_name: user?.name ?? "You",
        body: replyInput.trim(),
        created_at: new Date().toISOString(),
      }
      return { ...c, replies: [...(c.replies ?? []), newReply] }
    })
    onCommentsChange(updated)
    setReplyInput("")
    setReplyingTo(null)
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitComment()
    }
  }

  function handleReplyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (replyingTo) submitReply(replyingTo)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[80vh] w-full max-w-[600px] p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col">
            <DialogTitle className="text-base font-semibold">Comments</DialogTitle>
            {taskTitle && (
              <span className="text-xs text-muted-foreground">{taskTitle}</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Henüz yorum yok.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="size-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {getInitials(c.author_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{c.author_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5">{c.body}</p>
                  <button
                    onClick={() => setReplyingTo(c.id === replyingTo ? null : c.id)}
                    className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Yanıtla
                  </button>
                  {replyingTo === c.id && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        onKeyDown={handleReplyKeyDown}
                        placeholder="Yanıt yaz…"
                        className="h-7 text-sm"
                      />
                      <Button size="sm" onClick={() => submitReply(c.id)} className="h-7">
                        Yanıtla
                      </Button>
                    </div>
                  )}
                  {(c.replies?.length ?? 0) > 0 && (
                    <div className="mt-2 space-y-2 pl-2 border-l border-border">
                      {(c.replies ?? []).map((r) => (
                        <div key={r.id} className="flex gap-3">
                          <div className="size-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {getInitials(r.author_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium">{r.author_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(r.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <p className="text-sm mt-0.5">{r.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t px-4 py-3 flex gap-2 shrink-0">
          <Input
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={handleCommentKeyDown}
            placeholder="Yorum ekle…"
            className="flex-1"
          />
          <Button onClick={submitComment}>Ekle</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}