import { connection } from "next/server";
import { buildDashboard } from "@/lib/dashboard-data";
import { expireStaleOrders } from "@/lib/orchestrator";
import { getState } from "@/lib/store";
import { forVisitor } from "@/lib/visitor";

async function handleGET() {
  await connection();
  expireStaleOrders();
  return Response.json(buildDashboard(getState()));
}

export const GET = forVisitor(handleGET);
