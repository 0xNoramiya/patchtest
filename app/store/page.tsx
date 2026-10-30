import { Inter } from "next/font/google";

export const metadata = { title: "Verdant Row, your bag" };

// A different typeface from PatchTest's on purpose. This is meant to look like
// somebody else's shop, and Inter is what most of them use.
const shopFont = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

/**
 * A fictional third-party shop, deliberately styled nothing like PatchTest, so
 * the extension can be seen annotating someone else's page.
 *
 * It publishes schema.org Product microdata, which is what real shops already
 * emit for search engines. The extension reads that, not anything bespoke, so
 * nothing here is a special case built to make the demo work.
 */
const CART = [
  {
    name: "Overnight Retinol 0.5% Renewal Serum",
    price: 29,
    size: "30 ml",
    note: "Bestseller",
    image: "/store/vr-1.webp",
    qty: 1,
  },
  {
    name: "AHA 30% + BHA 2% Weekly Peeling Solution",
    price: 18,
    size: "30 ml",
    note: "Weekly treatment",
    image: "/store/vr-2.webp",
    qty: 1,
  },
  {
    name: "Niacinamide 10% Pore Refining Serum",
    price: 16,
    size: "30 ml",
    note: null,
    image: "/store/vr-3.webp",
    qty: 2,
  },
  {
    name: "Gentle Ceramide Cleansing Milk",
    price: 21,
    size: "200 ml",
    note: null,
    image: "/store/vr-4.webp",
    qty: 1,
  },
  {
    name: "Daily Mineral Sunscreen SPF 50",
    price: 24,
    size: "50 ml",
    note: null,
    image: "/store/vr-5.webp",
    qty: 1,
  },
];

const NAV = ["Serums", "Cleansers", "Moisturisers", "SPF", "Sets"];

export default function StorePage() {
  const subtotal = CART.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = CART.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className={`${shopFont.className} min-h-screen bg-white text-zinc-900`}>
      <p className="bg-zinc-900 px-4 py-2 text-center text-[11px] tracking-wide text-zinc-300">
        Free shipping over $50 · Fictional shop, built for the PatchTest demo
      </p>

      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center gap-8 px-5 py-5">
          <span className="text-lg font-bold tracking-[0.18em]">VERDANT ROW</span>
          <nav className="hidden gap-6 text-[13px] text-zinc-600 md:flex">
            {NAV.map((item) => (
              <span key={item} className="cursor-default hover:text-zinc-900">
                {item}
              </span>
            ))}
          </nav>
          <span className="ml-auto text-[13px] text-zinc-500">Bag ({count})</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10">
        <p className="mb-8 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-zinc-500">
          Verdant Row does not exist. Every product and price here is invented for the PatchTest
          demo, and every product image is AI generated. Install the PatchTest extension and it will
          annotate this page exactly the way it would annotate a real cart.
        </p>

        <h1 className="text-[28px] font-semibold tracking-tight">Your bag</h1>

        <div className="mt-7 grid gap-10 lg:grid-cols-[1fr_300px]">
          <ul className="min-w-0">
            {CART.map((item) => (
              <li
                key={item.name}
                className="cart-item border-t border-zinc-200 py-6 first:border-t-0 first:pt-0"
                itemScope
                itemType="https://schema.org/Product"
              >
                <div className="flex gap-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt=""
                    width={96}
                    height={96}
                    className="size-24 shrink-0 rounded-md bg-zinc-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 itemProp="name" className="text-[15px] font-semibold leading-snug">
                          {item.name}
                        </h2>
                        <p className="mt-1 text-[13px] text-zinc-500">
                          {item.size}
                          {item.note ? ` · ${item.note}` : ""}
                        </p>
                      </div>
                      <div
                        itemProp="offers"
                        itemScope
                        itemType="https://schema.org/Offer"
                        className="shrink-0 text-[15px] font-medium tabular-nums"
                      >
                        <meta itemProp="price" content={String(item.price)} />
                        <meta itemProp="priceCurrency" content="USD" />
                        <meta itemProp="availability" content="https://schema.org/InStock" />$
                        {item.price * item.qty}
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center gap-4">
                      <div className="inline-flex items-center rounded border border-zinc-300">
                        <span className="px-2.5 py-1 text-[13px] text-zinc-400">&minus;</span>
                        <span className="min-w-7 border-x border-zinc-300 px-1 py-1 text-center text-[13px] tabular-nums">
                          {item.qty}
                        </span>
                        <span className="px-2.5 py-1 text-[13px] text-zinc-400">+</span>
                      </div>
                      <span className="text-[12px] text-zinc-400 underline underline-offset-2">
                        Remove
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-lg border border-zinc-200 bg-zinc-50 p-5 lg:sticky lg:top-8">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
              Order summary
            </h2>
            <dl className="mt-4 space-y-2.5 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-zinc-600">Subtotal</dt>
                <dd className="tabular-nums">${subtotal}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-600">Shipping</dt>
                <dd className="text-zinc-500">Free</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2.5 text-[15px] font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">${subtotal}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="mt-5 w-full rounded bg-zinc-900 py-3 text-[14px] font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Checkout
            </button>
            <p className="mt-3 text-center text-[11px] text-zinc-400">
              Taxes calculated at checkout
            </p>
          </aside>
        </div>
      </div>

      <footer className="mt-10 border-t border-zinc-200">
        <div className="mx-auto max-w-5xl px-5 py-8 text-[12px] text-zinc-400">
          Verdant Row is a fictional shop created for the PatchTest hackathon demo. No real brand,
          product or price appears on this page.
        </div>
      </footer>
    </div>
  );
}
