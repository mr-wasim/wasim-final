// pages/api/tech/upload-sticker.js
// WARNING: This file contains hardcoded credentials. DO NOT COMMIT to a public repo.
// Best-effort progressive compression: multiple upload attempts with increasingly aggressive transforms.
// It will delete previous attempts so only the final saved image remains.

import { v2 as cloudinary } from "cloudinary";

// ----------------------
// HARDCODED CREDENTIALS (from your message)
// ----------------------
const CLOUD_NAME = "dewrvzgmt";
const API_KEY = "834954975913379";
const API_SECRET = "fss1aZPC_gdZeK09On_pwHBCKhY";

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

// Increase body limit to accept large camera images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

// Helper: safe destroy (ignore errors)
async function safeDestroy(publicId) {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (e) {
    // ignore
    console.warn("Safe destroy failed:", e?.message || e);
  }
}

// Main handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { imageBase64, targetKB } = req.body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ success: false, error: "Image not received" });
    }

    // target bytes (default ~6 KB)
    const TARGET_BYTES = (Number(targetKB) || 6) * 1024;

    // progressive transforms: from mild -> very aggressive
    // We will attempt these in order, stopping when result.bytes <= TARGET_BYTES
    // Each entry is an object describing the transformation to try.
    const attempts = [
      // attempt 0: mild (keep quality auto eco)
      { width: 300, quality: "auto:eco", flags: "lossy", fetch_format: "auto" },
      // attempt 1: smaller width, low numeric quality
      { width: 180, quality: "20", flags: "lossy", fetch_format: "auto" },
      // attempt 2: very small width + lower quality
      { width: 120, quality: "12", flags: "lossy", fetch_format: "auto" },
      // attempt 3: ultra small + very low quality
      { width: 96, quality: "8", flags: "lossy", fetch_format: "auto" },
      // attempt 4: extreme (may be very low visual quality)
      { width: 64, quality: "6", flags: "lossy", fetch_format: "auto" },
    ];

    let lastResult = null;
    let lastPublicId = null;
    let attemptIndex = 0;

    for (const a of attempts) {
      attemptIndex++;

      // Build upload options for this attempt
      const uploadOptions = {
        folder: "chimney_stickers",
        resource_type: "image",
        format: "webp",
        transformation: [
          { width: a.width, crop: "limit" },
          { quality: a.quality, flags: a.flags },
        ],
        fetch_format: a.fetch_format || "auto",
        // strip metadata
        exif: false,
        faces: false,
      };

      // Upload
      let result;
      try {
        result = await cloudinary.uploader.upload(imageBase64, uploadOptions);
      } catch (uploadErr) {
        // If Cloudinary fails for some reason on this attempt, try next attempt after logging
        console.warn(`Upload attempt ${attemptIndex} failed:`, uploadErr?.message || uploadErr);
        // If there was a previous uploaded public id, try to destroy it to avoid leftovers
        if (result && result.public_id) await safeDestroy(result.public_id);
        // continue to next attempt
        continue;
      }

      // record
      lastResult = result;
      lastPublicId = result.public_id;

      // If result.bytes is not available, break and return what we have
      const bytes = Number(result.bytes || 0);

      // If size meets target, stop and return
      if (bytes > 0 && bytes <= TARGET_BYTES) {
        return res.status(200).json({
          success: true,
          url: result.secure_url,
          public_id: result.public_id,
          sizeKB: Math.round(bytes / 1024),
          rawBytes: bytes,
          attempts: attemptIndex,
          note: "Reached target size",
        });
      }

      // If not meeting target and this is not the last attempt, delete this upload and continue
      // (we will re-upload with more aggressive options)
      const isLastAttempt = attempts.indexOf(a) === attempts.length - 1;
      if (!isLastAttempt) {
        // delete current asset to avoid clutter
        await safeDestroy(result.public_id);
        lastResult = null;
        lastPublicId = null;
        // continue loop
      } else {
        // last attempt completed and still not under target — return best we could get
        return res.status(200).json({
          success: true,
          url: result.secure_url,
          public_id: result.public_id,
          sizeKB: Math.round(bytes / 1024),
          rawBytes: bytes,
          attempts: attemptIndex,
          note: "Final attempt done; could not reach target but returned most compressed image",
        });
      }
    }

    // Fallback (shouldn't reach here)
    if (lastResult) {
      const bytes = Number(lastResult.bytes || 0);
      return res.status(200).json({
        success: true,
        url: lastResult.secure_url,
        public_id: lastResult.public_id,
        sizeKB: Math.round(bytes / 1024),
        rawBytes: bytes,
        attempts: attemptIndex,
        note: "Finished attempts",
      });
    } else {
      return res.status(500).json({ success: false, error: "All upload attempts failed" });
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Cloudinary upload failed",
    });
  }
}
