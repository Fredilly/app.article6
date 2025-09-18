"use client";

import { FormEvent } from "react";
import { ArrowRight } from "lucide-react";

interface QueryFormProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  value: string;
}

export default function QueryForm({ disabled, onChange, onSubmit, value }: QueryFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:gap-4"
      onSubmit={handleSubmit}
    >
      <label className="flex-1 text-sm">
        <span className="sr-only">Query text</span>
        <input
          aria-label="Query text"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-black focus:ring-2 focus:ring-black/10"
          disabled={Boolean(disabled)}
          onChange={event => onChange(event.target.value)}
          placeholder="e.g. carbon fraction 44/12"
          value={value}
        />
      </label>
      <button
        className="flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
        disabled={Boolean(disabled)}
        type="submit"
      >
        <span>Search</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
