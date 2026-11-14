// src/game/templates/types.ts: what every template gets from GameRunner.
// Templates contain no content (05 intro): every question, choice and "why" comes from the worksheet.
import type { ComponentType } from "react";
import type { TQuestion, TWorksheet } from "@/lib/schema";
import type { LockResult, Phase } from "../store";

export type TemplateProps = {
  question: TQuestion;
  /** For the misconception registry (labels for ghost trails etc.). */
  worksheet: TWorksheet;
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
  /** Gesture hint copy (07 §3). Templates with sub-phases read the store to pick their line. */
  hint: (q: TQuestion) => string;
  /** Where the avatar stands for this template (default: centre, behind the action). */
  avatar?: { position: [number, number, number]; scale: number };
  /** Keep the camera still for the whole question (no sway), e.g. when aiming. */
  still?: boolean;
};
