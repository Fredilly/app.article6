type ResetOptions = {
  currentHash?: string | null;
  nextHash?: string | null;
  resetDerived?: boolean;
};

export function shouldResetDerivedState(options: ResetOptions): boolean {
  if (typeof options.resetDerived === "boolean") return options.resetDerived;
  if (!options.currentHash || !options.nextHash) return true;
  return options.currentHash !== options.nextHash;
}
