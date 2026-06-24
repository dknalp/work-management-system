import { Button } from "@/components/ui/button"

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-32">
      <div className="mb-20 text-center">
        <h2 className="font-instrument mb-6 text-4xl leading-tight tracking-tight md:text-[3.5rem]">
          Choose the perfect plan
          <br />
          for your business
        </h2>
        <p className="mx-auto max-w-lg text-lg font-medium text-muted-foreground">
          Start for free, upgrade when you need more power and advanced
          controls.
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
        {/* Free Plan */}
        <div className="shadow-soft flex flex-col rounded-3xl border border-black/[0.04] bg-card p-10">
          <h3 className="mb-2 text-xl font-semibold">Starter</h3>
          <p className="mb-8 h-10 text-sm leading-relaxed text-muted-foreground">
            Perfect for individuals and small teams starting out.
          </p>
          <div className="mb-8">
            <span className="font-instrument text-5xl tracking-tight">$0</span>
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              /mo
            </span>
          </div>
          <Button
            variant="outline"
            className="mb-10 h-11 w-full rounded-full border-border/80 bg-transparent font-semibold text-foreground shadow-sm hover:bg-muted"
          >
            Start for free
          </Button>
          <ul className="flex-1 space-y-4 text-sm font-medium text-muted-foreground">
            <li className="flex items-center gap-3">
              <span className="text-xs text-foreground/40">✔</span> Up to 5
              members
            </li>
            <li className="flex items-center gap-3">
              <span className="text-xs text-foreground/40">✔</span> Basic task
              tracking
            </li>
            <li className="flex items-center gap-3">
              <span className="text-xs text-foreground/40">✔</span> 5GB Cloud
              Storage
            </li>
          </ul>
        </div>

        {/* Pro Plan */}
        <div className="relative flex transform flex-col rounded-3xl border border-foreground/10 bg-foreground p-10 text-background shadow-2xl md:-translate-y-4">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-4 py-1.5 text-xs font-bold tracking-wide text-white shadow-sm">
            MOST POPULAR
          </div>
          <h3 className="mb-2 text-xl font-semibold text-background">
            Professional
          </h3>
          <p className="mb-8 h-10 text-sm leading-relaxed text-muted-foreground opacity-80">
            For growing teams that need more power and flexibility.
          </p>
          <div className="mb-8">
            <span className="font-instrument text-5xl tracking-tight">$19</span>
            <span className="ml-1 text-sm font-medium text-muted-foreground opacity-80">
              /user/mo
            </span>
          </div>
          <Button className="mb-10 h-11 w-full rounded-full bg-background font-semibold text-foreground shadow-sm hover:bg-background/90">
            Get started
          </Button>
          <ul className="flex-1 space-y-4 text-sm font-medium opacity-90">
            <li className="flex items-center gap-3">
              <span className="text-xs text-blue-400">✔</span> Unlimited members
            </li>
            <li className="flex items-center gap-3">
              <span className="text-xs text-blue-400">✔</span> Advanced
              pipelines & reporting
            </li>
            <li className="flex items-center gap-3">
              <span className="text-xs text-blue-400">✔</span> 1TB Cloud Storage
            </li>
            <li className="flex items-center gap-3">
              <span className="text-xs text-blue-400">✔</span> Custom roles &
              permissions
            </li>
          </ul>
        </div>

        {/* Enterprise Plan */}
        <div className="shadow-soft flex flex-col rounded-3xl border border-black/[0.04] bg-card p-10">
          <h3 className="mb-2 text-xl font-semibold">Enterprise</h3>
          <p className="mb-8 h-10 text-sm leading-relaxed text-muted-foreground">
            Advanced security and support for large organizations.
          </p>
          <div className="mb-8">
            <span className="font-instrument text-5xl tracking-tight">$49</span>
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              /user/mo
            </span>
          </div>
          <Button
            variant="outline"
            className="mb-10 h-11 w-full rounded-full border-border/80 bg-transparent font-semibold text-foreground shadow-sm hover:bg-muted"
          >
            Contact sales
          </Button>
          <ul className="flex-1 space-y-4 text-sm font-medium text-muted-foreground">
            <li className="flex items-center gap-3">
              <span className="text-xs text-foreground/40">✔</span> Everything
              in Professional
            </li>
            <li className="flex items-center gap-3">
              <span className="text-xs text-foreground/40">✔</span> Unlimited
              Cloud Storage
            </li>
            <li className="flex items-center gap-3">
              <span className="text-xs text-foreground/40">✔</span> SSO &
              Advanced Security
            </li>
            <li className="flex items-center gap-3">
              <span className="text-xs text-foreground/40">✔</span> Dedicated
              Success Manager
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
