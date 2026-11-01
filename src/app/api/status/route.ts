import { connection } from "next/server";
import { channel3Configured } from "@/lib/catalog";
import { llmConfigured, llmModel } from "@/lib/llm";
import { paypalConfigured } from "@/lib/paypal";

export async function GET() {
  await connection();
  return Response.json({
    ai: llmConfigured() ? llmModel() : null,
    catalog: channel3Configured() ? "channel3" : "sample",
    payments: paypalConfigured() ? "sandbox" : "simulated",
  });
}
