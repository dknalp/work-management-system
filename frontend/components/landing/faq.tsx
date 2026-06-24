export function FAQ() {
  const faqs = [
    {
      q: "What is WorkSync?",
      a: "WorkSync is an all-in-one team management platform designed to unify your cloud storage, task pipelines, and member analytics in one beautiful workspace.",
    },
    {
      q: "How secure is the cloud storage?",
      a: "We use enterprise-grade end-to-end encryption to ensure that your files and data are always secure and compliant with industry standards.",
    },
    {
      q: "Can I migrate from my current tools?",
      a: "Yes, we offer one-click integrations and import tools for popular platforms like Jira, Trello, and Google Drive to make your transition seamless.",
    },
    {
      q: "Is there a free trial available?",
      a: "Yes, you can try all Professional and Enterprise features free for 14 days without entering a credit card.",
    },
  ]
  return (
    <section
      id="faq"
      className="mx-auto max-w-3xl border-t border-black/[0.03] px-6 py-32"
    >
      <h2 className="font-instrument mb-16 text-center text-4xl tracking-tight md:text-5xl">
        Frequently Asked Questions
      </h2>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="group border-b border-black/[0.04] pt-4 pb-6">
            <h3 className="mb-3 flex cursor-pointer items-center justify-between text-lg font-semibold text-foreground transition-colors group-hover:text-foreground/70">
              {faq.q}
              <svg
                className="h-5 w-5 text-muted-foreground/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </h3>
            <p className="pr-8 text-sm leading-relaxed font-medium text-muted-foreground">
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
