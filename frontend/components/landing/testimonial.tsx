export function Testimonial() {
  return (
    <section className="border-b border-black/[0.03] px-6 py-32">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <div className="shadow-soft mb-10 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-black/[0.05] bg-gradient-to-br from-card to-background">
          <svg
            className="h-5 w-5 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <blockquote className="font-instrument mb-10 text-3xl leading-[1.2] tracking-tight text-foreground md:text-[2.75rem]">
          "In just a few minutes, we transformed our data into actionable
          insights. This process was so smooth and incredibly efficient."
        </blockquote>
        <div className="flex flex-col items-center">
          <div className="mb-0.5 text-base font-semibold text-foreground">
            Jane Doe
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            VP of Operations, TechCorp
          </div>
        </div>
      </div>
    </section>
  )
}
