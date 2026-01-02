import type { ReactNode } from "react";

type FinderShellProps = {
  left: ReactNode;
  right: ReactNode;
};

export default function FinderShell({ left, right }: FinderShellProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section className="w-full lg:w-5/12">{left}</section>
      <section className="w-full lg:flex-1">{right}</section>
    </div>
  );
}
