import { requireRole, getDb } from "../../../lib/api-helpers.js";
import Papa from "papaparse";

// ✅ Prebuild reusable match filter
function buildMatch({ q, status, tech, dateFrom, dateTo }) {
  const match = {};
  if (q) {
    const regex = new RegExp(q, "i"); // faster than $options each time
    match.$or = [
      { clientName: regex },
      { phone: regex },
      { address: regex },
    ];
  }
  if (status) match.status = status;
  if (tech) match.techUsername = tech;
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) match.createdAt.$lte = new Date(dateTo + "T23:59:59");
  }
  return match;
}

async function handler(req, res, user) {
  try {
    const db = await getDb();
    const coll = db.collection("service_forms");

    const { q = "", status = "", tech = "", dateFrom = "", dateTo = "", page = 1, csv } = req.query;
    const match = buildMatch({ q, status, tech, dateFrom, dateTo });

    // ✅ Ensure indexes (first run only, cached later)
    coll.createIndex({ createdAt: -1 });
    coll.createIndex({ clientName: "text", phone: "text", address: "text" });
    coll.createIndex({ techUsername: 1 });
    coll.createIndex({ status: 1 });

    // ✅ CSV export — fast stream-based
    if (csv === "1") {
      const items = await coll
        .find(match, { projection: { signature: 0 } })
        .sort({ createdAt: -1 })
        .toArray();

      // faster CSV conversion
      const csvText = Papa.unparse(items, { fastMode: true });
      return res.status(200).json({ csv: csvText });
    }

    const limit = 20;
    const skip = (Number(page) - 1) * limit;

    // ✅ Parallel fetch for list + total count
    const [items, total] = await Promise.all([
      coll
        .find(match, { projection: { signature: 0 } }) // no need to send signatures
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      coll.countDocuments(match),
    ]);

    // ✅ Avoid heavy serialization delay
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      items: items.map(x => ({
        ...x,
        _id: x._id.toString(),
      })),
      total,
    });
  } catch (err) {
    console.error("🚨 FastAPI Error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export default requireRole("admin")(handler);
