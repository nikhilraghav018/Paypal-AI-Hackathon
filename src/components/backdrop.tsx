export type Outcome = "paid" | "blocked" | "cancelled" | "waiting" | "refunded";

export function Backdrop({ tone }: { tone?: Outcome }) {
  return (
    <div className="backdrop" data-tone={tone} aria-hidden>
      {tone !== undefined && <div className="rings" />}
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
    </div>
  );
}
