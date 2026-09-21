import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth/admin";
import { isCityCode } from "@/lib/cities";
import { sendAdminNotification } from "@/lib/admin/notifications";
import { adminNotificationSchema, fieldErrorsFrom } from "@/lib/validation";

/**
 * POST /api/admin/notifications
 *
 * Sends (records — see the model comment for why "demo delivery") a notice
 * to one city. Every row is attributed to the admin who sent it.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = adminNotificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (!isCityCode(data.cityCode)) {
    return NextResponse.json({ error: "Unknown city." }, { status: 400 });
  }

  try {
    const notification = await sendAdminNotification({
      cityCode: data.cityCode,
      title: data.title,
      message: data.message,
      createdByEmail: admin.email,
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error("[admin notifications POST] failed:", error);
    return NextResponse.json(
      { error: "Could not send that notice right now." },
      { status: 500 }
    );
  }
}
