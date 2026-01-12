export type PackMeta = {
  kind: "article6.pack_meta";
  version: 1;
  generated_at: string;
  exporter: {
    name: "app.article6";
    export_format_version: 1;
  };
  provenance: {
    repo: string;
    commit: string;
  };
  method: { code: string; version: string };
};

export function makePackMeta(args: {
  methodCode: string;
  version: string;
  repo: string;
  commit: string;
  generated_at: string;
}): PackMeta {
  return {
    kind: "article6.pack_meta",
    version: 1,
    generated_at: args.generated_at,
    exporter: {
      name: "app.article6",
      export_format_version: 1,
    },
    provenance: {
      repo: args.repo,
      commit: args.commit,
    },
    method: { code: args.methodCode, version: args.version },
  };
}
