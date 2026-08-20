"use client";

import { useState } from "react";
import { Repeat, CalendarDays, Hash } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Expense,
  type ExpenseCategory,
  type ExpenseFrequency,
  formatCurrency,
  monthlyAmount,
  yearlyAmount,
} from "./expense-mock-data";
import { cn } from "@/lib/utils";

const freqConfig = {
  monthly: { label: "Aylık", icon: Repeat, class: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  yearly: { label: "Yıllık", icon: CalendarDays, class: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
  "one-time": { label: "Tek Seferlik", icon: Hash, class: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
};

const CATEGORIES: ExpenseCategory[] = [
  "Personel", "Teknoloji", "Pazarlama", "Ofis", "Seyahat", "Diğer",
];

interface Props {
  expense: Expense | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: Partial<Expense>) => void;
}

// Inner component gets a stable `expense` — re-mounts on id change via key
function DrawerInner({
  expense,
  onClose,
  onSave,
}: {
  expense: Expense;
  onClose: () => void;
  onSave: (id: string, data: Partial<Expense>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(expense.title);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(String(expense.amount));
  const [frequency, setFrequency] = useState<ExpenseFrequency>(expense.frequency);
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [notes, setNotes] = useState(expense.notes ?? "");
  const [nextBillingDate, setNextBillingDate] = useState(expense.nextBillingDate ?? "");

  const currentFreq = freqConfig[editing ? frequency : expense.frequency];
  const FreqIcon = currentFreq.icon;

  function handleSave() {
    onSave(expense.id, {
      title,
      description,
      amount: Number(amount),
      frequency,
      category,
      notes: notes || undefined,
      nextBillingDate: nextBillingDate || undefined,
    });
    setEditing(false);
    onClose();
  }

  return (
    <>
      <DrawerHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-semibold h-auto py-1 px-2 -ml-2"
            />
          ) : (
            <DrawerTitle className="text-base">{expense.title}</DrawerTitle>
          )}
          <Badge
            variant="outline"
            className={cn("shrink-0 text-xs font-normal", currentFreq.class)}
          >
            <FreqIcon className="size-3 mr-1" />
            {currentFreq.label}
          </Badge>
        </div>
        {editing ? (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama…"
            rows={2}
            className="mt-1.5 resize-none text-xs"
          />
        ) : expense.description ? (
          <p className="text-xs text-muted-foreground mt-1">{expense.description}</p>
        ) : null}
      </DrawerHeader>

      <div className="px-4 pb-3 space-y-4">
        {/* Amount block */}
        <div className="rounded-lg bg-muted/40 px-4 py-3">
          {editing ? (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Tutar (₺)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Periyot</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as ExpenseFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Aylık</SelectItem>
                    <SelectItem value="yearly">Yıllık</SelectItem>
                    <SelectItem value="one-time">Tek Seferlik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Tutar</p>
                <p className="text-2xl font-semibold tracking-tight">
                  {formatCurrency(expense.amount)}
                </p>
              </div>
              {expense.frequency !== "one-time" && (
                <p className="text-xs text-muted-foreground">
                  {expense.frequency === "monthly"
                    ? `${formatCurrency(yearlyAmount(expense))}/yıl`
                    : `≈ ${formatCurrency(monthlyAmount(expense))}/ay`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Category + dates */}
        {editing ? (
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Kategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {frequency !== "one-time" && (
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Sonraki Ödeme</Label>
                <Input
                  type="date"
                  value={nextBillingDate}
                  onChange={(e) => setNextBillingDate(e.target.value)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Kategori</p>
              <p className="font-medium">{expense.category}</p>
            </div>
            {expense.nextBillingDate && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Sonraki Ödeme</p>
                <p className="font-medium">
                  {new Date(expense.nextBillingDate).toLocaleDateString("tr-TR", {
                    day: "numeric", month: "long",
                  })}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Eklenme</p>
              <p className="font-medium">
                {new Date(expense.createdAt).toLocaleDateString("tr-TR", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        {editing ? (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Not</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ek bilgi…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        ) : expense.notes ? (
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            {expense.notes}
          </p>
        ) : null}
      </div>

      <DrawerFooter className="flex-row gap-2 pt-0">
        {editing ? (
          <>
            <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              Kaydet
            </Button>
          </>
        ) : (
          <>
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Kapat
              </Button>
            </DrawerClose>
            <Button className="flex-1" onClick={() => setEditing(true)}>
              Düzenle
            </Button>
          </>
        )}
      </DrawerFooter>
    </>
  );
}

export function ExpenseDetailDrawer({ expense, open, onClose, onSave }: Props) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-lg mx-auto">
        {expense && (
          <DrawerInner
            key={expense.id}
            expense={expense}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}