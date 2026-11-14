// src/lib/ai.ts — the ONE wrapper every agent goes through.
import { createHash } from "node:crypto";
import type { ZodType } from "zod";
import { GoogleGenAI } from "@google/genai";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { db } from "./db";
import { replayLookup } from "./replay";

export type Agent = "reader" | "designer" | "critic" | "director" | "classmates" | "insight" | "warmup";
const TEMP: Record<Agent, number> = { reader: 0, designer: 0.2, critic: 0, director: 0.4, classmates: 0.9, insight: 0.2, warmup: 0.7 };
const TIMEOUT: Record<Agent, number> = { reader: 30000, designer: 20000, critic: 20000, director: 5500, classmates: 20000, insight: 10000, warmup: 25000 };

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const modelFor = (a: Agent) => process.env.AI_PROVIDER === "bedrock"
  ? (a === "reader" ? process.env.BEDROCK_MODEL_VISION : process.env.BEDROCK_MODEL_FAST)!
  : (a === "reader" ? process.env.GEMINI_MODEL_VISION : process.env.GEMINI_MODEL_FAST)!;

async function callGemini(model: string, prompt: string, temperature: number, image?: Uint8Array) {
  const parts: any[] = [];
  if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: Buffer.from(image).toString("base64") } });
  parts.push({ text: prompt });
  const res = await gemini.models.generateContent({
    model, contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", temperature },
  });
  return res.text ?? "";
}

async function callBedrock(model: string, prompt: string, temperature: number, image?: Uint8Array) {
  const content: any[] = [];
  if (image) content.push({ image: { format: "jpeg", source: { bytes: image } } });
  content.push({ text: prompt + "\nReturn ONLY JSON." });
  const res = await bedrock.send(new ConverseCommand({
    modelId: model, messages: [{ role: "user", content }],
    inferenceConfig: { maxTokens: 6000, temperature },
  }));
  return res.output?.message?.content?.map((c: any) => ("text" in c ? c.text : "")).join("") ?? "";
}

export function extractJson(s: string) {
  const cleaned = s.replace(/`{3}(json)?/g, "").trim();   // strip markdown fences
  const a = cleaned.search(/[[{]/), b = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  return JSON.parse(cleaned.slice(a, b + 1));
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms} ms`)), ms))]);

export type AskResult<T> = { ok: true; data: T; ms: number; cached: boolean } | { ok: false; error: string; issues: string[]; raw?: string; ms: number };

export async function askJSON<T>(agent: Agent, schema: ZodType<T>, prompt: string,
  opts: { image?: Uint8Array; ctx?: { classCode?: string; sessionId?: string; reason?: string } } = {}): Promise<AskResult<T>> {
  const model = modelFor(agent);
  const inputHash = createHash("sha256").update(agent + model + prompt)
    .update(opts.image ? Buffer.from(opts.image) : Buffer.alloc(0)).digest("hex").slice(0, 32);
  const t0 = Date.now();

  if (process.env.OFFLINE === "1") {                       // replay of recorded real outputs
    const hit = replayLookup(agent, inputHash);
    if (!hit) return { ok: false, error: "no recorded output", issues: [], ms: 0 };
    const p = schema.safeParse(hit);
    return p.success ? { ok: true, data: p.data, ms: 0, cached: true } : { ok: false, error: "replay schema", issues: [], ms: 0 };
  }

  let raw = ""; let error = ""; let issues: string[] = [];
  // Gemini's "high demand" spikes (503 UNAVAILABLE) came in bursts on 2026-11-14, so a busy model's one retry goes
  // to GEMINI_MODEL_BACKUP when it's set (no wait; even the coach gets it if there's time). A 429 waits 2 s, as before.
  let used = model;
  const backup = process.env.AI_PROVIDER === "bedrock" ? undefined : process.env.GEMINI_MODEL_BACKUP;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const call = process.env.AI_PROVIDER === "bedrock" ? callBedrock : callGemini;
      const budget = attempt === 0 ? TIMEOUT[agent] : Math.max(TIMEOUT[agent] - (Date.now() - t0), agent === "director" ? 0 : 10000);
      raw = await withTimeout(call(used, prompt, TEMP[agent], opts.image), budget);
      error = ""; break;
    } catch (e: any) {
      error = String(e?.message ?? e);
      const is429 = e?.status === 429 || /429|RESOURCE_EXHAUSTED|Throttling/i.test(error);
      const busy = e?.status === 503 || /503|UNAVAILABLE|high demand|overloaded/i.test(error);
      if (attempt > 0) break;
      if (busy && backup && backup !== used && (agent !== "director" || Date.now() - t0 < 2500)) { used = backup; continue; }
      if ((is429 || busy) && agent !== "director") { await new Promise((r) => setTimeout(r, 2000)); continue; }
      break;
    }
  }
  let data: T | undefined;
  if (!error) {
    try {
      const p = schema.safeParse(extractJson(raw));
      if (p.success) data = p.data; else { error = "schema"; issues = p.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`); }
    } catch { error = "not JSON"; }
  }
  const ms = Date.now() - t0;
  await db.log({ agent, model: used, inputHash, ms, ok: !error, error: error || null, outputJson: data ?? null,
    classCode: opts.ctx?.classCode ?? null, sessionId: opts.ctx?.sessionId ?? null, reason: opts.ctx?.reason ?? null }).catch(() => {});
  return data !== undefined ? { ok: true, data, ms, cached: false } : { ok: false, error, issues, raw: raw.slice(0, 4000), ms };
}
