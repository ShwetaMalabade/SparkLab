"use client";
// /play/dev/lab: walk the chemistry building (WASD / arrows). Enter = walk into the lit room.
import { useState } from "react";
import { LabWorld, ROOMS, type RoomId } from "@/three/lab/LabWorld";

export default function LabDevPage() {
  const [target, setTarget] = useState<RoomId>("mix");
  const [done, setDone] = useState<RoomId[]>([]);
  return (
    <div className="fixed inset-0 bg-navy">
      <LabWorld
        target={target}
        done={done}
        onArrive={(r) => {
          setDone((d) => [...d, r]);
          const next = ROOMS.find((x) => x.id !== r && !done.includes(x.id));
          setTimeout(() => next && setTarget(next.id), 800);
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-violet/50 bg-navy/85 px-5 py-2 text-lg">
        🧠 Coach: next stop — <b>{ROOMS.find((r) => r.id === target)?.name}</b> · WASD / arrows to walk · Enter to go there
      </div>
    </div>
  );
}
