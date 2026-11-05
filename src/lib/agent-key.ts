import { randomBytes } from "node:crypto";
import { findVisitor, getState, saveState } from "./store";

// The site owner turns MCP on with this secret, so a public host doesn't expose it by accident.
const MIN_SWITCH_LENGTH = 24;
const KEY = /^vk_[a-f0-9]{48}$/;

export function mcpEnabled(): boolean {
  return (process.env.VELORA_MCP_TOKEN ?? "").length >= MIN_SWITCH_LENGTH;
}

/**
 * Each visitor's agent key is separate from their browser cookie, so an agent holding it can only
 * ask and check through MCP. It can never open the app as the owner to approve or refund.
 */
export function agentKey(): string {
  const state = getState();
  if (!state.agentKey) {
    state.agentKey = `vk_${randomBytes(24).toString("hex")}`;
    saveState();
  }
  return state.agentKey;
}

/** Issues a new key, so the old one stops working at once. */
export function rotateAgentKey(): string {
  getState().agentKey = undefined;
  return agentKey();
}

/** The visitor an agent key belongs to, or null for an unknown key. */
export function visitorForKey(key: string): string | null {
  if (!KEY.test(key)) return null;
  return findVisitor((state) => state.agentKey === key);
}
