// The single source of truth for which model the agent runs. Lives in agent/
// (not lib/) so the agent-deploy build — which copies only agent/ — stays
// self-contained; the web app imports it too (via @/agent/model) to stamp each
// saved assistant message with the model that produced it.
export const AGENT_MODEL = "moonshotai/kimi-k3";
