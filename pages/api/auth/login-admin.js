import { ensureAdminSeed, signToken } from "../../../lib/auth.js";
import { getDb } from "../../../lib/api-helpers.js";
import bcrypt from "bcryptjs";
import { serialize } from "cookie";


export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  // ensure admin exists
  await ensureAdminSeed();

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const db = await getDb();

  // ✅ make sure collection name matches seed script
  const admin = await db.collection("users").findOne({ username }); // changed from "admins" to "users"

  if (!admin) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ✅ check password field name (use correct one from seed-admin.js)
  const ok = await bcrypt.compare(password, admin.password);

  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // generate JWT
  const token = signToken({
    role: "admin",
    username,
    id: admin._id.toString(),
  });

  // set cookie
  res.setHeader(
  "Set-Cookie",
  serialize("token", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
);


  res.json({ ok: true });
}
