import { Navbar } from "@/components/landing/navbar"
import { Hero } from "@/components/landing/hero"
import { TrustedBy } from "@/components/landing/trusted-by"
import { Features } from "@/components/landing/features"
import { Testimonial } from "@/components/landing/testimonial"
import { FAQ } from "@/components/landing/faq"
import { CTA } from "@/components/landing/cta"
import { Footer } from "@/components/landing/footer"

export default function Page() {
  return (
    <div className="landing-page min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <Features />
        <Testimonial />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
