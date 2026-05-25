import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#f9f9f9]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:px-8 md:py-24">
        <section className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm md:grid-cols-[1.4fr_0.9fr] md:px-10 md:py-12">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Review Intake
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Launch a review without turning Home into the workflow itself.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Start Review is now the dedicated intake surface for document upload,
              quick evidence checks, metadata-driven project creation, and manual setup.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/start-review"
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Start Review
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
          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                On Start Review
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Upload a project document, run a quick evidence check, carry forward extracted metadata,
                or attach the document to an existing project when a match is detected.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                In Projects
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Return to durable review records, continue saved workspaces, and inspect existing project state.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
