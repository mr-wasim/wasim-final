import { requireRole, getDb } from "../../../lib/api-helpers.js";
import Papa from "papaparse";

/* -------------------------------------------------------
   🔍 MATCH FILTER BUILDER
------------------------------------------------------- */
function buildMatch({ q, status, tech, dateFrom, dateTo }) {
  const match = {};

  // Search filtering
  if (q) {
    const regex = new RegExp(q, "i");
    match.$or = [
      { clientName: regex },
      { phone: regex },
      { address: regex },
    ];
  }

  // Status filter
  if (status) match.status = status;

  // Technician filter
  if (tech) match.techUsername = tech;

  // Date range filter
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) match.createdAt.$lte = new Date(dateTo + "T23:59:59");
  }

  return match;
}

/* -------------------------------------------------------
   🔰 MAIN HANDLER
------------------------------------------------------- */
async function handler(req, res, user) {
  try {
    const db = await getDb();
    const coll = db.collection("service_forms");

    const {
      q = "",
      status = "",
      tech = "",
      dateFrom = "",
      dateTo = "",
      page = 1,
      csv,
    } = req.query;

    const match = buildMatch({ q, status, tech, dateFrom, dateTo });

    /* -------------------------------------------------------
       📌 Ensure Indexes
    ------------------------------------------------------- */
    coll.createIndex({ createdAt: -1 });
    coll.createIndex({ clientName: "text", phone: "text", address: "text" });
    coll.createIndex({ techUsername: 1 });
    coll.createIndex({ status: 1 });

    /* -------------------------------------------------------
       📤 CSV EXPORT (SIGNATURE INCLUDED)
    ------------------------------------------------------- */
    if (csv === "1") {
      const items = await coll
        .find(match)     // signature included
        .sort({ createdAt: -1 })
        .toArray();

      const csvText = Papa.unparse(items, { fastMode: true });

      return res.status(200).json({
        csv: csvText,
      });
    }

    /* -------------------------------------------------------
       📥 PAGINATED LIST FETCH (SIGNATURE INCLUDED)
    ------------------------------------------------------- */
    const limit = 20;
    const skip = (Number(page) - 1) * limit;

    const [items, total] = await Promise.all([
      coll
        .find(match)   // signature included
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),

      coll.countDocuments(match),
    ]);

    /* -------------------------------------------------------
       📦 RESPONSE
    ------------------------------------------------------- */
    res.setHeader("Cache-Control", "no-store");

    res.status(200).json({
      items: items.map((x) => ({
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

/* -------------------------------------------------------
   🚀 EXPORT WITH ADMIN ROLE CHECK
------------------------------------------------------- */
export default requireRole("admin")(handler);
