import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:px-8 md:py-20">
        <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10 md:py-14">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Review carbon project documents faster.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Upload a PDD, monitoring report, or evidence file. Article6 extracts project metadata,
              identifies the method, and helps prepare a review-ready project record.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/quick-check"
                className="inline-flex items-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-900"
              >
                Quick Check
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                Open Projects
              </Link>
              <Link
                href="/methods"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                Browse Methods
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Check a document</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload a PDD, monitoring report, or evidence file and see what Article6 can extract.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Create a project draft</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use extracted metadata to start a project record with reviewer confirmation.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Continue review work</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Open saved projects, evidence maps, rule reviews, and exportable records.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
