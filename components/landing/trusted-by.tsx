export function TrustedBy() {
  return (
    <section className="border-b border-black/[0.03] py-20">
      <div className="container mx-auto max-w-5xl px-6 text-center">
        <h2 className="mb-10 text-xs font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase">
          Confidence backed by results
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-10 opacity-40 grayscale transition-all duration-700 hover:opacity-80 hover:grayscale-0">
          {/* Mock Logos */}
          {["Acme Corp", "GlobalTech", "Nexus", "Stark Ind.", "Wayne Ent."].map(
            (company) => (
              <div key={company} className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-sm bg-foreground/50" />
                <span className="text-sm font-semibold tracking-tight text-foreground/80">
                  {company}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}
