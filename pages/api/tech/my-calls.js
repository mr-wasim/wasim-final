// pages/api/forwarded-calls/index.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

async function handler(req, res, user) {
  try {
    const { tab = "All Calls", page = 1 } = req.query;
    const db = await getDb();
    const coll = db.collection("forwarded_calls");

    const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const match = { techId };
    switch (tab) {
      case "Today Calls":
        match.createdAt = { $gte: todayStart };
        break;
      case "Pending":
      case "Completed":
      case "Closed":
        match.status = tab;
        break;
      default:
        break;
    }

    const limit = 4;
    const skip = (Number(page) - 1) * limit;

    // 🚀 Single round-trip (items + total) + server-side mapping
    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: { $toString: "$_id" },
                clientName: {
                  $ifNull: [
                    "$clientName",
                    {
                      $ifNull: [
                        "$customerName",
                        {
                          $ifNull: [
                            "$name",
                            { $ifNull: ["$client", { $ifNull: ["$fullName", ""] }] },
                          ],
                        },
                      ],
                    },
                  ],
                },
                phone: { $ifNull: ["$phone", ""] },
                address: { $ifNull: ["$address", ""] },
                type: { $ifNull: ["$type", ""] },
                price: { $ifNull: ["$price", 0] },
                status: { $ifNull: ["$status", "Pending"] },
                createdAt: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await coll.aggregate(pipeline, { allowDiskUse: false }).toArray();
    const items = result?.items ?? [];
    const total = result?.total?.[0]?.count ?? 0;

    // Per-user data → no caching
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({ success: true, items, total });
  } catch (err) {
    console.error("forwarded-calls error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);
