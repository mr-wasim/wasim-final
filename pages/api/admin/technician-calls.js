export const runtime = "nodejs";

import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

async function handler(req, res, user) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const db = await getDb();
    const callsColl = db.collection("forwarded_calls");
    const techsColl = db.collection("technicians");
    const paymentsColl = db.collection("payments"); // assumed

    let { month = "", techId = "", dateFrom = "", dateTo = "" } = req.query;

    // build tech candidates
    const techCandidates = [];
    if (techId && typeof techId === "string" && techId !== "all") {
      techCandidates.push(techId);
      if (ObjectId.isValid(techId)) techCandidates.push(new ObjectId(techId));
    }

    // date window
    let start, end;
    if (dateFrom && dateTo) {
      start = new Date(dateFrom + "T00:00:00.000Z");
      end = new Date(new Date(dateTo + "T00:00:00.000Z").getTime() + 24 * 3600 * 1000);
    } else if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map((n) => parseInt(n, 10));
      // use UTC to avoid TZ surprises
      start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    } else {
      const now = new Date();
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0));
    }

    const techFilter = techCandidates.length > 0 ? { techId: { $in: techCandidates } } : {};

    // === month stats (Closed) with payments cast to double ===
    const monthMatch = {
      status: "Closed",
      $expr: {
        $and: [
          { $gte: [{ $ifNull: ["$closedAt", "$createdAt"] }, start] },
          { $lt: [{ $ifNull: ["$closedAt", "$createdAt"] }, end] },
        ],
      },
      ...techFilter,
    };

    const monthStatsArr = await callsColl
      .aggregate([
        { $match: monthMatch },
        // lookup payments and cast amounts to double
        {
          $lookup: {
            from: "payments",
            let: { callId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: "$callId" }, { $toString: "$$callId" }],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  paidSum: {
                    $sum: { $toDouble: { $ifNull: ["$amount", 0] } },
                  },
                },
              },
            ],
            as: "payment_sum",
          },
        },
        {
          $addFields: {
            paymentTotal: {
              $ifNull: [{ $arrayElemAt: ["$payment_sum.paidSum", 0] }, 0],
            },
          },
        },
        {
          $group: {
            _id: "$techId",
            monthClosed: { $sum: 1 },
            monthAmount: { $sum: "$paymentTotal" },
          },
        },
      ])
      .toArray();

    const monthMap = new Map();
    monthStatsArr.forEach((row) => {
      monthMap.set(String(row._id), {
        monthClosed: row.monthClosed || 0,
        monthAmount: row.monthAmount || 0,
      });
    });

    // === lifetime stats (Closed) ===
    const lifetimeStatsArr = await callsColl
      .aggregate([
        { $match: { status: "Closed", ...techFilter } },
        {
          $lookup: {
            from: "payments",
            let: { callId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: "$callId" }, { $toString: "$$callId" }],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  paidSum: {
                    $sum: { $toDouble: { $ifNull: ["$amount", 0] } },
                  },
                },
              },
            ],
            as: "payment_sum",
          },
        },
        {
          $addFields: {
            paymentTotal: {
              $ifNull: [{ $arrayElemAt: ["$payment_sum.paidSum", 0] }, 0],
            },
          },
        },
        {
          $group: {
            _id: "$techId",
            totalClosed: { $sum: 1 },
            totalAmount: { $sum: "$paymentTotal" },
          },
        },
      ])
      .toArray();

    const lifetimeMap = new Map();
    lifetimeStatsArr.forEach((row) => {
      lifetimeMap.set(String(row._id), {
        totalClosed: row.totalClosed || 0,
        totalAmount: row.totalAmount || 0,
      });
    });

    // === pending counts (month/lifetime) using price cast to double ===
    const monthPendingArr = await callsColl
      .aggregate([
        {
          $match: {
            status: "Pending",
            $expr: {
              $and: [
                { $gte: [{ $ifNull: ["$createdAt", "$$NOW"] }, start] },
                { $lt: [{ $ifNull: ["$createdAt", "$$NOW"] }, end] },
              ],
            },
            ...techFilter,
          },
        },
        {
          $group: {
            _id: "$techId",
            monthPending: { $sum: 1 },
            monthPendingAmount: { $sum: { $toDouble: { $ifNull: ["$price", 0] } } },
          },
        },
      ])
      .toArray();

    const monthPendingMap = new Map();
    monthPendingArr.forEach((r) => {
      monthPendingMap.set(String(r._id), {
        monthPending: r.monthPending || 0,
        monthPendingAmount: r.monthPendingAmount || 0,
      });
    });

    const lifetimePendingArr = await callsColl
      .aggregate([
        {
          $match: {
            status: "Pending",
            ...techFilter,
          },
        },
        {
          $group: {
            _id: "$techId",
            totalPending: { $sum: 1 },
            totalPendingAmount: { $sum: { $toDouble: { $ifNull: ["$price", 0] } } },
          },
        },
      ])
      .toArray();

    const lifetimePendingMap = new Map();
    lifetimePendingArr.forEach((r) => {
      lifetimePendingMap.set(String(r._id), {
        totalPending: r.totalPending || 0,
        totalPendingAmount: r.totalPendingAmount || 0,
      });
    });

    // === top-level summary (month + lifetime) ===
    const monthSummaryArr = await callsColl
      .aggregate([
        { $match: monthMatch },
        {
          $lookup: {
            from: "payments",
            let: { callId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: "$callId" }, { $toString: "$$callId" }],
                  },
                },
              },
              { $group: { _id: null, paidSum: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } } } },
            ],
            as: "payment_sum",
          },
        },
        {
          $addFields: {
            paymentTotal: {
              $ifNull: [{ $arrayElemAt: ["$payment_sum.paidSum", 0] }, 0],
            },
          },
        },
        {
          $group: {
            _id: null,
            monthClosed: { $sum: 1 },
            monthAmount: { $sum: "$paymentTotal" },
          },
        },
      ])
      .toArray();

    const lifetimeSummaryArr = await callsColl
      .aggregate([
        { $match: { status: "Closed", ...techFilter } },
        {
          $lookup: {
            from: "payments",
            let: { callId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: "$callId" }, { $toString: "$$callId" }],
                  },
                },
              },
              { $group: { _id: null, paidSum: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } } } },
            ],
            as: "payment_sum",
          },
        },
        {
          $addFields: {
            paymentTotal: {
              $ifNull: [{ $arrayElemAt: ["$payment_sum.paidSum", 0] }, 0],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalClosed: { $sum: 1 },
            totalAmount: { $sum: "$paymentTotal" },
          },
        },
      ])
      .toArray();

    const summary = {
      monthClosed: monthSummaryArr[0]?.monthClosed || 0,
      monthAmount: monthSummaryArr[0]?.monthAmount || 0,
      totalClosed: lifetimeSummaryArr[0]?.totalClosed || 0,
      totalAmount: lifetimeSummaryArr[0]?.totalAmount || 0,
    };

    // === technicians list with avatars and merged stats ===
    const techDocs = await techsColl
      .find(
        {},
        {
          projection: {
            _id: 1,
            name: 1,
            fullName: 1,
            techName: 1,
            username: 1,
            phone: 1,
            avatar: 1,
            profileImage: 1,
          },
        }
      )
      .sort({ name: 1 })
      .toArray();

    const technicians = techDocs.map((t) => {
      const key = String(t._id);
      const monthStat = monthMap.get(key) || { monthClosed: 0, monthAmount: 0 };
      const lifeStat = lifetimeMap.get(key) || { totalClosed: 0, totalAmount: 0 };
      const mpending = monthPendingMap.get(key) || { monthPending: 0, monthPendingAmount: 0 };
      const lpending = lifetimePendingMap.get(key) || { totalPending: 0, totalPendingAmount: 0 };

      const displayName = t.name || t.fullName || t.techName || t.username || "Unnamed";

      return {
        _id: key,
        name: displayName,
        username: t.username || "",
        phone: t.phone || "",
        avatar: t.avatar || t.profileImage || "",
        monthClosed: monthStat.monthClosed,
        monthAmount: monthStat.monthAmount,
        totalClosed: lifeStat.totalClosed,
        totalAmount: lifeStat.totalAmount,
        monthPending: mpending.monthPending || 0,
        monthPendingAmount: mpending.monthPendingAmount || 0,
        totalPending: lpending.totalPending || 0,
        totalPendingAmount: lpending.totalPendingAmount || 0,
      };
    });

    // === calls list for selected tech + period (all statuses) ===
    let calls = [];
    if (techCandidates.length) {
      const callsMatch = {
        techId: { $in: techCandidates },
        $expr: {
          $and: [{ $gte: ["$createdAt", start] }, { $lt: ["$createdAt", end] }],
        },
      };

      calls = await callsColl
        .aggregate([
          { $match: callsMatch },
          { $sort: { createdAt: -1 } },
          {
            $lookup: {
              from: "payments",
              let: { callId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [{ $toString: "$callId" }, { $toString: "$$callId" }],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    amount: 1,
                    paidAt: 1,
                    status: 1,
                    txnId: 1,
                  },
                },
              ],
              as: "payments",
            },
          },
          {
            $addFields: {
              paymentTotal: {
                $sum: {
                  $map: {
                    input: "$payments",
                    as: "p",
                    in: { $toDouble: { $ifNull: ["$$p.amount", 0] } },
                  },
                },
              },
              closedAt: { $ifNull: ["$closedAt", "$createdAt"] },
              price: { $toDouble: { $ifNull: ["$price", 0] } },
            },
          },
          {
            $project: {
              _id: { $toString: "$_id" },
              clientName: 1,
              customerName: 1,
              phone: 1,
              address: 1,
              type: 1,
              serviceType: 1,
              price: 1,
              status: 1,
              payments: 1,
              paymentTotal: 1,
              paymentMismatch: { $ne: [{ $ifNull: ["$price", 0] }, { $ifNull: ["$paymentTotal", 0] }] },
              closedAt: 1,
              createdAt: 1,
            },
          },
          { $limit: 1000 },
        ])
        .toArray();
    }

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      success: true,
      technicians,
      summary,
      calls,
    });
  } catch (err) {
    console.error("technician-calls error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("admin")(handler);

/**
 * Recommended indexes:
 * db.forwarded_calls.createIndex({ techId: 1, status: 1, createdAt: -1, closedAt: -1 });
 * db.payments.createIndex({ callId: 1 });
 * db.technicians.createIndex({ name: 1 });
 *
 * NOTE: $toDouble requires MongoDB version that supports it (3.4+ / 4.x+ typically). If your server is older, tell me and I'll provide an alternate conversion.
 */
