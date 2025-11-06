/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  async rewrites() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        destination: "/_next/static/firebase-messaging-sw.js",
      },
    ];
  },
  webpack: (config) => {
    config.plugins.push({
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap("CopyFirebaseSW", (compilation) => {
          const fs = require("fs");
          const path = require("path");
          const from = path.resolve("./public/firebase-messaging-sw.js");
          const to = path.resolve("./.next/static/firebase-messaging-sw.js");
          if (fs.existsSync(from)) {
            fs.copyFileSync(from, to);
          }
        });
      },
    });
    return config;
  },
};

module.exports = nextConfig;
