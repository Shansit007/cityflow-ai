import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/** Shown for any URL that does not exist. */
export default function NotFound() {
  return (
    <section className="py-24">
      <Container width="narrow" className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          Page not found
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">
          This route does not exist
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted">
          The page you were looking for may have moved, or the link may be out of date.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/how-it-works" variant="outline">
            How CityFlow AI works
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
