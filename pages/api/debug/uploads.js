// pages/api/debug/uploads.js
// DEBUG ROUTE — tells exactly where files are going & which exist

import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const cwd = process.cwd();

    const pathsToCheck = [
      path.join(cwd, "public", "uploads", "stickers"),
      path.join(cwd, "public", "uploads"),
      "/var/www/chimney-uploads/stickers",
      "/var/www/chimney-uploads",
    ];

    const report = pathsToCheck.map((p) => {
      let exists = false;
      let files = [];
      try {
        exists = fs.existsSync(p);
        if (exists) {
          files = fs.readdirSync(p).slice(-10); // last 10 files only
        }
      } catch (e) {
        files = [`ERROR: ${e.message}`];
      }

      return {
        path: p,
        exists,
        files,
      };
    });

    return res.status(200).json({
      success: true,
      cwd,
      nodeEnv: process.env.NODE_ENV,
      report,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message,
    });
  }
}
