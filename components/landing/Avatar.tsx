// The app's own cartoon avatars (public/avatars/1-30.png), reused on the
// landing page so the people in the demos look like the people in the product.
export function Avatar({ n, className = "" }: { n: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/avatars/${n}.png`}
      alt=""
      width={100}
      height={100}
      loading="lazy"
      decoding="async"
      className={`lp-avatar ${className}`}
    />
  );
}
