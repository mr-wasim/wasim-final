/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    appDir: true,
  },

  // 🔥 Make sure the service worker is served from the root
  async rewrites() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        destination: "/firebase-messaging-sw.js",
      },
    ];
  },

  // 🔥 Give it full-site control
  async headers() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
