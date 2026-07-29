import { redirect } from "next/navigation";

// Redirect /cooperatives → /cooperative (canonical route)
export default function CooperativesPage() {
  redirect("/cooperative");
}
