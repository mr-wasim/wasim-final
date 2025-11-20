// pages/api/forwarded-calls/index.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

const ALLOWED_TABS = new Set(["All Calls", "Today Calls", "Pending", "Completed", "Closed"]);
const PAGE_SIZE = 4;

async function handler(req, res, user) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    let { tab = "All Calls", page = 1 } = req.query;
    tab = String(tab);
    if (!ALLOWED_TABS.has(tab)) tab = "All Calls";

    page = parseInt(page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    const db = await getDb();
    const coll = db.collection("forwarded_calls");

    const techIdCandidates = [user.id];
    if (ObjectId.isValid(user.id)) techIdCandidates.push(new ObjectId(user.id));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const match = { techId: { $in: techIdCandidates } };
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

    const limit = PAGE_SIZE;
    const skip = (page - 1) * limit;

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

                // 🔥 ADDED FIELDS (FIX)
                timeZone: { $ifNull: ["$timeZone", ""] },
                notes: { $ifNull: ["$notes", ""] },
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await coll.aggregate(pipeline).toArray();
    const items = result?.items ?? [];
    const total = result?.total?.[0]?.count ?? 0;

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ success: true, items, total });
  } catch (err) {
    console.error("forwarded-calls error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);
