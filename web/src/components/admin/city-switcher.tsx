import Link from "next/link";

import { CITIES, type CityCode } from "@/lib/cities";
import { cn } from "@/lib/utils";

/**
 * Which city the Admin Portal is reporting on.
 *
 * Server-rendered links rather than a dropdown: the city is part of the URL, so
 * a view can be bookmarked, shared with a colleague, or opened in two tabs side
 * by side. For an operations tool that is worth more than a slicker control.
 */
export function CitySwitcher({
  active,
  basePath,
}: {
  active: CityCode;
  /** The page these links should stay on, e.g. "/admin/demand". */
  basePath: string;
}) {
  return (
    <nav aria-label="Select city" className="flex flex-wrap gap-1.5">
      {CITIES.map((city) => (
        <Link
          key={city.code}
          href={`${basePath}?city=${city.code}`}
          aria-current={city.code === active ? "page" : undefined}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            city.code === active
              ? "border-primary bg-primary-soft text-primary"
              : "border-border-base text-muted hover:bg-surface-2 hover:text-fg"
          )}
        >
          {city.name}
        </Link>
      ))}
    </nav>
  );
}
