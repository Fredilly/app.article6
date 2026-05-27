import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#f9f9f9]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:px-8 md:py-24">
        <section className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-10 md:py-12">
          <div className="max-w-2xl">
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Find readiness gaps before formal review.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Upload a PDD, monitoring report, or evidence file. Article6 extracts
              project metadata, identifies the method, and helps developers
              see missing evidence, weak support, and recommended fixes before
              pre-verification handoff.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/start-review"
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Open Quick Check
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400"
              >
                Open Projects
              </Link>
              <Link
                href="/methods"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400"
              >
                Browse Methods
              </Link>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">
                Quick Check
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Use the first document scan to identify the likely methodology,
                missing evidence, and the next readiness step.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">
                Projects
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Keep a readiness workspace with uploaded evidence, linked rules,
                and the top items that still need follow-up.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">
                Methods and Exports
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Use methodology rules as the source of truth, then export a
                readiness gap report when the project is ready for follow-up.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
