"use client";
// QR to the Live Teacher View, ≥ 220 px so a phone can scan it from about 1 m (docs/plan/07 §2).
import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function ClassQr({ code }: { code: string | null }) {
  const [qr, setQr] = useState<{ code: string; src: string; url: string } | null>(null);

  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/live/${code}`;
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: "#0B1020", light: "#FFFFFF" } })
      .then((src) => setQr({ code, src, url }))
      .catch(() => setQr(null));
  }, [code]);
  const current = qr && qr.code === code ? qr : null; // never show a stale QR for an old code
  const src = current?.src ?? null, url = current?.url ?? "";

  return (
    <aside className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-line bg-panel p-6 text-center shadow-[0_0_60px_-20px_rgb(34_211_238/0.5)]">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted">Teacher view · scan with your phone</p>
      <div className="flex h-[260px] w-[260px] items-center justify-center rounded-2xl bg-white p-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimize
          <img src={src} alt={`QR code for ${url}`} width={244} height={244} className="h-[244px] w-[244px]" />
        ) : (
          <span className="text-navy/60">Creating class…</span>
        )}
      </div>
      <div>
        <p className="text-sm text-muted">Class code</p>
        <p className="font-display text-5xl font-bold tracking-[0.2em] text-cyan">{code ?? "····"}</p>
      </div>
      {url && <p className="break-all text-xs text-muted">{url}</p>}
    </aside>
  );
}
