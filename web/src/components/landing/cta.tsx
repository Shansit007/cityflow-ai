import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Closing call to action.
 * Deliberately restrained — a public-service tone, not a sales pitch.
 */
export function ClosingCta() {
  return (
    <section className="pb-8">
      <Container width="wide">
        <div className="overflow-hidden rounded-card border border-border-base bg-brand-solid px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="text-balance text-2xl font-semibold text-white sm:text-3xl">
            Find out when you should leave tomorrow
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            Create an account, tell CityFlow AI your regular travel routine, and get a
            departure-time recommendation you can understand — and ignore, if you want to.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/signup" variant="outline" size="lg">
              Create your account
            </ButtonLink>
            <ButtonLink
              href="/how-it-works"
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/10"
            >
              Read how it works
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
