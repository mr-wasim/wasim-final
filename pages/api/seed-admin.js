import clientPromise from "../../lib/mongodb";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const existing = await db.collection("users").findOne({ username: "admin" });
    if (existing) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash("Chimneysolution@123#", 10);

    await db.collection("users").insertOne({
      username: "admin",
      password: hashedPassword,
      role: "admin",
      createdAt: new Date(),
    });

    res.json({ message: "Admin created successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error seeding admin" });
  }
}
