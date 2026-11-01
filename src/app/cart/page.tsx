import type { Metadata } from "next";
import { CartPage } from "@/components/cart-page";

export const metadata: Metadata = { title: "Your cart" };

export default function Cart() {
  return <CartPage />;
}
