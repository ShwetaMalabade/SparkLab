// src/lib/http.ts — small helpers shared by the API routes. Server-only.
import type { ZodType, ZodTypeDef } from "zod";

export const jsonError = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  Response.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Read a JSON body (≤ maxBytes) and validate it. Returns the parsed value or a ready-made error Response. */
export async function readBody<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>, maxBytes = 10_000): Promise<{ ok: true; data: T; raw: Record<string, unknown> } | { ok: false; res: Response }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, res: jsonError(413, `Body over ${maxBytes} bytes.`) };
  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, res: jsonError(413, `Body over ${maxBytes} bytes.`) };
  let raw: unknown = {};
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, res: jsonError(400, "Body is not valid JSON.") };
    }
  }
  const p = schema.safeParse(raw);
  if (!p.success)
    return { ok: false, res: jsonError(400, "Invalid body.", { issues: p.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`) }) };
  return { ok: true, data: p.data, raw: (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown> };
}
