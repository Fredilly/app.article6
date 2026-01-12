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
}): PackMeta {
  return {
    kind: "article6.pack_meta",
    version: 1,
    generated_at: new Date().toISOString(),
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
