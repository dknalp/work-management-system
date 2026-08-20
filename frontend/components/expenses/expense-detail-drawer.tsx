"use client";

import {
  Calendar,
  Tag,
  Repeat,
  CalendarDays,
  Hash,
  FileText,
  Pencil,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import {
  type Expense,
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

interface Props {
  expense: Expense | null;
  open: boolean;
  onClose: () => void;
  onEdit: (e: Expense) => void;
}

export function ExpenseDetailDrawer({ expense, open, onClose, onEdit }: Props) {
  if (!expense) return null;

  const freq = freqConfig[expense.frequency];
  const FreqIcon = freq.icon;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-lg mx-auto">
        <DrawerHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <DrawerTitle className="text-base leading-snug">
              {expense.title}
            </DrawerTitle>
            <Badge variant="outline" className={cn("shrink-0 text-xs font-normal", freq.class)}>
              <FreqIcon className="size-3 mr-1" />
              {freq.label}
            </Badge>
          </div>
          {expense.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {expense.description}
            </p>
          )}
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-4">
          {/* Amount block */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Tutar</p>
              <p className="text-2xl font-semibold tracking-tight">
                {formatCurrency(expense.amount)}
              </p>
            </div>
            {expense.frequency !== "one-time" && (
              <div className="text-right text-xs text-muted-foreground">
                {expense.frequency === "monthly" && (
                  <span>
                    Yıllık projeksiyon:{" "}
                    <span className="text-foreground font-medium">
                      {formatCurrency(yearlyAmount(expense))}
                    </span>
                  </span>
                )}
                {expense.frequency === "yearly" && (
                  <span>
                    Aylık maliyet:{" "}
                    <span className="text-foreground font-medium">
                      ≈ {formatCurrency(monthlyAmount(expense))}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Meta rows */}
          <div className="space-y-2.5">
            <Row icon={Tag} label="Kategori" value={expense.category} />
            <Row
              icon={Calendar}
              label="Oluşturulma"
              value={new Date(expense.createdAt).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
            {expense.nextBillingDate && (
              <Row
                icon={CalendarDays}
                label="Sonraki Ödeme"
                value={new Date(expense.nextBillingDate).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            )}
          </div>

          {expense.notes && (
            <>
              <Separator />
              <div className="flex gap-2 text-sm">
                <FileText className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-muted-foreground">{expense.notes}</p>
              </div>
            </>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2 pt-2">
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Kapat
            </Button>
          </DrawerClose>
          <Button
            className="flex-1 gap-1.5"
            onClick={() => { onClose(); onEdit(expense); }}
          >
            <Pencil className="size-4" />
            Düzenle
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}