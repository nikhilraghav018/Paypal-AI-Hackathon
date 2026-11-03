import { connection } from "next/server";
import { buildDashboard } from "@/lib/dashboard-data";
import { expireStaleOrders } from "@/lib/orchestrator";
import { getState } from "@/lib/store";

export async function GET() {
  await connection();
  expireStaleOrders();
  return Response.json(buildDashboard(getState()));
}
