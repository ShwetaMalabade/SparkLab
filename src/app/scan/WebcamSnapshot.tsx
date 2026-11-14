"use client";
// Take one still of the worksheet with the laptop webcam. The frame is only used for this upload.
import { useEffect, useRef, useState } from "react";

export function WebcamSnapshot({ onCapture, onClose }: { onCapture: (b: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setError("This browser can't open the camera. Choose a photo instead."));
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("Couldn't open the camera. Allow camera access, or choose a photo instead."));
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.92);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Webcam snapshot" className="fixed inset-0 z-40 flex items-center justify-center bg-navy/90 p-6">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-3xl border border-line bg-panel p-5">
        {error ? (
          <p className="text-coral">✗ {error}</p>
        ) : (
          <video ref={video} autoPlay playsInline muted className="aspect-video w-full rounded-2xl bg-black object-contain" />
        )}
        <p className="text-sm text-muted">Hold the page flat and fill the frame. Avoid glare.</p>
        <div className="flex gap-3">
          {!error && (
            <button type="button" onClick={capture} className="rounded-xl bg-cyan px-5 py-2 font-bold text-navy">
              Capture
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-5 py-2 font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
