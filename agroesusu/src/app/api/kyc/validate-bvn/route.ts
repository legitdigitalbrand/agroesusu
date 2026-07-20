import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getPaymentService } from "@/lib/payment-provider";

/**
 * BVN OTP Validation — Step 2 of Safe Haven's two-step verification.
 * Only used when PAYMENT_PROVIDER=safehaven.
 * The user receives an OTP via SMS and enters it here.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identityId, otp, userId } = body;

    if (!identityId || !otp || !userId) {
      return NextResponse.json({ error: "identityId, otp, and userId are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("kyc_status, bvn_hash, bvn_last_4").eq("id", userId).single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.kyc_status !== "pending_otp") {
      return NextResponse.json({ error: "No pending OTP verification found. Please start verification again." }, { status: 400 });
    }

    const service = await getPaymentService();

    // Safe Haven service has the validateBVN method
    if (service.provider !== 'safehaven') {
      return NextResponse.json({ error: "OTP validation is only available with Safe Haven provider" }, { status: 400 });
    }

    const { SafeHavenService } = await import("@/lib/safehaven");
    if (!(service instanceof SafeHavenService)) {
      return NextResponse.json({ error: "Provider mismatch" }, { status: 500 });
    }

    const result = await service.validateBVN(identityId, otp);

    if (result.status === 'verified') {
      const { data: userProfile } = await admin.from("profiles").select("full_name").eq("id", userId).single();
      const registeredName = (userProfile?.full_name || "").toLowerCase().trim();
      const bvnFirstName = (result.first_name || "").toLowerCase().trim();
      const bvnLastName = (result.last_name || "").toLowerCase().trim();

      const nameMatched = fuzzyNameMatch(registeredName, bvnFirstName, bvnLastName);
      const kycStatus = nameMatched ? "verified" : "pending_review";

      await admin.from("profiles").update({
        kyc_status: kycStatus,
        bvn_first_name: result.first_name || "",
        bvn_last_name: result.last_name || "",
        kyc_verified_date: nameMatched ? new Date().toISOString() : null,
      }).eq("id", userId);

      await admin.from("notifications").insert({
        user_id: userId,
        type: "kyc",
        channel: "in_app",
        title: nameMatched ? "Identity Verified" : "Identity Under Review",
        content: nameMatched
          ? "Your BVN has been verified via Safe Haven. You can now withdraw your savings."
          : "Your BVN was verified but the name doesn't match. Our team will review shortly.",
        status: "unread",
        metadata: { kyc_status: kycStatus, provider: "safehaven" },
      });

      return NextResponse.json({
        status: kycStatus,
        message: nameMatched
          ? "Identity verified successfully. Withdrawals unlocked."
          : "Your BVN name doesn't match your registered name. Your account is under review.",
      });
    }

    // OTP validation failed
    await admin.from("profiles").update({
      kyc_status: "pending_review",
    }).eq("id", userId);

    return NextResponse.json({
      status: "failed",
      message: "OTP validation failed. Please check the OTP and try again, or contact support.",
    }, { status: 400 });

  } catch (error) {
    console.error("BVN OTP validation error:", error);
    return NextResponse.json({ error: "Validation failed. Please try again." }, { status: 500 });
  }
}

function fuzzyNameMatch(registered: string, bvnFirst: string, bvnLast: string): boolean {
  if (!registered || (!bvnFirst && !bvnLast)) return false;
  const regParts = registered.split(/\s+/);
  const bvnNames = [bvnFirst, bvnLast].filter(Boolean);
  for (const bvnName of bvnNames) {
    for (const regPart of regParts) {
      if (regPart.length >= 3 && bvnName.length >= 3) {
        if (regPart === bvnName) return true;
        if (regPart.includes(bvnName) || bvnName.includes(regPart)) return true;
        if (levenshtein(regPart, bvnName) <= 2) return true;
      }
    }
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}
