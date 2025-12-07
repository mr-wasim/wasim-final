// pages/api/admin/all-customers.js
export const runtime = "nodejs";

import { getDb, requireRole } from "../../../lib/api-helpers.js";

async function handler(req, res, user) {
  if (req.method !== "GET")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    let {
      page = "1",
      pageSize = "20",
      search = "",
      from = "",
      to = "",
    } = req.query;

    const db = await getDb();
    const coll = db.collection("forwarded_calls");

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limit;

    const match = {};

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      match.$or = [
        { clientName: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }

    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        match.createdAt = { ...(match.createdAt || {}), $gte: fromDate };
      }
    }

    if (to) {
      const toDate = new Date(`${to}T23:59:59.999`);
      if (!Number.isNaN(toDate.getTime())) {
        match.createdAt = { ...(match.createdAt || {}), $lte: toDate };
      }
    }

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
                clientName: 1,
                customerName: 1,
                phone: 1,
                address: 1,
                type: 1,
                serviceType: 1,
                price: { $ifNull: ["$price", 0] },
                createdAt: 1,
                serviceDate: 1,
                techName: 1, // set when insert
                technicianName: 1,
                techUsername: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await coll.aggregate(pipeline).toArray();
    const items = result?.items || [];
    const total = result?.total?.[0]?.count || 0;

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      success: true,
      items,
      total,
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    console.error("all-customers error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("admin")(handler);

/**
 * Mongo index (shell):
 * db.forwarded_calls.createIndex({
 *   createdAt: -1,
 *   clientName: 1,
 *   customerName: 1,
 *   phone: 1,
 *   address: 1
 * });
 */
