// Landing (docs/plan/07 §2 screen 1, 06 §1): the class exists BEFORE the scan,
// so the QR + code are already on screen when the judge picks up their phone.
import { Landing } from "./_landing/Landing";

export default function Home() {
  return <Landing />;
}
