import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { fieldErrorsFrom, loginSchema } from "@/lib/validation";

/**
 * POST /api/auth/login
 *
 * Request body:  { email, password }
 * Success (200): { cityflowId, displayName, onboardingCompleted, role }
 * Failure (401): { error } — deliberately vague, see the note below.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        displayName: true,
        cityflowId: true,
        onboardingCompleted: true,
        role: true,
      },
    });

    /**
     * SECURITY NOTE
     * We return exactly the same message whether the email does not exist or
     * the password is wrong. Otherwise this endpoint would let anyone check
     * which email addresses are registered with CityFlow AI.
     */
    const invalidCredentials = NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );

    if (!user) return invalidCredentials;

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) return invalidCredentials;

    await startSession({
      userId: user.id,
      cityflowId: user.cityflowId,
      role: user.role,
    });

    return NextResponse.json({
      cityflowId: user.cityflowId,
      displayName: user.displayName,
      onboardingCompleted: user.onboardingCompleted,
      role: user.role,
    });
  } catch (error) {
    console.error("[login] failed:", error);
    return NextResponse.json(
      { error: "We could not sign you in right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
