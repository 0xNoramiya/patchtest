import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Source_Serif_4({ variable: "--font-display", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "PatchTest, a patch test for your cart",
  description:
    "An AI skincare advisor for the moment before checkout that knows when not to sell. Built on the YouCam AI Skin Analysis and AI Fitzpatrick Skin Type APIs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="font-display text-base font-semibold tracking-tight">
              Patch<span className="text-accent">Test</span>
            </Link>
            <span className="hidden text-faint sm:inline">a patch test for your cart</span>
            <div className="ml-auto flex items-center gap-5">
              <Link href="/eval" className="text-muted hover:text-ink">Eval</Link>
              <Link href="/methods" className="text-muted hover:text-ink">Methods</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs leading-relaxed text-faint">
            <p>
              Lumen &amp; Leaf is a fictional store invented for this demo. Every product and price
              here is made up. PatchTest is a hackathon project, not a medical device, and it does
              not diagnose anything.
            </p>
            <p className="mt-2">
              Skin analysis by the YouCam AI Skin Analysis API and the YouCam AI Fitzpatrick Skin
              Type Analysis API.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
