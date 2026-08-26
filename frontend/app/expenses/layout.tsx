import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShellDynamic>
        <main className="flex-1">{children}</main>
</AppShellDynamic>
  );
}