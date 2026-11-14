// Which data path the app is on. Both values are NEXT_PUBLIC_* (inlined at build),
// so server and client always agree.
//   offline: `OFFLINE=1 npm run build` (next.config.ts maps OFFLINE → NEXT_PUBLIC_OFFLINE)
//   mock:    default until Merge 1; set NEXT_PUBLIC_MOCK=0 to go live
export type Mode = "live" | "offline" | "mock";

export function getMode(): Mode {
  if (process.env.NEXT_PUBLIC_OFFLINE === "1") return "offline";
  return process.env.NEXT_PUBLIC_MOCK === "0" ? "live" : "mock";
}
