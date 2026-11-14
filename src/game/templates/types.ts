// src/game/templates/types.ts: what every template gets from GameRunner.
// Templates contain no content (05 intro): every question, choice and "why" comes from the worksheet.
import type { ComponentType } from "react";
import type { TQuestion } from "@/lib/schema";
import type { LockResult, Phase } from "../store";

export type TemplateProps = {
  question: TQuestion;
  phase: Phase;
  paused: boolean;
  /** Call once at LOCK-IN. GameRunner ignores calls outside the play phase. */
  onLock: (r: LockResult) => void;
};

export type TemplateDef = {
  /** 3D content, rendered inside the shared Arena <Canvas>. */
  Scene?: ComponentType<TemplateProps>;
  /** DOM layer (targets, labels), rendered above the canvas. */
  Overlay: ComponentType<TemplateProps>;
  /** Gesture hint copy (07 §3). */
  hint: (q: TQuestion) => string;
};
