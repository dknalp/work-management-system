export type ExpenseFrequency = "monthly" | "yearly" | "one-time";
export type ExpenseCategory =
  | "Personel"
  | "Teknoloji"
  | "Pazarlama"
  | "Ofis"
  | "Seyahat"
  | "Diğer";

export interface Expense {
  id: string;
  title: string;
  description: string;
  category: ExpenseCategory;
  amount: number; // TRY
  frequency: ExpenseFrequency;
  createdAt: string; // ISO date
  nextBillingDate?: string;
  notes?: string;
}

export interface BudgetItem {
  category: ExpenseCategory;
  budget: number;
  spent: number;
}

export const MOCK_EXPENSES: Expense[] = [
  // --- Monthly ---
  {
    id: "exp-001",
    title: "Slack Kurumsal Lisans",
    description: "15 kullanıcı için Slack Pro aboneliği",
    category: "Teknoloji",
    amount: 4500,
    frequency: "monthly",
    createdAt: "2026-01-05",
    nextBillingDate: "2026-09-05",
  },
  {
    id: "exp-002",
    title: "AWS Sunucu Maliyeti",
    description: "Production ortamı EC2 + RDS aylık fatura",
    category: "Teknoloji",
    amount: 12800,
    frequency: "monthly",
    createdAt: "2026-01-10",
    nextBillingDate: "2026-09-10",
  },
  {
    id: "exp-003",
    title: "Ofis Kirası",
    description: "Levent ofis aylık kira bedeli",
    category: "Ofis",
    amount: 45000,
    frequency: "monthly",
    createdAt: "2026-01-01",
    nextBillingDate: "2026-09-01",
  },
  {
    id: "exp-004",
    title: "Figma Organizasyon",
    description: "Tasarım ekibi Figma Organization planı",
    category: "Teknoloji",
    amount: 2100,
    frequency: "monthly",
    createdAt: "2026-02-01",
    nextBillingDate: "2026-09-01",
  },
  {
    id: "exp-005",
    title: "Google Workspace",
    description: "20 kullanıcı Google Workspace Business",
    category: "Teknoloji",
    amount: 3200,
    frequency: "monthly",
    createdAt: "2026-01-15",
    nextBillingDate: "2026-09-15",
  },
  {
    id: "exp-006",
    title: "LinkedIn Ads Bütçesi",
    description: "Aylık LinkedIn işe alım ilanları",
    category: "Pazarlama",
    amount: 8500,
    frequency: "monthly",
    createdAt: "2026-03-01",
    nextBillingDate: "2026-09-01",
  },
  // --- Yearly ---
  {
    id: "exp-007",
    title: "GitHub Enterprise",
    description: "Yıllık GitHub Enterprise lisansı (10 koltuk)",
    category: "Teknoloji",
    amount: 48000,
    frequency: "yearly",
    createdAt: "2026-01-20",
    nextBillingDate: "2027-01-20",
  },
  {
    id: "exp-008",
    title: "Alan Adı & SSL Sertifikaları",
    description: "Tüm domain'ler ve wildcard SSL yenileme",
    category: "Teknoloji",
    amount: 6500,
    frequency: "yearly",
    createdAt: "2026-02-10",
    nextBillingDate: "2027-02-10",
  },
  {
    id: "exp-009",
    title: "Muhasebe Yazılımı Lisansı",
    description: "Logo Go yıllık lisans yenileme",
    category: "Ofis",
    amount: 15000,
    frequency: "yearly",
    createdAt: "2026-03-05",
    nextBillingDate: "2027-03-05",
  },
  {
    id: "exp-010",
    title: "Marka Danışmanlığı Retainer",
    description: "Yıllık marka ve iletişim danışmanlığı sözleşmesi",
    category: "Pazarlama",
    amount: 72000,
    frequency: "yearly",
    createdAt: "2026-01-08",
    nextBillingDate: "2027-01-08",
  },
  // --- One-time ---
  {
    id: "exp-011",
    title: "React Summit Konferans Bileti",
    description: "Amsterdam React Summit 2026, 2 geliştirici — uçak + konaklama dahil",
    category: "Seyahat",
    amount: 18500,
    frequency: "one-time",
    createdAt: "2026-08-17",
  },
  {
    id: "exp-012",
    title: "Yeni Ofis Koltuğu",
    description: "Ergonomik koltuk, 3 adet",
    category: "Ofis",
    amount: 9600,
    frequency: "one-time",
    createdAt: "2026-08-18",
  },
  {
    id: "exp-013",
    title: "Instagram Reklam Kampanyası",
    description: "Ürün lansman dönemi Meta Ads",
    category: "Pazarlama",
    amount: 22000,
    frequency: "one-time",
    createdAt: "2026-08-19",
  },
];

export const MOCK_BUDGETS: BudgetItem[] = [
  { category: "Personel", budget: 500000, spent: 420000 },
  { category: "Teknoloji", budget: 120000, spent: 96100 },
  { category: "Pazarlama", budget: 150000, spent: 110500 },
  { category: "Ofis", budget: 80000, spent: 73400 },
  { category: "Seyahat", budget: 40000, spent: 18500 },
  { category: "Diğer", budget: 20000, spent: 0 },
];

export function monthlyAmount(e: Expense): number {
  if (e.frequency === "monthly") return e.amount;
  if (e.frequency === "yearly") return Math.round(e.amount / 12);
  return e.amount;
}

export function yearlyAmount(e: Expense): number {
  if (e.frequency === "monthly") return e.amount * 12;
  if (e.frequency === "yearly") return e.amount;
  return e.amount;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}