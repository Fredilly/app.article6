import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#f9f9f9]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:px-8 md:py-24">
        <section className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-10 md:py-12">
          <div className="max-w-2xl">
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Review carbon project documents faster.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Upload a PDD, monitoring report, or evidence file. Article6 extracts
              project metadata, identifies the method, and helps prepare a
              review-ready project record.
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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">
                Start from document
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Upload a PDD or monitoring report and turn extracted metadata
                into a project draft.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">
                Run a quick check
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Check one document against a methodology before creating a full
                project record.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">
                Continue a review
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Open saved projects, evidence maps, and review records.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
