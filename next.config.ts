// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Let the build succeed even if ESLint finds issues
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;