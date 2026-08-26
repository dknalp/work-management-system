"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { type BudgetItem, formatCurrency } from "./expense-mock-data";

interface Props {
  budgets: BudgetItem[];
}

const COLORS = {
  budget: "hsl(var(--muted))",
  ok: "#10b981",
  warn: "#f59e0b",
  over: "#ef4444",
};

function barColor(spent: number, budget: number) {
  const pct = budget > 0 ? spent / budget : 0;
  if (pct > 1) return COLORS.over;
  if (pct > 0.8) return COLORS.warn;
  return COLORS.ok;
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const spent = payload.find((p) => p.dataKey === "spent")?.value ?? 0;
  const budget = payload.find((p) => p.dataKey === "budget")?.value ?? 0;
  const pct = budget > 0 ? ((spent / budget) * 100).toFixed(1) : "0";

  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-sm shadow-md">
      <p className="font-semibold mb-1">{label}</p>
      <p className="text-muted-foreground">
        Harcama:{" "}
        <span className="text-foreground font-medium">
          {formatCurrency(spent)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Bütçe:{" "}
        <span className="text-foreground font-medium">
          {formatCurrency(budget)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Kullanım: <span className="text-foreground font-medium">%{pct}</span>
      </p>
    </div>
  );
};

export function ExpenseBudgetChart({ budgets }: Props) {
  const data = budgets.map((b) => ({
    category: b.category,
    spent: b.spent,
    budget: b.budget,
    remaining: Math.max(0, b.budget - b.spent),
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Kategoriye Göre Bütçe vs Harcama</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tüm kategorilerde planlanan bütçeye karşı gerçekleşen gider
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          barCategoryGap="30%"
          barGap={4}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v
            }
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ opacity: 0.08 }} />

          {/* Budget bar (background) */}
          <Bar dataKey="budget" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Bütçe" />

          {/* Spent bar (colored) */}
          <Bar dataKey="spent" radius={[4, 4, 0, 0]} name="Harcama">
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.spent, entry.budget)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted inline-block" />
          Bütçe
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500 inline-block" />
          Normal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-500 inline-block" />
          Uyarı ({'>'}%80)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-red-500 inline-block" />
          Aşım
        </span>
      </div>
    </div>
  );
}