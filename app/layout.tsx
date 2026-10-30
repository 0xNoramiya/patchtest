import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "PatchTest, a patch test for your cart",
  description:
    "An AI skincare advisor for the moment before checkout that knows when not to sell. Built on the YouCam AI Skin Analysis and AI Fitzpatrick Skin Type APIs.",
};

/**
 * Only the html and body shell. The PatchTest header and footer live in the
 * (site) group, so /store can render as a different shop entirely, which is the
 * whole point of the extension demo.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
