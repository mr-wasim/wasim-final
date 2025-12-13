import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

export default requireRole("admin")(async (req, res) => {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();

    let { range, start, end } = req.query;
    let dateFilter = {};

    // === MONTH FILTER ===
    if (range === "month") {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      dateFilter = { createdAt: { $gte: first, $lte: last } };
    }

    // === CUSTOM DATE RANGE ===
    if (start && end) {
      dateFilter = {
        createdAt: {
          $gte: new Date(start),
          $lte: new Date(end),
        },
      };
    }

    // === GET TECHNICIANS LIST ===
    let technicians = await db
      .collection("technicians")
      .find({})
      .sort({ username: 1 })
      .toArray();

    technicians = technicians.map((t) => ({
      _id: t._id.toString(),
      name: t.username || "Unknown",
      phone: t.phone || "N/A",
    }));

    // === FETCH ALL CALLS FROM forwarded_calls ===
    const calls = await db.collection("forwarded_calls").find(dateFilter).toArray();

    const stats = {};

    // === GROUP CALLS BY TECHNICIAN ===
    calls.forEach((call) => {
      const techId = call.techId?.toString();

      if (!stats[techId]) {
        stats[techId] = {
          pending: 0,
          closed: 0,
          cancelled: 0,
          totalCalls: 0,
        };
      }

      stats[techId].totalCalls++;

      if (call.status === "Pending") stats[techId].pending++;
      if (call.status === "Closed") stats[techId].closed++;
      if (call.status === "Cancelled") stats[techId].cancelled++;
    });

    // === MERGE TECHNICIAN + THEIR CALL COUNTS ===
    const finalData = technicians.map((t) => ({
      ...t,
      pending: stats[t._id]?.pending || 0,
      closed: stats[t._id]?.closed || 0,
      cancelled: stats[t._id]?.cancelled || 0,
      totalCalls: stats[t._id]?.totalCalls || 0,
    }));

    return res.status(200).json({
      success: true,
      data: finalData,
    });
  } catch (err) {
    console.error("❌ TECHNICIAN SUMMARY ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
