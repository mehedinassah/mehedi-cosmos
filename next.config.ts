import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to THIS project. Without it, Next walks up and finds
  // the stray D:\Projects\package-lock.json, warns about "multiple lockfiles",
  // and may infer the wrong root for output file tracing.
  outputFileTracingRoot: path.join(__dirname),
  // GLSL modules imported as raw strings
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
