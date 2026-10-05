import { NextResponse } from "next/server";
// Contact presentation is resolved by the server, never a recruiter preference.
export async function POST() {
  return NextResponse.json(
    { error: "Profile presentation is selected automatically." },
    { status: 405, headers: { "Cache-Control": "no-store" } },
  );
}
