import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth/admin";
import { isCityCode } from "@/lib/cities";
import {
  MunicipalAccessAccountNotFoundError,
  MunicipalAccessAdminAccountError,
  grantMunicipalAccess,
  revokeMunicipalAccess,
} from "@/lib/admin/municipal-access";
import {
  fieldErrorsFrom,
  grantMunicipalAccessSchema,
  revokeMunicipalAccessSchema,
} from "@/lib/validation";

/**
 * Admin-managed Municipal Dashboard access.
 *
 *   POST   /api/admin/municipal-access  -> { officer }   grant (or move city)
 *   DELETE /api/admin/municipal-access  -> { revoked }   back to a commuter
 *
 * Only a signed-in ADMIN can reach either handler -- see
 * lib/admin/municipal-access.ts for the full reasoning, including why an
 * ADMIN account itself can never be granted or revoked from here.
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

  const parsed = grantMunicipalAccessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
      { status: 400 }
    );
  }

  if (!isCityCode(parsed.data.cityCode)) {
    return NextResponse.json(
      { error: "Choose a city from the list.", fieldErrors: { cityCode: "Choose a city from the list." } },
      { status: 400 }
    );
  }

  try {
    const officer = await grantMunicipalAccess({
      email: parsed.data.email,
      cityCode: parsed.data.cityCode,
    });
    return NextResponse.json({ officer }, { status: 200 });
  } catch (error) {
    if (error instanceof MunicipalAccessAccountNotFoundError) {
      return NextResponse.json(
        { error: error.message, fieldErrors: { email: error.message } },
        { status: 404 }
      );
    }
    if (error instanceof MunicipalAccessAdminAccountError) {
      return NextResponse.json(
        { error: error.message, fieldErrors: { email: error.message } },
        { status: 409 }
      );
    }

    console.error("[admin municipal-access POST] failed:", error);
    return NextResponse.json(
      { error: "Could not grant municipal access right now." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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

  const parsed = revokeMunicipalAccessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
      { status: 400 }
    );
  }

  try {
    const revoked = await revokeMunicipalAccess(parsed.data.email);
    return NextResponse.json({ revoked });
  } catch (error) {
    if (error instanceof MunicipalAccessAccountNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("[admin municipal-access DELETE] failed:", error);
    return NextResponse.json(
      { error: "Could not revoke municipal access right now." },
      { status: 500 }
    );
  }
}
