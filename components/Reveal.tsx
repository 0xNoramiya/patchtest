"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Reveals anything carrying `.anim-reveal` as the reader reaches it.
 *
 * Mounted once in the site layout rather than wrapping each element, because
 * the thing being revealed is ordinary server-rendered markup and should not
 * have to become a client component to move.
 *
 * The hidden state lives in CSS, gated on the `data-motion` attribute that an
 * inline script sets before first paint, so nothing here is load-bearing for
 * whether the content is readable.
 */
export function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    const show = (el: Element) => el.classList.add("is-in");
    const targets = document.querySelectorAll(".anim-reveal:not(.is-in)");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach(show);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          observer.unobserve(entry.target);
        }
      },
      // Pulled up from the bottom edge so an element arrives a beat after it
      // appears, rather than the instant its first pixel does.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
