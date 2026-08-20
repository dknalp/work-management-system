"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  type Expense,
  type BudgetItem,
  formatCurrency,
  monthlyAmount,
  yearlyAmount,
} from "./expense-mock-data";

interface Props {
  expenses: Expense[];
  budgets: BudgetItem[];
}

export function ExpenseKpiCards({ expenses, budgets }: Props) {
  const stats = useMemo(() => {
    const totalMonthly = expenses.reduce((s, e) => s + monthlyAmount(e), 0);
    const totalYearly = expenses.reduce((s, e) => s + yearlyAmount(e), 0);
    const totalBudget = budgets.reduce((s, b) => s + b.budget, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
    const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    return { totalMonthly, totalYearly, budgetPct };
  }, [expenses, budgets]);

  return (
    <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card overflow-hidden">
      <Stat label="aylık" value={formatCurrency(stats.totalMonthly)} />
      <Stat label="yıllık" value={formatCurrency(stats.totalYearly)} />
      <Stat
        label="bütçe"
        value={`%${stats.budgetPct.toFixed(0)}`}
        accent={
          stats.budgetPct > 90
            ? "text-red-500"
            : stats.budgetPct > 75
              ? "text-amber-500"
              : undefined
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-6 py-4">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", accent)}>
        {value}
      </span>
    </div>
  );
}