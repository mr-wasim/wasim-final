export default function handler(req, res) {
  const fs = require("fs");
  const path = require("path");

  const apiDir = path.join(process.cwd(), "pages", "api");

  function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat && stat.isDirectory()) {
        results = results.concat(getFiles(filePath));
      } else {
        results.push(filePath.replace(process.cwd(), ""));
      }
    });
    return results;
  }

  const files = getFiles(apiDir);
  res.status(200).json({ apiRoutes: files });
}
