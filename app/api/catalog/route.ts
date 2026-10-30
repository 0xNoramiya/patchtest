import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/rules/load";

export async function GET() {
  const catalog = loadCatalog();
  return NextResponse.json({
    store: catalog.store,
    products: catalog.products.map((p) => ({
      sku: p.sku,
      name: p.name,
      price: p.price,
      blurb: p.blurb,
      tags: p.tags,
    })),
  });
}
