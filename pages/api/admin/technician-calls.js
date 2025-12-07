// pages/api/admin/technician-calls.js
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

    let { month = "", techId = "" } = req.query;

    // Resolve month range
    let start, end;
    if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map((n) => parseInt(n, 10));
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 1, 0, 0, 0, 0);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    }

    // base match for closed calls
    const baseMatch = { status: "Closed" };

    const techCandidates = [];
    if (techId && typeof techId === "string") {
      techCandidates.push(techId);
      if (ObjectId.isValid(techId)) techCandidates.push(new ObjectId(techId));
    }

    if (techCandidates.length) {
      baseMatch.techId = { $in: techCandidates };
    }

    // Month-specific match
    const monthMatch = {
      ...baseMatch,
      createdAt: { $gte: start, $lt: end },
    };

    // ---- Aggregation: per-tech month stats ----
    const monthStatsArr = await callsColl
      .aggregate([
        { $match: { status: "Closed", createdAt: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: "$techId",
            monthClosed: { $sum: 1 },
            monthAmount: { $sum: { $ifNull: ["$price", 0] } },
          },
        },
      ])
      .toArray();

    const monthMap = new Map();
    monthStatsArr.forEach((row) => {
      const key = String(row._id);
      monthMap.set(key, {
        monthClosed: row.monthClosed || 0,
        monthAmount: row.monthAmount || 0,
      });
    });

    // ---- Aggregation: per-tech lifetime stats ----
    const lifetimeStatsArr = await callsColl
      .aggregate([
        { $match: { status: "Closed" } },
        {
          $group: {
            _id: "$techId",
            totalClosed: { $sum: 1 },
            totalAmount: { $sum: { $ifNull: ["$price", 0] } },
          },
        },
      ])
      .toArray();

    const lifetimeMap = new Map();
    lifetimeStatsArr.forEach((row) => {
      const key = String(row._id);
      lifetimeMap.set(key, {
        totalClosed: row.totalClosed || 0,
        totalAmount: row.totalAmount || 0,
      });
    });

    // ---- Summary for selected filter (month + lifetime) ----
    const monthSummaryArr = await callsColl
      .aggregate([
        { $match: monthMatch },
        {
          $group: {
            _id: null,
            monthClosed: { $sum: 1 },
            monthAmount: { $sum: { $ifNull: ["$price", 0] } },
          },
        },
      ])
      .toArray();

    const lifetimeSummaryArr = await callsColl
      .aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalClosed: { $sum: 1 },
            totalAmount: { $sum: { $ifNull: ["$price", 0] } },
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

    // ---- Technician list ----
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
          },
        }
      )
      .sort({ name: 1 })
      .toArray();

    const technicians = techDocs.map((t) => {
      const key = String(t._id);
      const monthStat = monthMap.get(key) || {
        monthClosed: 0,
        monthAmount: 0,
      };
      const lifeStat = lifetimeMap.get(key) || {
        totalClosed: 0,
        totalAmount: 0,
      };

      const displayName =
        t.name || t.fullName || t.techName || t.username || "Unnamed";

      return {
        _id: key,
        name: displayName,
        username: t.username || "",
        phone: t.phone || "",
        monthClosed: monthStat.monthClosed,
        monthAmount: monthStat.monthAmount,
        totalClosed: lifeStat.totalClosed,
        totalAmount: lifeStat.totalAmount,
      };
    });

    // ---- Calls list for selected tech + month ----
    let calls = [];
    if (techCandidates.length) {
      calls = await callsColl
        .aggregate([
          { $match: monthMatch },
          { $sort: { createdAt: -1 } },
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
              closedAt: "$createdAt",
              createdAt: 1,
            },
          },
          { $limit: 200 }, // enough for per-month
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
 * Recommended indexes (mongo shell):
 * db.forwarded_calls.createIndex({ status: 1, techId: 1, createdAt: -1 });
 * db.technicians.createIndex({ name: 1 });
 */
