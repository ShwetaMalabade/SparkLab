// Turn code's flag strings into sentences a teacher reads in one glance.
import type { TQuestion } from "@/lib/schema";

export function flagText(flag: string, q: TQuestion): string {
  const unit = q.answer.unit ? ` ${q.answer.unit}` : "";
  const key = flag.match(/^answer_key_mismatch:([^>]+)->(.+)$/);
  if (key) return `Answer key says ${key[1]}${unit}. Code computes ${key[2]}${unit}. Using ${key[2]}${unit}.`;
  if (flag === "low_confidence_read") return "The AI wasn't sure it read this question correctly. Check the numbers.";
  if (flag === "template_fallback") return "Shown as answer balloons: the 3D lab couldn't honestly simulate this one.";
  if (flag.startsWith("critic_block")) return `Hidden by the reviewer: ${flag.split(":").slice(1).join(":").trim()}`;
  return flag;
}

export const TEMPLATE: Record<TQuestion["template"], { icon: string; label: string }> = {
  projectile_launcher: { icon: "🎯", label: "Projectile Launcher" },
  mix_lab: { icon: "🧪", label: "Mix Lab" },
  equation_balancer: { icon: "⚖️", label: "Equation Balancer" },
  answer_balloons: { icon: "🎈", label: "Answer Balloons" },
};
