// Home (/): the 3D chemistry lab building (subject rooms + the Experiments Lab), see ./LabHome.tsx.
// The earlier worksheet landing (time budget, scan, last scan, teacher QR) is no longer linked; its code stays in
// ./_landing, and /scan, /review, /live, /results still work if opened directly.
import { LabHome } from "./LabHome";

export default function Home() {
  return <LabHome />;
}
