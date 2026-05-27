import Link from "next/link";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9f9f9] px-4 py-16 md:px-8">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
          Know what is missing before verification
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
          Upload a project document. Article6 checks it against carbon methodology requirements and shows missing evidence, weak support, and the next fixes before you spend money on formal review.
        </p>
        <Link
          href="/start-review"
          className="mt-10 inline-flex items-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Start Quick Check
        </Link>
      </section>
    </main>
  );
}
