// server.js
// Custom Next.js server using Express that serves persistent uploads directory.
// Place this at project root and run with: NODE_ENV=production node server.js

const express = require("express");
const next = require("next");
const path = require("path");
const fs = require("fs");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// PERSISTENT UPLOADS PATH — make sure this folder exists on the VPS
// This path is outside the project build and will persist across deploys.
const UPLOADS_DIR = "/var/www/chimney-uploads";

app.prepare().then(() => {
  const server = express();

  // Ensure uploads folder exists (best-effort)
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      console.log("Created uploads dir:", UPLOADS_DIR);
    }
  } catch (e) {
    console.warn("Could not ensure uploads dir:", e.message || e);
  }

  // Serve /uploads/* from the persistent folder (cache long)
  server.use(
    "/uploads",
    express.static(UPLOADS_DIR, {
      maxAge: "365d",
      immutable: true,
    })
  );

  // Any other requests -> Next.js
  server.all("*", (req, res) => {
    return handle(req, res);
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT} (dev=${dev})`);
    console.log(`> Serving uploads from ${UPLOADS_DIR}`);
  });
});
