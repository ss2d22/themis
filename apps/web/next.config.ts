import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@covenant/sdk"],
  reactStrictMode: true,
  devIndicators: false,
};

export default config;
