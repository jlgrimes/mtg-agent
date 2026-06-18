import { registerOTel } from "@vercel/otel";
import { defineInstrumentation } from "eve/instrumentation";

// Wires eve's traces (each turn, model call, and tool execution) into Vercel's
// OpenTelemetry collector, viewable under the project's Observability tab on
// Vercel. eve's framework-owned "Agent Runs" view is automatic on Vercel; this
// adds the full OTel span tree on top.
export default defineInstrumentation({
  setup: ({ agentName }) => registerOTel({ serviceName: agentName }),
});
