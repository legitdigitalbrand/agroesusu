import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getPaymentService } from "@/lib/payment-provider";
import { PAYMENT_PROVIDER } from "@/lib/payment-provider";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bvn, userId } = body;

    if (!bvn || !userId) {
      return NextResponse.json({ error: "BVN and userId are required" }, { status: 400 });
    }

    if (bvn.length !== 11 || !/^\d{11}$/.test(bvn)) {
      return NextResponse.json({ error: "BVN must be 11 digits" }, { status: 400 });
    }

    // Check if user already verified
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("kyc_status, bvn_hash")
      .eq("id", userId)
      .single();

    if (profile?.kyc_status === "verified") {
      return NextResponse.json({ error: "Identity already verified" }, { status: 400 });
    }

    const crypto = await import("crypto");
    const bvnHash = crypto.createHash("sha256").update(bvn).digest("hex");
    const bvnLast4 = bvn.slice(-4);

    // Use the payment provider abstraction — routes to Paystack or Safe Haven
    const service = await getPaymentService();
    const verificationResult = await service.verifyBVN(bvn);

    // ─── Safe Haven: two-step OTP flow ───
    if (PAYMENT_PROVIDER === 'safehaven') {
      if (verificationResult.raw?.needsOtp) {
        // Store BVN hash + the identityId for the validate step
        await admin.from("profiles").update({
          bvn_last_4: bvnLast4,
          bvn_hash: bvnHash,
          kyc_status: "pending_otp",
        }).eq("id", userId);

        return NextResponse.json({
          status: "pending_otp",
          message: "An OTP has been sent to the phone number registered with your BVN. Enter it to complete verification.",
          identityId: verificationResult.raw.identityId,
        });
      }

      if (verificationResult.status === 'verified') {
        // Direct verification (no OTP needed in some flows)
        const { data: userProfile } = await admin.from("profiles").select("full_name").eq("id", userId).single();
        const registeredName = (userProfile?.full_name || "").toLowerCase().trim();
        const bvnFirstName = (verificationResult.first_name || "").toLowerCase().trim();
        const bvnLastName = (verificationResult.last_name || "").toLowerCase().trim();
        const nameMatched = fuzzyNameMatch(registeredName, bvnFirstName, bvnLastName);

        const kycStatus = nameMatched ? "verified" : "pending_review";

        await admin.from("profiles").update({
          bvn_last_4: bvnLast4,
          bvn_hash: bvnHash,
          bvn_first_name: verificationResult.first_name || "",
          bvn_last_name: verificationResult.last_name || "",
          kyc_status: kycStatus,
          kyc_verified_date: nameMatched ? new Date().toISOString() : null,
        }).eq("id", userId);

        await admin.from("notifications").insert({
          user_id: userId,
          type: "kyc",
          channel: "in_app",
          title: nameMatched ? "Identity Verified" : "Identity Under Review",
          content: nameMatched
            ? "Your BVN has been verified. You can now withdraw your savings."
            : "Your BVN verification is under review. Our team will confirm your identity shortly.",
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

      // Verification failed
      await admin.from("profiles").update({
        bvn_last_4: bvnLast4,
        bvn_hash: bvnHash,
        kyc_status: "pending_review",
      }).eq("id", userId);

      return NextResponse.json({
        status: "pending_review",
        message: "BVN verification could not be completed automatically. Your BVN has been submitted for manual review.",
      });
    }

    // ─── Paystack: single-call flow (existing behavior preserved) ───
    if (verificationResult.status === 'pending_review') {
      // Paystack's BVN lookup requires account-level activation we don't have yet
      console.error("BVN lookup unavailable (Paystack feature not activated)");
      await admin.from("profiles").update({
        bvn_last_4: bvnLast4,
        bvn_hash: bvnHash,
        kyc_status: "pending_review",
      }).eq("id", userId);

      await admin.from("notifications").insert({
        user_id: userId,
        type: "kyc",
        channel: "in_app",
        title: "Identity Under Review",
        content: "We've received your BVN. Automated verification isn't live yet, so our team will confirm it manually and unlock withdrawals shortly.",
        status: "unread",
        metadata: { kyc_status: "pending_review" },
      });

      return NextResponse.json({
        status: "pending_review",
        message: "Automated BVN verification isn't live yet — your BVN has been submitted for manual review. We'll unlock withdrawals as soon as it's confirmed.",
      });
    }

    if (verificationResult.status === 'failed') {
      return NextResponse.json({
        error: "BVN verification failed. Please check your BVN and try again.",
      }, { status: 400 });
    }

    // Verified — name matching
    const bvnFirstName = (verificationResult.first_name || "").toLowerCase().trim();
    const bvnLastName = (verificationResult.last_name || "").toLowerCase().trim();
    const { data: userProfile } = await admin.from("profiles").select("full_name").eq("id", userId).single();
    const registeredName = (userProfile?.full_name || "").toLowerCase().trim();
    const nameMatched = fuzzyNameMatch(registeredName, bvnFirstName, bvnLastName);
    const kycStatus = nameMatched ? "verified" : "pending_review";

    await admin.from("profiles").update({
      bvn_last_4: bvnLast4,
      bvn_hash: bvnHash,
      bvn_first_name: verificationResult.first_name || "",
      bvn_last_name: verificationResult.last_name || "",
      kyc_status: kycStatus,
      kyc_verified_date: nameMatched ? new Date().toISOString() : null,
    }).eq("id", userId);

    await admin.from("notifications").insert({
      user_id: userId,
      type: "kyc",
      channel: "in_app",
      title: nameMatched ? "Identity Verified" : "Identity Under Review",
      content: nameMatched
        ? "Your BVN has been verified. You can now withdraw your savings."
        : "Your BVN verification is under review. Our team will confirm your identity shortly.",
      status: "unread",
      metadata: { kyc_status: kycStatus, provider: "paystack" },
    });

    return NextResponse.json({
      status: kycStatus,
      message: nameMatched
        ? "Identity verified successfully. Withdrawals unlocked."
        : "Your BVN name doesn't match your registered name. Your account is under review — you can still save, but withdrawals will be unlocked after review.",
      bvn_first_name: verificationResult.first_name,
      bvn_last_name: verificationResult.last_name,
    });
  } catch (error) {
    console.error("BVN verification error:", error);
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 });
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
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
