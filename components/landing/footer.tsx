import Link from "next/link"
import { GithubIcon } from "@/components/icons/github"

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background px-6 py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-12 md:grid-cols-4 md:gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link
            href="/"
            className="font-instrument mb-4 inline-block text-2xl font-bold tracking-tight"
          >
            WorkSync
          </Link>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            Making team management effortless, powerful, and beautifully simple.
          </p>
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="https://github.com/parsherr/work-management-system"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <GithubIcon className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </Link>
          </div>
          <div className="text-sm text-muted-foreground/60">
            © 2026 WorkSync Inc.
          </div>
        </div>
        <div>
          <h4 className="mb-6 text-sm font-semibold tracking-wide text-foreground">
            Product
          </h4>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li>
              <Link
                href="#features"
                className="transition-colors hover:text-foreground"
              >
                Features
              </Link>
            </li>
            <li>
              <Link
                href="#pricing"
                className="transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
            </li>
            <li>
              <Link
                href="https://github.com/parsherr/work-management-system"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-foreground"
              >
                GitHub (Open Source)
              </Link>
            </li>
            <li>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Changelog
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-6 text-sm font-semibold tracking-wide text-foreground">
            Company
          </h4>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                About Us
              </Link>
            </li>
            <li>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Careers
              </Link>
            </li>
            <li>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Blog
              </Link>
            </li>
            <li>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Contact
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-6 text-sm font-semibold tracking-wide text-foreground">
            Legal
          </h4>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <Link
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Cookie Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
