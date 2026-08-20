"use client";

import { Pencil, Trash2, Repeat, CalendarDays, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Expense, formatCurrency } from "./expense-mock-data";
import { cn } from "@/lib/utils";

const freqConfig: Record<
  Expense["frequency"],
  { label: string; icon: React.ElementType; class: string }
> = {
  monthly: {
    label: "Aylık",
    icon: Repeat,
    class: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  yearly: {
    label: "Yıllık",
    icon: CalendarDays,
    class: "text-violet-500 bg-violet-500/10 border-violet-500/20",
  },
  "one-time": {
    label: "Tek Seferlik",
    icon: Hash,
    class: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  },
};

interface Props {
  expenses: Expense[];
  onView: (e: Expense) => void;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpenseTable({ expenses, onView, onEdit, onDelete }: Props) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card flex items-center justify-center h-36 text-sm text-muted-foreground">
        Eşleşen gider bulunamadı.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="text-xs font-medium text-muted-foreground">
              Gider
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground w-32">
              Periyot
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground w-32 text-right">
              Tutar
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => {
            const freq = freqConfig[expense.frequency];
            const FreqIcon = freq.icon;

            return (
              <TableRow
                key={expense.id}
                className="cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => onView(expense)}
              >
                <TableCell className="py-3 font-medium text-sm">
                  {expense.title}
                </TableCell>

                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("gap-1 text-xs font-normal", freq.class)}
                  >
                    <FreqIcon className="size-3" />
                    {freq.label}
                  </Badge>
                </TableCell>

                <TableCell className="text-right font-semibold text-sm tabular-nums">
                  {formatCurrency(expense.amount)}
                </TableCell>

                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7">
                        <span className="text-muted-foreground text-base leading-none">
                          ···
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem
                        onClick={() => onEdit(expense)}
                      >
                        <Pencil className="size-3.5 mr-2" />
                        Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(expense.id)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}