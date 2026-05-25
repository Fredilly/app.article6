import { redirect } from "next/navigation";

type ProjectsNewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function appendParams(pathname: string, params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry);
      continue;
    }
    if (typeof value === "string") search.set(key, value);
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default async function NewProjectPage({ searchParams }: ProjectsNewPageProps) {
  redirect(appendParams("/start-review", await searchParams));
}
