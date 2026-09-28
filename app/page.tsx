import { redirect } from "next/navigation";
import { initialEvent } from "@/lib/event";
import { cleanAttribution, utmKeys } from "@/lib/attribution";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const attribution = cleanAttribution(await searchParams);
  const query = new URLSearchParams();
  for (const key of utmKeys)
    if (attribution[key]) query.set(key, attribution[key]);
  redirect(
    "/event/" + initialEvent.slug + (query.size ? "?" + query.toString() : ""),
  );
}
