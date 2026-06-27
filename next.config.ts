import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Pojistka proti pádu upload requestů — fotky jdou výhradně přes /api/portal/poptavka-fotky/upload
  experimental: {
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
