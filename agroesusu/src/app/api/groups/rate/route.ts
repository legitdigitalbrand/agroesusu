import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { group_id, ratee_id, rating } = await request.json();
    const ratingValue = Number(rating);

    if (!group_id || !ratee_id || !ratingValue || ratingValue < 1 || ratingValue > 5) {
      return NextResponse.json({ error: "A rating between 1 and 5 is required" }, { status: 400 });
    }

    if (ratee_id === user.id) {
      return NextResponse.json({ error: "You can't rate yourself" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: raterMembership } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", group_id)
      .eq("user_id", user.id)
      .single();

    const { data: rateeMembership } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", group_id)
      .eq("user_id", ratee_id)
      .single();

    if (!raterMembership || !rateeMembership) {
      return NextResponse.json({ error: "Both users must be members of this group" }, { status: 403 });
    }

    // Upsert-like: RLS insert-only, so delete any prior rating from this rater→ratee pair first
    await admin
      .from("member_ratings")
      .delete()
      .eq("group_id", group_id)
      .eq("rater_id", user.id)
      .eq("ratee_id", ratee_id);

    const { error: insertError } = await supabase.from("member_ratings").insert({
      group_id,
      rater_id: user.id,
      ratee_id,
      rating: ratingValue,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Recompute the ratee's reliability_rating for this group as the average
    // of all ratings received, scaled from 1-5 to 20-100.
    const { data: allRatings } = await admin
      .from("member_ratings")
      .select("rating")
      .eq("group_id", group_id)
      .eq("ratee_id", ratee_id);

    const avg =
      (allRatings || []).reduce((sum, r) => sum + r.rating, 0) / (allRatings?.length || 1);
    const scaledRating = Math.round(avg * 20);

    await admin
      .from("group_members")
      .update({ reliability_rating: scaledRating })
      .eq("group_id", group_id)
      .eq("user_id", ratee_id);

    return NextResponse.json({ status: "ok", newRating: scaledRating });
  } catch (error: any) {
    console.error("Rate member error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
