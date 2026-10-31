import Link from "next/link";
import { Reveal } from "@/components/Reveal";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
          <Link href="/" className="font-display text-base font-semibold tracking-tight">
            Patch<span className="text-accent">Test</span>
          </Link>
          <span className="hidden text-faint sm:inline">a patch test for your cart</span>
          <div className="ml-auto flex items-center gap-5">
            <Link href="/extension" className="text-muted hover:text-ink">
              Extension
            </Link>
            <Link href="/mcp" className="text-muted hover:text-ink">
              Agents
            </Link>
            <Link href="/eval" className="text-muted hover:text-ink">
              Eval
            </Link>
            <Link href="/methods" className="text-muted hover:text-ink">
              Methods
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>
      <Reveal />

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs leading-relaxed text-faint">
          <p>
            Lumen &amp; Leaf is a fictional store invented for this demo. Every product and price
            here is made up. PatchTest is a hackathon project, not a medical device, and it does not
            diagnose anything.
          </p>
          <p className="mt-2">
            Skin analysis by the YouCam AI Skin Analysis API and the YouCam AI Fitzpatrick Skin Type
            Analysis API.
          </p>
        </div>
      </footer>
    </div>
  );
}
