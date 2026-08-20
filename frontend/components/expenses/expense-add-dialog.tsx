"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Expense, ExpenseCategory, ExpenseFrequency } from "./expense-mock-data";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, "id" | "createdAt">) => void;
}

const CATEGORIES: ExpenseCategory[] = [
  "Personel", "Teknoloji", "Pazarlama", "Ofis", "Seyahat", "Diğer",
];

const empty = {
  title: "",
  description: "",
  category: "Teknoloji" as ExpenseCategory,
  amount: "",
  frequency: "monthly" as ExpenseFrequency,
  notes: "",
  nextBillingDate: "",
};

export function ExpenseAddDialog({ open, onClose, onSave }: Props) {
  const [form, setForm] = useState(empty);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    if (!form.title.trim() || !form.amount) return;
    onSave({
      title: form.title,
      description: form.description,
      category: form.category,
      amount: Number(form.amount),
      frequency: form.frequency,
      notes: form.notes || undefined,
      nextBillingDate: form.nextBillingDate || undefined,
    });
    setForm(empty);
    onClose();
  }

  function handleClose() {
    setForm(empty);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Yeni Gider</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div>
            <Label className="text-xs text-muted-foreground">Başlık</Label>
            <Input
              placeholder="Slack, AWS, Ofis kirası…"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Tutar (₺)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className="mt-1 tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Periyot</Label>
              <Select value={form.frequency} onValueChange={(v) => set("frequency", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Aylık</SelectItem>
                  <SelectItem value="yearly">Yıllık</SelectItem>
                  <SelectItem value="one-time">Tek Seferlik</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Kategori</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(form.frequency === "monthly" || form.frequency === "yearly") && (
            <div>
              <Label className="text-xs text-muted-foreground">Sonraki Ödeme</Label>
              <Input
                type="date"
                value={form.nextBillingDate}
                onChange={(e) => set("nextBillingDate", e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Not (opsiyonel)</Label>
            <Textarea
              placeholder="Ek bilgi…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="mt-1 resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            İptal
          </Button>
          <Button
            onClick={handleSave}
            disabled={!form.title.trim() || !form.amount}
            className="flex-1"
          >
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}