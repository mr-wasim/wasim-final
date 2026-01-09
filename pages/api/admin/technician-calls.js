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
    const paymentsColl = db.collection("payments"); // assumed collection name

    // query params
    let { month = "", techId = "", dateFrom = "", dateTo = "" } = req.query;

    // build tech filter
    const techCandidates = [];
    if (techId && typeof techId === "string" && techId !== "all") {
      techCandidates.push(techId);
      if (ObjectId.isValid(techId)) techCandidates.push(new ObjectId(techId));
    }

    // Resolve date window: prefer dateFrom/dateTo if provided, otherwise month
    let start, end;
    if (dateFrom && dateTo) {
      // date inputs are in YYYY-MM-DD
      start = new Date(dateFrom + "T00:00:00.000Z");
      end = new Date(new Date(dateTo + "T00:00:00.000Z").getTime() + 24 * 3600 * 1000);
    } else if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map((n) => parseInt(n, 10));
      start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    } else {
      const now = new Date();
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0));
    }

    // Helper: tech filter object for mongo match
    const techFilter =
      techCandidates.length > 0 ? { techId: { $in: techCandidates } } : {};

    // We'll treat "closeDate" as closedAt if present else createdAt
    // --- Aggregation: per-tech month stats (closed calls, sums from payments) ---
    const monthMatch = {
      status: "Closed",
      $expr: {
        $and: [
          {
            $gte: [
              {
                $ifNull: ["$closedAt", "$createdAt"],
              },
              start,
            ],
          },
          {
            $lt: [
              {
                $ifNull: ["$closedAt", "$createdAt"],
              },
              end,
            ],
          },
        ],
      },
      ...techFilter,
    };

    const monthStatsArr = await callsColl
      .aggregate([
        { $match: monthMatch },
        // lookup payments for each call, sum
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
                  paidSum: { $sum: { $ifNull: ["$amount", 0] } },
                },
              },
            ],
            as: "payment_sum",
          },
        },
        {
          $addFields: {
            paymentTotal: { $ifNull: [{ $arrayElemAt: ["$payment_sum.paidSum", 0] }, 0] },
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
    monthStatsArr.forEach((r) => {
      monthMap.set(String(r._id), {
        monthClosed: r.monthClosed || 0,
        monthAmount: r.monthAmount || 0,
      });
    });

    // ---- Aggregation: per-tech lifetime stats (closed) ----
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
                  paidSum: { $sum: { $ifNull: ["$amount", 0] } },
                },
              },
            ],
            as: "payment_sum",
          },
        },
        {
          $addFields: {
            paymentTotal: { $ifNull: [{ $arrayElemAt: ["$payment_sum.paidSum", 0] }, 0] },
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
    lifetimeStatsArr.forEach((r) => {
      lifetimeMap.set(String(r._id), {
        totalClosed: r.totalClosed || 0,
        totalAmount: r.totalAmount || 0,
      });
    });

    // ---- Per-tech pending/cancelled counts (month & lifetime) ----
    // month pending/cancelled
    const monthPendingArr = await callsColl
      .aggregate([
        {
          $match: {
            status: "Pending",
            $expr: {
              $and: [
                {
                  $gte: [{ $ifNull: ["$createdAt", "$$NOW"] }, start],
                },
                {
                  $lt: [{ $ifNull: ["$createdAt", "$$NOW"] }, end],
                },
              ],
            },
            ...techFilter,
          },
        },
        {
          $group: {
            _id: "$techId",
            monthPending: { $sum: 1 },
            monthPendingAmount: { $sum: { $ifNull: ["$price", 0] } },
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
            totalPendingAmount: { $sum: { $ifNull: ["$price", 0] } },
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

    // ---- Summary top-level (month + lifetime) ----
    // month summary (closed)
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
              { $group: { _id: null, paidSum: { $sum: { $ifNull: ["$amount", 0] } } } },
            ],
            as: "payment_sum",
          },
        },
        {
          $addFields: {
            paymentTotal: { $ifNull: [{ $arrayElemAt: ["$payment_sum.paidSum", 0] }, 0] },
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

    // lifetime summary (closed)
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
              { $group: { _id: null, paidSum: { $sum: { $ifNull: ["$amount", 0] } } } },
            ],
            as: "payment_sum",
          },
        },
        {
          $addFields: {
            paymentTotal: { $ifNull: [{ $arrayElemAt: ["$payment_sum.paidSum", 0] }, 0] },
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

    // ---- Technicians list (with avatar & per-tech stats merged) ----
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

    // ---- Calls list for selected tech + period (all statuses) ----
    let calls = [];
    if (techCandidates.length) {
      // match by tech and date window on createdAt (so pending/cancelled appear)
      const callsMatch = {
        techId: { $in: techCandidates },
        $expr: {
          $and: [
            { $gte: ["$createdAt", start] },
            { $lt: ["$createdAt", end] },
          ],
        },
      };

      calls = await callsColl
        .aggregate([
          { $match: callsMatch },
          { $sort: { createdAt: -1 } },
          // lookup payments per call
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
              paymentTotal: { $sum: { $map: { input: "$payments", as: "p", in: { $ifNull: ["$$p.amount", 0] } } } },
              closedAt: { $ifNull: ["$closedAt", "$createdAt"] },
              price: { $ifNull: ["$price", 0] },
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
 * Notes / recommended indexes:
 * db.forwarded_calls.createIndex({ techId: 1, status: 1, createdAt: -1, closedAt: -1 });
 * db.payments.createIndex({ callId: 1 });
 * db.technicians.createIndex({ name: 1 });
 *
 * Assumptions: payments collection has fields: callId (ObjectId or string), amount (number), paidAt (date), status.
 * If your payments collection uses different field names, rename them inside the $lookup match/project.
 */
