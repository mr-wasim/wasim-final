import { signToken } from "../../../lib/auth.js";
import { getDb } from "../../../lib/api-helpers.js";
import bcrypt from "bcryptjs";
import { serialize } from "cookie";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // body read + auto trim (important)
    const username = (req.body?.username || "").trim();
    const password = (req.body?.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const db = await getDb();

    // 👉 your real admin is in "admins" collection
    const admin = await db.collection("admins").findOne({ username });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 👉 password field in DB = passwordHash
    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // JWT
    const token = signToken({
      id: admin._id.toString(),
      username: admin.username,
      role: "admin",
    });

    // cookie
    res.setHeader(
      "Set-Cookie",
      serialize("token", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      })
    );

    return res.status(200).json({ ok: true, message: "Login successful" });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
