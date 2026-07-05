import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

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

    // Call Paystack BVN verification
    const crypto = await import("crypto");
    const bvnHash = crypto.createHash("sha256").update(bvn).digest("hex");
    const bvnLast4 = bvn.slice(-4);

    const response = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve_bvn/${bvn}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      console.error("BVN verification failed:", data);
      return NextResponse.json({
        error: data.message || "BVN verification failed. Please check your BVN and try again.",
      }, { status: 400 });
    }

    const bvnData = data.data;
    const bvnFirstName = (bvnData.first_name || "").toLowerCase().trim();
    const bvnLastName = (bvnData.last_name || "").toLowerCase().trim();
    const bvnFullName = `${bvnFirstName} ${bvnLastName}`.trim();

    // Get the user's registered name
    const { data: userProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const registeredName = (userProfile?.full_name || "").toLowerCase().trim();

    // Fuzzy name matching — check if first name or last name from BVN appears in registered name
    const nameMatched = fuzzyNameMatch(registeredName, bvnFirstName, bvnLastName);

    const kycStatus = nameMatched ? "verified" : "pending_review";

    // Update profile — store only last 4 + hash, never full BVN
    await admin
      .from("profiles")
      .update({
        bvn_last_4: bvnLast4,
        bvn_hash: bvnHash,
        bvn_first_name: bvnData.first_name || "",
        bvn_last_name: bvnData.last_name || "",
        kyc_status: kycStatus,
        kyc_verified_date: nameMatched ? new Date().toISOString() : null,
      })
      .eq("id", userId);

    // Create notification
    await admin.from("notifications").insert({
      user_id: userId,
      type: "kyc",
      channel: "in_app",
      title: nameMatched ? "Identity Verified" : "Identity Under Review",
      content: nameMatched
        ? "Your BVN has been verified. You can now withdraw your savings."
        : "Your BVN verification is under review. Our team will confirm your identity shortly.",
      status: "unread",
      metadata: { kyc_status: kycStatus },
    });

    return NextResponse.json({
      status: kycStatus,
      message: nameMatched
        ? "Identity verified successfully. Withdrawals unlocked."
        : "Your BVN name doesn't match your registered name. Your account is under review — you can still save, but withdrawals will be unlocked after review.",
      bvn_first_name: bvnData.first_name,
      bvn_last_name: bvnData.last_name,
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

  // Check if any BVN name part matches any registered name part
  for (const bvnName of bvnNames) {
    for (const regPart of regParts) {
      if (regPart.length >= 3 && bvnName.length >= 3) {
        // Exact match
        if (regPart === bvnName) return true;
        // One contains the other (handles middle name differences)
        if (regPart.includes(bvnName) || bvnName.includes(regPart)) return true;
        // Levenshtein distance for typos (distance <= 2)
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
