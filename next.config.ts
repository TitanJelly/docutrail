import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @react-pdf/renderer must not be webpack-bundled for the server.
  // It uses Node.js-only APIs (fs, canvas) and has its own React reconciler.
  serverExternalPackages: ['@react-pdf/renderer'],
}

export default nextConfig
