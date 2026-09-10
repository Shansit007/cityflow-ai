/**
 * Promote an existing account to the Admin Portal.
 *
 *   npm run admin:create -- you@example.com
 *
 * WHY A SCRIPT RATHER THAN A SIGN-UP OPTION
 * If "make me an admin" were a checkbox on the registration form, anyone could
 * tick it. Admin rights are granted from the machine that owns the database,
 * which is the only place that can prove it is the project team.
 *
 * The account must already exist — sign up normally first, then run this.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("\nUsage:  npm run admin:create -- you@example.com\n");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, cityflowId: true, role: true },
  });

  if (!user) {
    console.error(
      `\nNo account found for "${email}".\n` +
        `Sign up on the website first, then run this again.\n`
    );
    process.exit(1);
  }

  if (user.role === "ADMIN") {
    console.log(`\n"${email}" is already an admin (${user.cityflowId}).\n`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });

  console.log(
    `\n✔ "${email}" (${user.cityflowId}) is now an admin.\n\n` +
      `IMPORTANT: sign out and sign in again before opening /admin.\n` +
      `Your login cookie still says "USER" until you get a new one.\n`
  );
}

main()
  .catch((error) => {
    console.error("\nCould not update the account:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
