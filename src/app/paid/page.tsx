import type { Metadata } from "next";
import { PaymentSuccess } from "@/components/payment-success";

export const metadata: Metadata = { title: "Payment successful" };

export default function PaidPage() {
  return <PaymentSuccess />;
}
