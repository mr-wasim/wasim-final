import { getDb } from "../../../lib/api-helpers";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  const db = await getDb();
  const newHash = await bcrypt.hash("Chimneysolution@123#", 10);

  await db.collection("admins").updateOne(
    { username: "admin" },
    { $set: { passwordHash: newHash } }
  );

  return res.json({ ok: true, message: "Admin password reset successful!" });
}
