import type { NextConfig } from "next";

const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },
};

export default nextConfig;
