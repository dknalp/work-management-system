"use client";

import { useState, useMemo } from "react";
import { PlusCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { ExpenseKpiCards } from "@/components/expenses/expense-kpi-cards";
import { ExpenseBudgetChart } from "@/components/expenses/expense-budget-chart";
import { ExpenseFilterBar, type ExpenseFilters } from "@/components/expenses/expense-filters";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ExpenseDetailDrawer } from "@/components/expenses/expense-detail-drawer";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import {
  MOCK_EXPENSES,
  MOCK_BUDGETS,
  type Expense,
} from "@/components/expenses/expense-mock-data";
import { cn } from "@/lib/utils";

const defaultFilters: ExpenseFilters = {
  search: "",
  category: "all",
  frequency: "all",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>(MOCK_EXPENSES);
  const [budgets] = useState(MOCK_BUDGETS);
  const [filters, setFilters] = useState<ExpenseFilters>(defaultFilters);
  const [chartOpen, setChartOpen] = useState(false);

  const [drawerExpense, setDrawerExpense] = useState<Expense | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (
        filters.search &&
        !e.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !e.description.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      if (filters.category !== "all" && e.category !== filters.category)
        return false;
      if (filters.frequency !== "all" && e.frequency !== filters.frequency)
        return false;
      return true;
    });
  }, [expenses, filters]);

  function handleView(expense: Expense) {
    setDrawerExpense(expense);
    setDrawerOpen(true);
  }

  function handleEdit(expense: Expense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  function handleDelete(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    toast.success("Gider silindi");
  }

  function handleSave(data: Omit<Expense, "id" | "createdAt">) {
    if (editingExpense) {
      setExpenses((prev) =>
        prev.map((e) => (e.id === editingExpense.id ? { ...e, ...data } : e))
      );
      toast.success("Gider güncellendi");
      setEditingExpense(null);
    } else {
      const newExpense: Expense = {
        id: `exp-${Date.now()}`,
        createdAt: new Date().toISOString().split("T")[0],
        ...data,
      };
      setExpenses((prev) => [newExpense, ...prev]);
      toast.success("Gider eklendi");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Gider Yönetimi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {expenses.length} gider kalemi
          </p>
        </div>
        <Button
          onClick={() => { setEditingExpense(null); setFormOpen(true); }}
          className="gap-2"
        >
          <PlusCircle className="size-4" />
          Gider Ekle
        </Button>
      </div>

      {/* KPI */}
      <ExpenseKpiCards expenses={expenses} budgets={budgets} />

      {/* Budget chart — collapsible */}
      <Collapsible open={chartOpen} onOpenChange={setChartOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
            <span>Kategoriye Göre Bütçe Durumu</span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                chartOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2">
            <ExpenseBudgetChart budgets={budgets} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filters + table */}
      <div className="flex flex-col gap-3">
        <ExpenseFilterBar filters={filters} onChange={setFilters} />
        <p className="text-xs text-muted-foreground">
          {filtered.length} gider gösteriliyor
        </p>
        <ExpenseTable
          expenses={filtered}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <ExpenseDetailDrawer
        expense={drawerExpense}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={handleEdit}
      />
      <ExpenseFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingExpense(null); }}
        onSave={handleSave}
        initial={editingExpense}
      />
    </div>
  );
}