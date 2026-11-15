// /play/lab moved to the home page (/). Old links forward there.
import { redirect } from "next/navigation";

export default function OldLabLink() {
  redirect("/");
}
