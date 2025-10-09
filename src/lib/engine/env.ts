const DEFAULT_ENGINE_URL = "https://engine.article6.org/query";
const DEFAULT_ENGINE_TAG = "rich-cards-v1";

export type EngineDefaults = {
  engineUrl: string;
  publicEngineUrl: string;
  engineTag: string;
};

export function ensureEngineDefaults(): EngineDefaults {
  const engineUrl = (process.env.ENGINE_URL || process.env.NEXT_PUBLIC_ENGINE_URL || DEFAULT_ENGINE_URL).trim();
  const engineTag = (process.env.NEXT_PUBLIC_ENGINE_TAG || process.env.ENGINE_TAG || DEFAULT_ENGINE_TAG).trim();

  return {
    engineUrl,
    publicEngineUrl: engineUrl,
    engineTag,
  };
}
