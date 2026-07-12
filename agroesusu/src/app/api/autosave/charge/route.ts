import { NextResponse } from "next/server";

/**
 * @deprecated Use GET /api/cron/autosave-charge instead.
 * This route is kept to avoid 404s from any cached references.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has moved to GET /api/cron/autosave-charge" },
    { status: 301 }
  );
}
