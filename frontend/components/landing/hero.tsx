import { Button } from "@/components/ui/button"
import Link from "next/link"
import { GithubIcon } from "@/components/icons/github"

export function Hero() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pt-32 pb-20 text-center">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 inline-flex animate-in items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground duration-1000 fade-in slide-in-from-bottom-4">
          <GithubIcon className="h-3.5 w-3.5" />
          <span>100% Open Source on GitHub</span>
        </div>
        <h1 className="font-instrument mb-6 text-5xl leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-[5.5rem]">
          Effortless team management <br className="hidden sm:block" /> by
          WorkSync
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed font-medium text-muted-foreground md:text-xl">
          Unify your organization with a workspace designed for absolute
          clarity. Shared cloud storage, seamless task pipelines, and
          intelligent calendars.
        </p>
        <div className="mb-24 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="shadow-soft h-12 w-full rounded-full bg-foreground px-8 text-base font-semibold text-background transition-opacity hover:opacity-90 sm:w-auto"
            asChild
          >
            <Link href="/analytics">Try Demo</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="group h-12 w-full rounded-full border-border bg-card px-8 text-base font-semibold shadow-sm hover:bg-muted sm:w-auto"
            asChild
          >
            <Link
              href="https://github.com/parsherr/work-management-system"
              target="_blank"
              rel="noreferrer"
            >
              <GithubIcon className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
              Star on GitHub
            </Link>
          </Button>
        </div>
      </div>

      {/* App Mockup Placeholder */}
      <div className="shadow-soft relative mx-auto max-w-5xl rounded-2xl p-1.5">
        {/* Glowing Background */}
        <div className="absolute inset-0 -z-10 scale-105 transform rounded-[2rem] bg-gradient-to-br from-blue-200/40 via-red-100/30 to-green-100/40 blur-2xl" />
        <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-tr from-transparent via-white/50 to-transparent" />

        {/* Mockup Container */}
        <div className="relative z-20 w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <img
            src="/task-page-v2.png"
            alt="WorkSync Task Management"
            className="h-auto w-full object-cover"
          />
        </div>
      </div>
    </section>
  )
}
