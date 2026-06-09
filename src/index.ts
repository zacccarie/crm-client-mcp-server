#!/usr/bin/env node
/**
 * crm-client-mcp-server — MCP CLIENT. Pilote VOTRE CRM via l'IA de votre choix.
 * Auth : clé MCP (env MCP_KEY). Le tenant est dérivé de la clé côté serveur :
 * vous n'accédez qu'à vos propres données. Aucune capacité d'admin/ops.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodRawShape } from "zod";
import axios, { AxiosError } from "axios";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const CRM_BASE_URL = process.env.CRM_BASE_URL ?? "";
const MCP_KEY = process.env.MCP_KEY ?? "";
const CHARACTER_LIMIT = 25000;

function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const e = error as AxiosError<{ error?: string }>;
    if (e.response) {
      const detail = e.response.data?.error ?? "";
      if (e.response.status === 401) return "Erreur 401 : clé MCP invalide ou révoquée. Régénérez-en une dans le CRM.";
      return `Erreur ${e.response.status}. ${detail}`;
    }
    return `Erreur réseau : ${e.message}`;
  }
  return `Erreur : ${error instanceof Error ? error.message : String(error)}`;
}

async function cli(method: "GET" | "POST", body?: unknown, params?: Record<string, unknown>): Promise<unknown> {
  const res = await axios({
    method, url: `${CRM_BASE_URL}/api/mcp/crud`, data: body, params,
    timeout: 30000,
    headers: { Authorization: `Bearer ${MCP_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
  });
  return res.data;
}

const server = new McpServer({ name: "crm-client-mcp-server", version: "1.0.0" });

function reg(name: string, description: string, inputShape: ZodRawShape, readOnly: boolean, handler: (a: Record<string, unknown>) => Promise<unknown>) {
  server.registerTool(
    name,
    { title: name, description, inputSchema: inputShape, annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: readOnly, openWorldHint: true } },
    async (args: Record<string, unknown>) => {
      try {
        const out = await handler(args ?? {});
        let text = typeof out === "string" ? out : JSON.stringify(out, null, 2);
        if (text.length > CHARACTER_LIMIT) text = text.slice(0, CHARACTER_LIMIT) + "\n…(tronqué)";
        return { content: [{ type: "text" as const, text }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: handleApiError(e) }], isError: true };
      }
    },
  );
}

reg("crm_list", "Liste vos enregistrements. resource ∈ clients|prospects|leads|chantiers|invoices|appointments.",
  { resource: z.enum(["clients", "prospects", "leads", "chantiers", "invoices", "appointments"]), limit: z.number().int().min(1).max(100).default(25) },
  true,
  (a) => cli("GET", undefined, { resource: a.resource, limit: a.limit }));

reg("crm_create_client", "Crée un client dans votre CRM.",
  { firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional(), city: z.string().optional(), address: z.string().optional(), postalCode: z.string().optional() },
  false,
  (a) => cli("POST", { ...a, op: "create_client" }));

reg("crm_create_prospect", "Crée un prospect. qualification ∈ HOT|WARM|COLD|UNQUALIFIED ; stage ∈ TO_CALL|CONTACTED|INTERESTED|RDV_SCHEDULED|NOT_INTERESTED|CONVERTED|LOST.",
  { firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional(), city: z.string().optional(), qualification: z.enum(["HOT", "WARM", "COLD", "UNQUALIFIED"]).optional(), stage: z.enum(["TO_CALL", "CONTACTED", "INTERESTED", "RDV_SCHEDULED", "NOT_INTERESTED", "CONVERTED", "LOST"]).optional() },
  false,
  (a) => cli("POST", { ...a, op: "create_prospect" }));

reg("crm_create_lead", "Crée un lead entrant.",
  { firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), city: z.string().optional(), source: z.string().optional(), verticalDomain: z.string().optional() },
  false,
  (a) => cli("POST", { ...a, op: "create_lead" }));

reg("crm_create_appointment", "Crée un rendez-vous pour un de vos clients. startAt en ISO (ex 2026-06-20T10:00:00Z).",
  { clientId: z.string().min(1), title: z.string().min(1), startAt: z.string().min(1), endAt: z.string().optional(), location: z.string().optional() },
  false,
  (a) => cli("POST", { ...a, op: "create_appointment" }));

reg("crm_update_prospect_stage", "Déplace un prospect dans le pipeline.",
  { prospectId: z.string().min(1), stage: z.enum(["TO_CALL", "CONTACTED", "INTERESTED", "RDV_SCHEDULED", "NOT_INTERESTED", "CONVERTED", "LOST"]) },
  false,
  (a) => cli("POST", { ...a, op: "update_prospect_stage" }));

async function main() {
  const missing = [!CRM_BASE_URL && "CRM_BASE_URL", !MCP_KEY && "MCP_KEY"].filter(Boolean);
  if (missing.length) {
    console.error(`ERREUR : variables manquantes : ${missing.join(", ")} (définir dans .env)`);
    process.exit(1);
  }
  await server.connect(new StdioServerTransport());
  console.error("crm-client-mcp-server actif (stdio) — pilotage de votre CRM");
}

main().catch((e) => { console.error("Erreur serveur:", e); process.exit(1); });
