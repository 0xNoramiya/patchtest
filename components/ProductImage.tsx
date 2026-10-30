/** Every catalogue image is generated, unbranded and named after its sku. */
export function productImage(sku: string): string {
  return `/products/${sku}.webp`;
}

export function ProductImage({
  sku,
  name,
  size = 64,
  className = "",
}: {
  sku: string;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={productImage(sku)}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 rounded-lg bg-sunken object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
