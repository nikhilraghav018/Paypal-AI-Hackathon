import type { Metadata } from "next";
import { MissionsPage } from "@/components/missions-page";

export const metadata: Metadata = { title: "All missions" };

export default function Missions() {
  return <MissionsPage />;
}
