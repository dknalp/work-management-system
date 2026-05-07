import { Button } from "@/components/ui/button"
import Link from "next/link"

export function CTA() {
  return (
    <section className="relative overflow-hidden border-t border-black/[0.03] bg-card px-6 py-32 text-center">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay"></div>
      <div className="relative z-10 mx-auto max-w-2xl">
        <h2 className="font-instrument mb-8 text-4xl leading-tight tracking-tight md:text-5xl">
          Ready to transform your business?
        </h2>
        <p className="mb-12 text-lg leading-relaxed font-medium text-muted-foreground">
          Join thousands of modern teams that use WorkSync to manage their
          projects, people, and operations with absolute clarity.
        </p>
        <Button
          size="lg"
          className="shadow-soft h-14 rounded-full bg-foreground px-10 text-base font-semibold text-background hover:bg-foreground/90"
          asChild
        >
          <Link href="/dashboard">Try Demo</Link>
        </Button>
      </div>
    </section>
  )
}
