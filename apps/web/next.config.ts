import type { NextConfig } from "next";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// Dev-only: without this, the dev server's HMR websocket (and any other
// cross-origin dev asset request) is rejected when the page is loaded from a
// LAN IP instead of localhost — the page itself still renders, only hot
// reload breaks. Not needed in production. Set DEV_LAN_HOST to the machine's
// current LAN IP (it changes across networks) to re-enable HMR from other
// devices; harmless to leave unset.
const devLanHost = process.env.DEV_LAN_HOST;

// First-party rewrite so the session cookie is same-origin (Build Plan §6.2).
const nextConfig: NextConfig = {
  ...(devLanHost ? { allowedDevOrigins: [devLanHost] } : {}),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
