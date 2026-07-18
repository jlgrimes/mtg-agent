// Single source of truth for the agent's model. The eve runtime config
// (agent/agent.ts) and the chat UI's model chip both read from here, so the
// badge can never drift from what the agent actually runs on.
export const AGENT_MODEL = "moonshotai/kimi-k3";
export const AGENT_MODEL_LABEL = "Kimi K3";
