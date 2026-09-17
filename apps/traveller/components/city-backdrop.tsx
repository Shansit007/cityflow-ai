import { Landmark, hasLandmark } from "@/components/landmark";

/**
 * The city, behind the page.
 *
 * Fixed rather than scrolled with the content, so the photograph stays put and the page
 * moves over it. The image sits at a low opacity directly on the surface colour instead
 * of under a translucent scrim: a scrim tinted with a CSS variable has to be mixed at
 * runtime, and `dark:` in Tailwind follows the device rather than this app's own theme
 * control, so both would drift out of step with the toggle in the header.
 *
 * Drop a photograph at public/city/<code>.jpg and it is used. Without one, the city's
 * landmark line drawing stands in, so the app never looks unfinished while waiting on an
 * asset. docs/attribution.md records the licence for every photograph here; one without
 * a licence that permits redistribution does not belong in a public repository.
 */
export function CityBackdrop({ city }: { city: string }) {
  const code = city.toLowerCase();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(/city/${code}.jpg)`, opacity: 0.13 }}
      />

      {hasLandmark(city) ? (
        <Landmark
          city={city}
          className="absolute right-[-4%] bottom-[-6%] w-[46%] max-w-3xl text-[var(--ink)] opacity-[0.06]"
        />
      ) : null}
    </div>
  );
}
