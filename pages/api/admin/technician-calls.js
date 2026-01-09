export const runtime = "nodejs";

import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

function toObjectIdIfPossible(id) {
  try {
    if (ObjectId.isValid(id)) return new ObjectId(id);
  } catch (e) {}
  return id;
}

async function handler(req, res, user) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const db = await getDb();
    const callsColl = db.collection("forwarded_calls");
    const techsColl = db.collection("technicians");
    const paymentsColl = db.collection("payments");

    // Accept month, techId, dateFrom, dateTo
    let { month = "", techId = "", dateFrom = "", dateTo = "" } = req.query;

    // DETERMINE START / END based on dateFrom/dateTo or month (dateFrom/dateTo takes precedence)
    let start, end;
    if (dateFrom || dateTo) {
      // if only one provided, make sensible default bounds
      if (dateFrom) {
        // dateFrom is inclusive from start of day
        start = new Date(dateFrom + "T00:00:00");
      }
      if (dateTo) {
        // dateTo is inclusive until end of day
        end = new Date(dateTo + "T23:59:59.999");
      }
      // if only start given, set end to start + 1 day (so that single day works)
      if (start && !end) {
        const tmp = new Date(start);
        tmp.setDate(tmp.getDate() + 1);
        end = tmp;
      }
      // if only end given, set start to one month before end (reasonable fallback)
      if (!start && end) {
        const tmp = new Date(end);
        tmp.setMonth(tmp.getMonth() - 1);
        start = tmp;
      }
    } else if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map((n) => parseInt(n, 10));
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 1, 0, 0, 0, 0);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    }

    // tech filter accepts both string and ObjectId
    const techCandidates = [];
    if (techId && typeof techId === "string") {
      techCandidates.push(techId);
      const maybeObj = toObjectIdIfPossible(techId);
      if (maybeObj && typeof maybeObj !== "string") techCandidates.push(maybeObj);
    }

    // --- MONTH/LIFETIME STATS FROM forwarded_calls (respecting start/end and tech filter) ---

    // month stats (Closed within start..end)
    const monthStatsArr = await callsColl
      .aggregate([
        {
          $addFields: {
            closedDate: { $ifNull: ["$closedAt", "$createdAt"] },
            priceNum: { $ifNull: ["$price", 0] },
            embeddedPayments: { $ifNull: ["$payments", []] },
          },
        },
        {
          $match: {
            status: "Closed",
            closedDate: { $gte: start, $lt: end },
            ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}),
          },
        },
        {
          $group: {
            _id: "$techId",
            monthClosed: { $sum: 1 },
            monthAmount: { $sum: "$priceNum" },
            monthEmbeddedPaid: {
              $sum: {
                $reduce: {
                  input: "$embeddedPayments",
                  initialValue: 0,
                  in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] },
                },
              },
            },
          },
        },
      ])
      .toArray();

    const monthMap = new Map();
    monthStatsArr.forEach((r) =>
      monthMap.set(String(r._id), {
        monthClosed: r.monthClosed || 0,
        monthAmount: r.monthAmount || 0,
        monthEmbeddedPaid: r.monthEmbeddedPaid || 0,
      })
    );

    // lifetime stats (all-time closed)
    const lifetimeStatsArr = await callsColl
      .aggregate([
        {
          $addFields: {
            priceNum: { $ifNull: ["$price", 0] },
            embeddedPayments: { $ifNull: ["$payments", []] },
          },
        },
        {
          $match: {
            status: "Closed",
            ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}),
          },
        },
        {
          $group: {
            _id: "$techId",
            totalClosed: { $sum: 1 },
            totalAmount: { $sum: "$priceNum" },
            totalEmbeddedPaid: {
              $sum: {
                $reduce: {
                  input: "$embeddedPayments",
                  initialValue: 0,
                  in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] },
                },
              },
            },
          },
        },
      ])
      .toArray();

    const lifetimeMap = new Map();
    lifetimeStatsArr.forEach((r) =>
      lifetimeMap.set(String(r._id), {
        totalClosed: r.totalClosed || 0,
        totalAmount: r.totalAmount || 0,
        totalEmbeddedPaid: r.totalEmbeddedPaid || 0,
      })
    );

    // --- PAYMENTS TOTAL FOR SELECTED RANGE (match with payment.js behavior) ---
    // We'll sum payments where payment.createdAt in [start,end) and techId matches (if provided).
    const paymentsMatch = {
      createdAt: { $gte: start, $lt: end },
      ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}),
    };

    // Note: many payments structure store per-call amounts inside payments.calls items.
    // payment.js sums p.onlineAmount / p.cashAmount at payment-level; keep same logic for monthly total.
    const paymentsMonthAgg = await paymentsColl
      .aggregate([
        { $match: paymentsMatch },
        {
          $group: {
            _id: null,
            online: { $sum: { $ifNull: ["$onlineAmount", 0] } },
            cash: { $sum: { $ifNull: ["$cashAmount", 0] } },
            total: {
              $sum: {
                $add: [{ $ifNull: ["$onlineAmount", 0] }, { $ifNull: ["$cashAmount", 0] }],
              },
            },
          },
        },
      ])
      .toArray();

    const monthPaymentsTotal = paymentsMonthAgg[0] || { online: 0, cash: 0, total: 0 };

    // --- month summary by status (counts / amounts) respecting range ---
    const monthSummaryArr = await callsColl
      .aggregate([
        {
          $addFields: {
            closedDate: { $ifNull: ["$closedAt", "$createdAt"] },
            priceNum: { $ifNull: ["$price", 0] },
          },
        },
        {
          $group: {
            _id: "$status",
            countInMonth: {
              $sum: {
                $cond: [
                  { $and: [{ $gte: ["$closedDate", start] }, { $lt: ["$closedDate", end] }] },
                  1,
                  0,
                ],
              },
            },
            amountInMonth: {
              $sum: {
                $cond: [
                  { $and: [{ $gte: ["$closedDate", start] }, { $lt: ["$closedDate", end] }] },
                  "$priceNum",
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray();

    const monthSummaryByStatus = {};
    monthSummaryArr.forEach((r) => {
      monthSummaryByStatus[r._id || "UNKNOWN"] = {
        count: r.countInMonth || 0,
        amount: r.amountInMonth || 0,
      };
    });

    // lifetime overall closed totals (all-time)
    const lifetimeSummaryArr = await callsColl
      .aggregate([
        { $addFields: { priceNum: { $ifNull: ["$price", 0] } } },
        { $match: { status: "Closed" } },
        {
          $group: {
            _id: null,
            totalClosed: { $sum: 1 },
            totalAmount: { $sum: "$priceNum" },
          },
        },
      ])
      .toArray();

    // technicians list (basic projection)
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
            profilePic: 1,
            bio: 1,
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
        monthEmbeddedPaid: 0,
      };
      const lifeStat = lifetimeMap.get(key) || {
        totalClosed: 0,
        totalAmount: 0,
        totalEmbeddedPaid: 0,
      };

      const displayName = t.name || t.fullName || t.techName || t.username || "Unnamed";

      return {
        _id: key,
        name: displayName,
        username: t.username || "",
        phone: t.phone || "",
        avatar: t.avatar || t.profilePic || null,
        bio: t.bio || "",
        monthClosed: monthStat.monthClosed,
        monthAmount: monthStat.monthAmount,
        monthEmbeddedPaid: monthStat.monthEmbeddedPaid || 0,
        totalClosed: lifeStat.totalClosed,
        totalAmount: lifeStat.totalAmount,
        totalEmbeddedPaid: lifeStat.totalEmbeddedPaid || 0,
      };
    });

    // --- CALLS LIST FOR SELECTED TECH + RANGE (includes accurate submittedAmount by summing payment.calls entries) ---
    let calls = [];
    if (techCandidates.length) {
      const callsPipeline = [
        {
          $addFields: {
            closedDate: { $ifNull: ["$closedAt", "$createdAt"] },
            priceNum: { $ifNull: ["$price", 0] },
            embeddedPayments: { $ifNull: ["$payments", []] },
            callIdStr: { $toString: "$_id" },
          },
        },
        {
          $match: {
            techId: { $in: techCandidates },
            closedDate: { $gte: start, $lt: end },
          },
        },
        { $sort: { closedDate: -1 } },

        // lookup payments where payments.calls contains this call id
        {
          $lookup: {
            from: "payments",
            let: { callIdStr: "$callIdStr" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: { $ifNull: ["$calls", []] },
                            as: "pc",
                            cond: { $eq: [{ $toString: "$$pc.callId" }, "$$callIdStr"] },
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
              // project calls (per-call breakdown) and createdAt, mode, receiver etc.
              {
                $project: {
                  _id: 1,
                  createdAt: 1,
                  mode: 1,
                  receiver: 1,
                  techId: 1,
                  calls: {
                    $map: {
                      input: { $ifNull: ["$calls", []] },
                      as: "c",
                      in: {
                        callId: { $toString: "$$c.callId" },
                        onlineAmount: { $ifNull: ["$$c.onlineAmount", 0] },
                        cashAmount: { $ifNull: ["$$c.cashAmount", 0] },
                        clientName: "$$c.clientName",
                        phone: "$$c.phone",
                        address: "$$c.address",
                      },
                    },
                  },
                },
              },
            ],
            as: "paymentDocs",
          },
        },

        // compute submitted amount by summing matching calls' online+cash inside paymentDocs
        {
          $project: {
            _id: { $toString: "$_id" },
            techId: { $toString: "$techId" },
            clientName: 1,
            customerName: 1,
            phone: 1,
            address: 1,
            type: 1,
            serviceType: 1,
            status: 1,
            price: "$priceNum",
            createdAt: 1,
            closedAt: 1,
            closedDate: 1,
            embeddedPayments: 1,
            paymentDocs: 1,
            embeddedPaid: {
              $reduce: {
                input: "$embeddedPayments",
                initialValue: 0,
                in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] },
              },
            },
            // SUM per matching call entries inside each paymentDoc.calls
            paidFromPaymentsCollection: {
              $reduce: {
                input: {
                  $map: {
                    input: "$paymentDocs",
                    as: "pd",
                    in: {
                      $reduce: {
                        input: {
                          $filter: {
                            input: { $ifNull: ["$$pd.calls", []] },
                            as: "pc",
                            cond: { $eq: ["$$pc.callId", "$callIdStr"] },
                          },
                        },
                        initialValue: 0,
                        in: {
                          $add: [
                            "$$value",
                            { $add: [{ $ifNull: ["$$this.onlineAmount", 0] }, { $ifNull: ["$$this.cashAmount", 0] }] },
                          ],
                        },
                      },
                    },
                  },
                },
                initialValue: 0,
                in: { $add: ["$$value", "$$this"] },
              },
            },
          },
        },

        {
          $addFields: {
            submittedAmount: { $add: ["$embeddedPaid", "$paidFromPaymentsCollection"] },
          },
        },

        {
          $project: {
            _id: 1,
            techId: 1,
            clientName: 1,
            customerName: 1,
            phone: 1,
            address: 1,
            type: 1,
            serviceType: 1,
            status: 1,
            price: 1,
            createdAt: 1,
            closedAt: 1,
            closedDate: 1,
            submittedAmount: 1,
            paymentDocs: 1,
            paymentStatus: {
              $switch: {
                branches: [
                  { case: { $gte: ["$submittedAmount", "$price"] }, then: "Submitted" },
                  { case: { $gt: ["$submittedAmount", 0] }, then: "Partial" },
                ],
                default: "Unsubmitted",
              },
            },
            lastPaymentAt: { $max: "$paymentDocs.createdAt" },
            clientAvatar: { $ifNull: ["$clientAvatar", "$avatar"] },
            avatar: 1,
          },
        },

        { $limit: 200 },
      ];

      calls = await callsColl.aggregate(callsPipeline).toArray();
    }

    const lifetimeSummary = lifetimeSummaryArr[0] || {};
    const summary = {
      monthClosed: monthSummaryByStatus["Closed"]?.count || 0,
      monthAmount: monthSummaryByStatus["Closed"]?.amount || 0,
      monthSubmitted: monthPaymentsTotal.total || 0, // collected/submitted in the selected range
      monthPending: monthSummaryByStatus["Pending"]?.count || 0,
      monthPendingAmount: monthSummaryByStatus["Pending"]?.amount || 0,
      totalClosed: lifetimeSummary.totalClosed || 0,
      totalAmount: lifetimeSummary.totalAmount || 0,
    };

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      success: true,
      technicians,
      summary,
      calls,
      monthSummaryByStatus,
    });
  } catch (err) {
    console.error("technician-calls error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("admin")(handler);

/**
 * Recommended indexes:
 * db.forwarded_calls.createIndex({ status: 1, techId: 1, createdAt: -1 });
 * db.forwarded_calls.createIndex({ closedAt: -1 });
 * db.payments.createIndex({ createdAt: -1 });
 * db.payments.createIndex({ techId: 1 });
 * db.technicians.createIndex({ name: 1 });
 */
