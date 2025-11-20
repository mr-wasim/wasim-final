export default function handler(req, res) {
  const fs = require("fs");
  const path = require("path");

  const dir = path.join(process.cwd(), "pages", "api", "admin");

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));

  return res.status(200).json({
    success: true,
    routes: files.map((file) => ({
      file,
      exists: true,
      apiRoute: "/api/admin/" + file.replace(".js", ""),
    })),
  });
}
