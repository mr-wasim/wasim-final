/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Experimental features (keep appDir true if you're using app directory)
  experimental: {
    appDir: true,
  },

  // ✅ Ensure service worker works from the root scope
  async headers() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: "/", // allow SW to control entire site
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate", // prevent stale SW
          },
        ],
      },
    ];
  },

  // ✅ Optional: explicitly include public files in output
  output: "standalone",
};

module.exports = nextConfig;
