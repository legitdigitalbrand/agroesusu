import { redirect } from "next/navigation";

// Credit score details have been moved to /dev/loans (admin only).
// Customers see a simple eligibility summary on the loans page itself.
export default function CreditScorePage() {
  redirect("/loans");
}
