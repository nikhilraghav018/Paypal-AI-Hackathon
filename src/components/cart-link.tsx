import Link from "next/link";

export function CartLink({ count }: { count: number }) {
  return (
    <Link href="/cart" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`} className="btn btn-quiet inline-flex items-center gap-2">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2.5 3.5h3l2.6 12.2h10.6l2-8.7H6.4" />
      </svg>
      Cart
      {count > 0 && <span className="rounded-full bg-accent px-2 text-xs font-bold leading-5 text-accent-ink">{count}</span>}
    </Link>
  );
}
