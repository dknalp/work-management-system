import { Button } from "@/components/ui/button"
import Link from "next/link"

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-32">
      <div className="mx-auto mb-20 max-w-2xl text-center">
        <h2 className="font-instrument mb-6 text-4xl leading-tight tracking-tight md:text-[3.5rem]">
          Built for absolute clarity
          <br />
          and focused work
        </h2>
        <p className="text-lg font-medium text-muted-foreground">
          Everything you need to manage your team, securely stored and
          seamlessly connected in one intelligent workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Feature 1: Shared Cloud Storage */}
        <div className="shadow-soft group relative flex flex-col gap-10 overflow-hidden rounded-3xl border border-black/[0.04] bg-card p-10 transition-shadow duration-500 hover:shadow-lg md:flex-row lg:col-span-2">
          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50/50">
              <svg
                className="h-5 w-5 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Shared Cloud Storage</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Centralize your team's files with secure, lightning-fast cloud
              storage. Organize, search, and collaborate on documents without
              leaving your workspace.
            </p>
          </div>
          <div className="relative flex min-h-[220px] flex-1 translate-x-4 translate-y-4 flex-col overflow-hidden rounded-xl border border-border/50 bg-background/50 shadow-sm transition-transform duration-500 group-hover:translate-x-2 group-hover:translate-y-2">
            <div className="flex h-10 items-center border-b border-border/50 bg-card/80 px-4">
              <div className="h-2.5 w-1/2 rounded-full bg-muted/60" />
            </div>
            <div className="grid flex-1 grid-cols-3 gap-3 p-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/40 bg-card shadow-sm"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Feature 2: Task Management */}
        <div className="shadow-soft flex flex-col justify-between rounded-3xl border border-black/[0.04] bg-card p-10 transition-shadow duration-500 hover:shadow-lg">
          <div>
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50/50">
              <svg
                className="h-5 w-5 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Intelligent Tasks</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Break down complex projects into manageable tasks. Assign, track,
              and conquer together.
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <div className="flex h-12 items-center gap-3 rounded-lg border border-border/50 p-3">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
              <div className="h-2 w-1/2 rounded-full bg-muted/60" />
            </div>
            <div className="flex h-12 items-center gap-3 rounded-lg border border-border/50 p-3">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
              <div className="h-2 w-2/3 rounded-full bg-muted/60" />
            </div>
          </div>
        </div>

        {/* Feature 3: Pipelines */}
        <div className="shadow-soft flex flex-col justify-between rounded-3xl border border-black/[0.04] bg-card p-10 transition-shadow duration-500 hover:shadow-lg">
          <div>
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50/50">
              <svg
                className="h-5 w-5 text-purple-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Visual Pipelines</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Map out your workflows with custom kanban boards. See exactly
              where everything stands at a glance.
            </p>
          </div>
        </div>

        {/* Feature 4: Member Management & Analytics */}
        <div className="shadow-soft group relative flex flex-col gap-10 overflow-hidden rounded-3xl border border-black/[0.04] bg-card p-10 transition-shadow duration-500 hover:shadow-lg sm:flex-row lg:col-span-2">
          <div className="order-2 flex flex-1 flex-col justify-center sm:order-1">
            <div className="mb-6 flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50/50">
                <svg
                  className="h-5 w-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50/50">
                <svg
                  className="h-5 w-5 text-orange-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                  />
                </svg>
              </div>
            </div>
            <h3 className="mb-3 text-xl font-semibold">Team & Analytics</h3>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Manage roles, access, and team capacity. Leverage real-time
              analytics to measure velocity and optimize your operations
              continuously.
            </p>
            <div>
              <Button
                variant="link"
                className="px-0 font-medium text-foreground"
                asChild
              >
                <Link href="/features">
                  See all capabilities{" "}
                  <svg
                    className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative order-1 flex min-h-[220px] flex-1 flex-col justify-between overflow-hidden rounded-xl border border-border/50 bg-background/50 shadow-sm sm:order-2">
            <div className="flex flex-1 items-end gap-2 p-6">
              <div className="h-[40%] flex-1 rounded-t-sm bg-blue-100" />
              <div className="h-[60%] flex-1 rounded-t-sm bg-blue-200" />
              <div className="h-[80%] flex-1 rounded-t-sm bg-blue-400" />
              <div className="h-[100%] flex-1 rounded-t-sm bg-blue-500" />
              <div className="h-[70%] flex-1 rounded-t-sm bg-blue-600" />
            </div>
            <div className="h-px w-full bg-border/50" />
            <div className="flex items-center justify-between bg-card p-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-7 w-7 rounded-full border-2 border-card bg-muted/80"
                  />
                ))}
              </div>
              <div className="text-xs font-medium text-muted-foreground">
                +24 team
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
