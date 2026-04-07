import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Illustration generation has been replaced by the local blueprint preview system."
    },
    { status: 410 }
  );
}
