import Link from "next/link";

type PublicReadinessPageProps = Readonly<{
  page: "sample-assessment" | "how-it-works";
}>;

export default function PublicReadinessPage({ page }: PublicReadinessPageProps) {
  const sample = page === "sample-assessment";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8 md:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pre-validation evidence readiness</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            {sample ? "See the kind of evidence gaps Article6 surfaces." : "Find the evidence gaps before your validator does."}
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Article6 reviews project documentation against applicable methodology requirements to identify missing, unclear, and unsupported evidence before validation begins.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Start a Quick Check
            </Link>
            {sample ? (
              <Link href="/how-it-works" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400">
                How it works
              </Link>
            ) : (
              <Link href="/sample-assessment" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400">
                View sample assessment
              </Link>
            )}
          </div>
        </div>

        <section className="mt-14 grid gap-4 md:grid-cols-3" aria-label={sample ? "Sample assessment outcomes" : "How Article6 works"}>
          {(sample
            ? [
                ["Missing", "Evidence expected by the applicable requirements is not present in the project documentation."],
                ["Unclear", "Related material exists, but it does not clearly support the claim or requirement."],
                ["Unsupported", "A statement appears in the document without a traceable source or sufficient detail."],
              ]
            : [
                ["1. Upload", "Provide a project document such as a PDD and identify the methodology and version."],
                ["2. Review", "Article6 checks the document against the applicable methodology requirements."],
                ["3. Prepare", "Use the findings to resolve evidence gaps before validation begins."],
              ]
          ).map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </section>

        <p className="mt-8 max-w-3xl text-sm leading-6 text-slate-500">
          Results depend on the project documentation and methodology requirements provided. Article6 does not claim universal methodology coverage; VM0007 v1.8 is one existing sample methodology.
        </p>
      </div>
    </main>
  );
}
