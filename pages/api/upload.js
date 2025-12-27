// pages/api/upload.js
import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import os from "os";
import path from "path";

export const config = { api: { bodyParser: false } };

cloudinary.config({
  cloud_name:  "dewrvzgmt",
  api_key: "834954975913379",
  api_secret: "fss1aZPC_gdZeK09On_pwHBCKhY",
});

const parseForm = (req) =>
  new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024,
    });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });

function safeUnlink(p) {
  if (!p) return;
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* ignore */ }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { files } = await parseForm(req);
    if (!files || Object.keys(files).length === 0) return res.status(400).json({ error: "No file received" });

    let file = null;
    if (files.file) file = Array.isArray(files.file) ? files.file[0] : files.file;
    else if (files.avatar) file = Array.isArray(files.avatar) ? files.avatar[0] : files.avatar;
    else {
      const keys = Object.keys(files);
      const v = files[keys[0]];
      file = Array.isArray(v) ? v[0] : v;
    }

    if (!file) return res.status(400).json({ error: "File field missing" });

    let filepath = file.filepath || file.path || file.tempFilePath || null;
    let createdTemp = false;

    if (!filepath && file?.buffer) {
      const name = file.originalFilename || `upload-${Date.now()}.jpg`;
      filepath = path.join(os.tmpdir(), `upload-${Date.now()}-${name}`);
      fs.writeFileSync(filepath, file.buffer);
      createdTemp = true;
    }

    if (!filepath || !fs.existsSync(filepath)) {
      return res.status(400).json({ error: "Uploaded file not available on disk" });
    }

    // upload to Cloudinary
    let result;
    try {
      result = await cloudinary.uploader.upload(filepath, {
        folder: "technician_avatars",
        resource_type: "image",
        transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }],
      });
    } catch (err) {
      safeUnlink(filepath);
      console.error("Cloudinary upload failed:", err);
      return res.status(500).json({ error: "Cloudinary upload failed", message: err?.message || String(err) });
    }

    safeUnlink(filepath);
    if (createdTemp) safeUnlink(filepath);

    return res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id,
      raw: result,
    });
  } catch (err) {
    console.error("UPLOAD HANDLER ERROR:", err);
    return res.status(500).json({ error: "Upload failed", message: err?.message || String(err) });
  }
}
