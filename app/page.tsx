import { redirect } from "next/navigation";

/** הצ'אט הוא מסך הבית — הרשימה עברה ל-/list */
export default function Home() {
  redirect("/ai");
}
