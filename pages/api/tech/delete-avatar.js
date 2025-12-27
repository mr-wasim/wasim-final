// pages/api/tech/delete-avatar.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { v2 as cloudinary } from "cloudinary";
import { signToken } from "../../../lib/auth.js";
import { serialize } from "cookie";

cloudinary.config({
  cloud_name: "dewrvzgmt",
  api_key: "834954975913379",
  api_secret: "fss1aZPC_gdZeK09On_pwHBCKhY",
});

async function handler(req, res, tokenUser) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const db = await getDb();
  const techCol = db.collection("technicians");

  // find tech (by id or username)
  let tech = null;
  try {
    tech = await techCol.findOne({ _id: new (require("mongodb").ObjectId)(tokenUser.id) });
  } catch (e) {
    // fallback to username
  }
  if (!tech && tokenUser.username) tech = await techCol.findOne({ username: tokenUser.username });
  if (!tech) return res.status(404).json({ error: "Technician not found" });

  const { public_id } = req.body || {};

  if (public_id) {
    try {
      await cloudinary.uploader.destroy(public_id);
    } catch (err) {
      console.warn("Cloudinary destroy warning:", err?.message || err);
    }
  }

  await techCol.updateOne({ _id: tech._id }, { $set: { avatar: null, avatarPublicId: null, updatedAt: new Date() } });

  const fresh = await techCol.findOne({ _id: tech._id });

  const newPayload = {
    id: fresh._id.toString(),
    username: fresh.username,
    role: fresh.role || "technician",
    avatar: fresh.avatar || null,
    avatarPublicId: fresh.avatarPublicId || null,
  };

  const token = signToken(newPayload);
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    serialize("token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 60 * 60 * 24 * 30,
    })
  );

  return res.status(200).json({ success: true, user: newPayload });
}

export default requireRole("technician")(handler);
