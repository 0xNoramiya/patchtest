import { Inter } from "next/font/google";

export const metadata = { title: "Verdant Row, cart" };

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
    note: "Our bestselling night serum",
  },
  {
    name: "AHA 30% + BHA 2% Weekly Peeling Solution",
    price: 18,
    size: "30 ml",
    note: "Weekly resurfacing treatment",
  },
  {
    name: "Niacinamide 10% Pore Refining Serum",
    price: 16,
    size: "30 ml",
    note: "For visible pores and shine",
  },
  {
    name: "Gentle Ceramide Cleansing Milk",
    price: 21,
    size: "200 ml",
    note: "Daily non-foaming cleanser",
  },
  {
    name: "Daily Mineral Sunscreen SPF 50",
    price: 24,
    size: "50 ml",
    note: "Zinc oxide, no white cast",
  },
];

export default function StorePage() {
  const total = CART.reduce((sum, item) => sum + item.price, 0);

  return (
    <div
      className={shopFont.className}
      style={{ background: "#ffffff", minHeight: "100vh", color: "#111" }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
        <p
          style={{
            border: "1px dashed #d4d4d0",
            background: "#faf9f7",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.5,
            color: "#666",
            margin: 0,
          }}
        >
          This is a fictional shop built for the PatchTest demo. Verdant Row does not exist, and
          every product and price below is invented. Install the PatchTest extension and it will
          annotate this page the way it would annotate a real cart.
        </p>

        <header
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            borderBottom: "1px solid #e5e5e5",
            paddingBottom: 14,
          }}
        >
          <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: "0.14em" }}>VERDANT ROW</span>
          <span style={{ fontSize: 13, color: "#666" }}>Your bag ({CART.length})</span>
        </header>

        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {CART.map((item) => (
            <li
              key={item.name}
              className="cart-item"
              itemScope
              itemType="https://schema.org/Product"
              style={{ padding: "18px 0", borderBottom: "1px solid #eee" }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div
                  aria-hidden
                  style={{ width: 64, height: 64, borderRadius: 6, background: "#f2f2f0", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div itemProp="name" style={{ fontSize: 15, fontWeight: 600 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#777", marginTop: 2 }}>
                    {item.size} · {item.note}
                  </div>
                </div>
                <div
                  itemProp="offers"
                  itemScope
                  itemType="https://schema.org/Offer"
                  style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}
                >
                  <meta itemProp="price" content={String(item.price)} />
                  <meta itemProp="priceCurrency" content="USD" />${item.price}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div
          style={{
            marginTop: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            Subtotal <span style={{ fontVariantNumeric: "tabular-nums" }}>${total}</span>
          </span>
          <button
            type="button"
            style={{
              background: "#111",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              padding: "11px 26px",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
