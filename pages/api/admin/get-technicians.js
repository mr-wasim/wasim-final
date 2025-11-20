import { getDb, requireRole } from "../../../lib/api-helpers.js";

export default requireRole("admin")(async (req, res) => {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();

    let technicians = await db
      .collection("technicians")
      .find({})
      .sort({ username: 1 })
      .toArray();

    // Normalize properly
    technicians = technicians.map((t) => ({
      ...t,
      _id: t._id.toString(),
      name: t.username || "Unknown Technician", // IMPORTANT FIX
    }));

    return res.status(200).json({ success: true, data: technicians });
  } catch (err) {
    console.error("❌ GET TECHNICIANS ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
