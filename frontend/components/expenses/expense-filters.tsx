"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExpenseCategory, ExpenseFrequency } from "./expense-mock-data";

export interface ExpenseFilters {
  search: string;
  category: ExpenseCategory | "all";
  frequency: ExpenseFrequency | "all";
}

interface Props {
  filters: ExpenseFilters;
  onChange: (f: ExpenseFilters) => void;
}

const CATEGORIES: Array<ExpenseCategory | "all"> = [
  "all",
  "Personel",
  "Teknoloji",
  "Pazarlama",
  "Ofis",
  "Seyahat",
  "Diğer",
];

export function ExpenseFilterBar({ filters, onChange }: Props) {
  const hasActiveFilters =
    filters.search || filters.category !== "all" || filters.frequency !== "all";

  function reset() {
    onChange({ search: "", category: "all", frequency: "all" });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Gider ara…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8 h-9 text-sm"
        />
      </div>

      <Select
        value={filters.category}
        onValueChange={(v) =>
          onChange({ ...filters, category: v as ExpenseCategory | "all" })
        }
      >
        <SelectTrigger className="h-9 text-sm w-[140px]">
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c === "all" ? "Tüm Kategoriler" : c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.frequency}
        onValueChange={(v) =>
          onChange({ ...filters, frequency: v as ExpenseFrequency | "all" })
        }
      >
        <SelectTrigger className="h-9 text-sm w-[140px]">
          <SelectValue placeholder="Periyot" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Periyotlar</SelectItem>
          <SelectItem value="monthly">Aylık</SelectItem>
          <SelectItem value="yearly">Yıllık</SelectItem>
          <SelectItem value="one-time">Tek Seferlik</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9 gap-1.5">
          <X className="size-3.5" />
          Temizle
        </Button>
      )}
    </div>
  );
}