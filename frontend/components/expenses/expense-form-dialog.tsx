"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
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
import type {
  Expense,
  ExpenseCategory,
  ExpenseFrequency,
} from "./expense-mock-data";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, "id" | "createdAt">) => void;
  initial?: Expense | null;
}

const CATEGORIES: ExpenseCategory[] = [
  "Personel",
  "Teknoloji",
  "Pazarlama",
  "Ofis",
  "Seyahat",
  "Diğer",
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

export function ExpenseFormDialog({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          category: initial.category,
          amount: String(initial.amount),
          frequency: initial.frequency,
          notes: initial.notes ?? "",
          nextBillingDate: initial.nextBillingDate ?? "",
        }
      : empty
  );

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

  const isEditing = !!initial;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="size-4" />
            {isEditing ? "Gideri Düzenle" : "Yeni Gider Ekle"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Field label="Başlık *">
            <Input
              placeholder="Gider başlığı"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>

          <Field label="Açıklama">
            <Textarea
              placeholder="Kısa açıklama"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tutar (₺) *">
              <Input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>

            <Field label="Periyot">
              <Select value={form.frequency} onValueChange={(v) => set("frequency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Aylık</SelectItem>
                  <SelectItem value="yearly">Yıllık</SelectItem>
                  <SelectItem value="one-time">Tek Seferlik</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Kategori">
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {(form.frequency === "monthly" || form.frequency === "yearly") && (
            <Field label="Sonraki Ödeme Tarihi">
              <Input
                type="date"
                value={form.nextBillingDate}
                onChange={(e) => set("nextBillingDate", e.target.value)}
              />
            </Field>
          )}

          <Field label="Not">
            <Textarea
              placeholder="Ek bilgi…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="resize-none"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={!form.title.trim() || !form.amount}>
            {isEditing ? "Kaydet" : "Ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}