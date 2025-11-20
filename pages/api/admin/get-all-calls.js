import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

export default requireRole("admin")(async (req, res) => {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();

    const { page = 1, q = "", status = "" } = req.query;
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const filter = {};

    if (q) {
      filter.$or = [
        { clientName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } }
      ];
    }

    if (status) filter.status = status;

    const items = await db
      .collection("forwarded")   // ⭐ REAL COLLECTION
      .aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "technicians",
            localField: "techId",
            foreignField: "_id",
            as: "technician"
          }
        },
        { $unwind: { path: "$technician", preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: pageSize }
      ])
      .toArray();

    const total = await db.collection("forwarded").countDocuments(filter);

    return res.status(200).json({
      success: true,
      items,
      total,
      hasMore: skip + items.length < total
    });

  } catch (err) {
    console.error("❌ GET ALL CALLS ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
 