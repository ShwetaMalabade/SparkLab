// POST /api/ingest — multipart `file` (JPEG ≤ 1.5 MB) + `classCode` (docs/plan/02 §6.4, 03 §5).
// Response: NDJSON, one {step,status,ms?,detail?} line per pipeline step, then a final line:
//   {"worksheet": TWorksheet, "dropped": string[]}   or   {"error": string, "status": 422}
// Bad input is rejected BEFORE streaming with a normal JSON error + HTTP status.
import { ingest, MAX_IMAGE_BYTES } from "@/lib/ingest";
import { normalizeClassCode } from "@/lib/classCode";

export const maxDuration = 60;

const bad = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad(400, "Send multipart form data with a `file` and a `classCode`.");
  }
  const file = form.get("file");
  const classCode = normalizeClassCode(String(form.get("classCode") ?? ""));
  if (!classCode) return bad(400, "Missing or invalid classCode.");
  if (!(file instanceof Blob) || file.size === 0) return bad(400, "Missing image file.");
  if (file.size > MAX_IMAGE_BYTES) return bad(413, "Image is over 1.5 MB. The app resizes photos before upload; try again from the Scan page.");
  const image = new Uint8Array(await file.arrayBuffer());
  if (!(image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff)) return bad(415, "Please send a JPEG (the Scan page converts photos automatically).");

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        const out = await ingest({ image, classCode }, send);
        send(out.ok ? { worksheet: out.worksheet, dropped: out.dropped } : { error: out.error, status: out.status });
      } catch (e) {
        console.error("ingest failed", e);
        send({ error: "Something went wrong while reading the worksheet. Try again, or use the last scan.", status: 500 });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
