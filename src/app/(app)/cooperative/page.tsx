import { redirect } from "next/navigation";

// Redirect /cooperative (singular) → /cooperatives (plural)
// The canonical route is /cooperatives
export default function CooperativePage() {
  redirect("/cooperatives");
}
