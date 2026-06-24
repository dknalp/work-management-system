"use client"

import React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TriangleAlertIcon } from "lucide-react"

interface DeleteMemberDialogProps {
  open: boolean
  memberName?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DeleteMemberDialog({
  open,
  memberName,
  onOpenChange,
  onConfirm,
}: DeleteMemberDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <TriangleAlertIcon className="size-5 text-destructive" />
            </div>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {memberName ? (
              <>
                Are you sure you want to remove{" "}
                <span className="font-semibold text-foreground">
                  {memberName}
                </span>{" "}
                from the team? This action cannot be undone.
              </>
            ) : (
              "Are you sure you want to remove this member? This action cannot be undone."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
          >
            Remove Member
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
