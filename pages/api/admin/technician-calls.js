// pages/api/admin/technician-calls.js
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

    // Determine start / end based on dateFrom/dateTo or month (dateFrom/dateTo takes precedence)
    let start, end;
    if (dateFrom || dateTo) {
      if (dateFrom) start = new Date(dateFrom + "T00:00:00");
      if (dateTo) end = new Date(dateTo + "T23:59:59.999");
      if (start && !end) { const tmp = new Date(start); tmp.setDate(tmp.getDate() + 1); end = tmp; }
      if (!start && end) { const tmp = new Date(end); tmp.setMonth(tmp.getMonth() - 1); start = tmp; }
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

    // ---------- 1) MONTH STATS FROM forwarded_calls (calls closed within start..end) ----------
    const monthStatsArr = await callsColl.aggregate([
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
    ]).toArray();

    const monthMap = new Map();
    monthStatsArr.forEach(r => monthMap.set(String(r._id), {
      monthClosed: r.monthClosed || 0,
      monthAmount: r.monthAmount || 0,
      monthEmbeddedPaid: r.monthEmbeddedPaid || 0
    }));

    // ---------- 2) LIFETIME STATS ----------
    const lifetimeStatsArr = await callsColl.aggregate([
      { $addFields: { priceNum: { $ifNull: ["$price", 0] }, embeddedPayments: { $ifNull: ["$payments", []] } } },
      { $match: { status: "Closed", ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
      { $group: { _id: "$techId", totalClosed: { $sum: 1 }, totalAmount: { $sum: "$priceNum" }, totalEmbeddedPaid: { $sum: { $reduce: { input: "$embeddedPayments", initialValue: 0, in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] } } } } } }
    ]).toArray();

    const lifetimeMap = new Map();
    lifetimeStatsArr.forEach(r => lifetimeMap.set(String(r._id), {
      totalClosed: r.totalClosed || 0,
      totalAmount: r.totalAmount || 0,
      totalEmbeddedPaid: r.totalEmbeddedPaid || 0
    }));

    // ---------- 3) PAYMENTS AGGREGATION FOR SELECTED RANGE (this is payment.js behavior) ----------
    const paymentsMatch = {
      createdAt: { $gte: start, $lt: end },
      ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}),
    };

    const paymentsMonthAgg = await paymentsColl.aggregate([
      { $match: paymentsMatch },
      { $group: {
          _id: null,
          online: { $sum: { $ifNull: ["$onlineAmount", 0] } },
          cash: { $sum: { $ifNull: ["$cashAmount", 0] } },
          total: { $sum: { $add: [{ $ifNull: ["$onlineAmount", 0] }, { $ifNull: ["$cashAmount", 0] }] } }
      } }
    ]).toArray();

    const monthPaymentsTotal = paymentsMonthAgg[0] || { online: 0, cash: 0, total: 0 };

    // ---------- 4) month summary by status (for totals) ----------
    const monthSummaryArr = await callsColl.aggregate([
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
              $cond: [{ $and: [{ $gte: ["$closedDate", start] }, { $lt: ["$closedDate", end] }] }, 1, 0]
            }
          },
          amountInMonth: {
            $sum: {
              $cond: [{ $and: [{ $gte: ["$closedDate", start] }, { $lt: ["$closedDate", end] }] }, "$priceNum", 0]
            }
          }
        }
      }
    ]).toArray();

    const monthSummaryByStatus = {};
    monthSummaryArr.forEach(r => { monthSummaryByStatus[r._id || "UNKNOWN"] = { count: r.countInMonth || 0, amount: r.amountInMonth || 0 } });

    // ---------- 5) lifetime overall closed totals ----------
    const lifetimeSummaryArr = await callsColl.aggregate([
      { $addFields: { priceNum: { $ifNull: ["$price", 0] } } },
      { $match: { status: "Closed" } },
      { $group: { _id: null, totalClosed: { $sum: 1 }, totalAmount: { $sum: "$priceNum" } } }
    ]).toArray();

    // ---------- 6) TECHNICIANS LIST ----------
    const techDocs = await techsColl.find({}, {
      projection: { _id: 1, name: 1, fullName: 1, techName: 1, username: 1, phone: 1, avatar: 1, profilePic: 1, bio: 1 }
    }).sort({ name: 1 }).toArray();

    const technicians = techDocs.map(t => {
      const key = String(t._id);
      const monthStat = monthMap.get(key) || { monthClosed: 0, monthAmount: 0, monthEmbeddedPaid: 0 };
      const lifeStat = lifetimeMap.get(key) || { totalClosed: 0, totalAmount: 0, totalEmbeddedPaid: 0 };
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

    // ---------- 7) CALLS LIST: calls closed within start..end (as before) ----------
    let calls = [];
    if (techCandidates.length) {
      const callsPipeline = [
        { $addFields: { closedDate: { $ifNull: ["$closedAt", "$createdAt"] }, priceNum: { $ifNull: ["$price", 0] }, embeddedPayments: { $ifNull: ["$payments", []] }, callIdStr: { $toString: "$_id" } } },
        { $match: { techId: { $in: techCandidates }, closedDate: { $gte: start, $lt: end } } },
        { $sort: { closedDate: -1 } },

        // lookup payments only in the same payments range (payments.createdAt in [start,end))
        {
          $lookup: {
            from: "payments",
            let: { callIdStr: "$callIdStr" },
            pipeline: [
              { $match: { createdAt: { $gte: start, $lt: end }, ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
              { $project: { _id: 1, createdAt: 1, mode: 1, receiver: 1, techId: 1, calls: 1 } }
            ],
            as: "paymentDocs"
          }
        },

        // compute matchedCalls: entries in paymentDocs.calls that match this callId
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
              $reduce: { input: "$embeddedPayments", initialValue: 0, in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] } }
            },
            matchedCalls: {
              $reduce: {
                input: "$paymentDocs",
                initialValue: [],
                in: {
                  $concatArrays: [
                    "$$value",
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: { $ifNull: ["$$this.calls", []] },
                            as: "pc",
                            cond: { $eq: [{ $toString: "$$pc.callId" }, "$callIdStr"] }
                          }
                        },
                        as: "mc",
                        in: {
                          paymentId: { $toString: "$$this._id" },
                          paymentCreatedAt: "$$this.createdAt",
                          onlineAmount: { $ifNull: ["$$mc.onlineAmount", 0] },
                          cashAmount: { $ifNull: ["$$mc.cashAmount", 0] },
                          receiver: "$$this.receiver",
                          mode: "$$this.mode"
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },

        // sum submittedAmount for this call from matchedCalls (only payments in this payments range)
        {
          $addFields: {
            submittedAmount: {
              $reduce: {
                input: "$matchedCalls",
                initialValue: 0,
                in: { $add: ["$$value", { $add: ["$$this.onlineAmount", "$$this.cashAmount"] }] }
              }
            },
            lastPaymentAt: { $max: "$matchedCalls.paymentCreatedAt" }
          }
        },

        {
          $project: {
            _id: 1, techId: 1, clientName: 1, customerName: 1, phone: 1, address: 1, type: 1, serviceType: 1,
            status: 1, price: 1, createdAt: 1, closedAt: 1, closedDate: 1, submittedAmount: 1,
            matchedPayments: "$matchedCalls",
            paymentStatus: {
              $cond: [{ $gt: ["$submittedAmount", 0] }, "Submitted", "Unsubmitted"]
            },
            lastPaymentAt: 1,
            clientAvatar: { $ifNull: ["$clientAvatar", "$avatar"] },
            avatar: 1
          }
        },

        { $limit: 200 }
      ];

      calls = await callsColl.aggregate(callsPipeline).toArray();
    }

    // ---------- 8) PAYMENTS LIST: flatten payments in the selected payments range (all per-call items) ----------
    // This ensures payments are shown by submission month, even if call closed earlier.
    const paymentsFlattenPipeline = [
      { $match: paymentsMatch },
      { $project: { _id: 1, createdAt: 1, mode: 1, receiver: 1, techId: 1, calls: { $ifNull: ["$calls", []] } } },
      { $unwind: "$calls" },
      { $addFields: { callIdStr: { $toString: "$calls.callId" }, paymentCreatedAt: "$createdAt", paymentIdStr: { $toString: "$_id" } } },
      { $project: {
          paymentId: "$paymentIdStr",
          paymentCreatedAt: 1,
          mode: 1,
          receiver: 1,
          techId: { $toString: "$techId" },
          onlineAmount: { $ifNull: ["$calls.onlineAmount", 0] },
          cashAmount: { $ifNull: ["$calls.cashAmount", 0] },
          callIdStr: 1,
          clientName: "$calls.clientName",
          phone: "$calls.phone",
          address: "$calls.address",
          callServiceType: "$calls.type",
          callPrice: "$calls.price"
      } },
      // lookup call doc to get closedAt and call status (if exists)
      {
        $lookup: {
          from: "forwarded_calls",
          let: { cid: "$callIdStr" },
          pipeline: [
            { $addFields: { idStr: { $toString: "$_id" } } },
            { $match: { $expr: { $eq: ["$idStr", "$$cid"] } } },
            { $project: { _id: 1, closedAt: 1, price: 1, status: 1 } }
          ],
          as: "callDoc"
        }
      },
      { $addFields: { callDoc: { $arrayElemAt: ["$callDoc", 0] } } },
      { $project: {
          paymentId: 1, paymentCreatedAt: 1, mode: 1, receiver: 1, techId: 1,
          onlineAmount: 1, cashAmount: 1, totalAmount: { $add: ["$onlineAmount", "$cashAmount"] },
          callId: "$callIdStr", clientName: 1, phone: 1, address: 1, callPrice: 1,
          callClosedAt: "$callDoc.closedAt",
          callStatus: "$callDoc.status"
      } },
      { $sort: { paymentCreatedAt: -1 } },
      { $limit: 1000 }
    ];

    const paymentsList = await paymentsColl.aggregate(paymentsFlattenPipeline).toArray();

    // ---------- 9) SUMMARY composition ----------
    const lifetimeSummary = lifetimeSummaryArr[0] || {};
    const summary = {
      // calls closed in range (by closedDate)
      monthClosed: monthSummaryByStatus["Closed"]?.count || 0,
      monthAmount: monthSummaryByStatus["Closed"]?.amount || 0,
      // payments submitted in range (by payment.createdAt) -> matches payment.js totals
      monthSubmitted: monthPaymentsTotal.total || 0,
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
      calls,         // calls closed in the selected range
      payments: paymentsList, // flattened per-call payment entries submitted in the selected range
      monthSummaryByStatus,
    });
  } catch (err) {
    console.error("technician-calls error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("admin")(handler);

/**
 * Important:
 * - This file now returns `summary`, `calls` (calls closed in selected range), AND `payments` (payment entries whose payment.createdAt falls in range).
 * - For reconciliation: sum(payments.totalAmount) should equal payment.js sum for same filters.
 * - Payment attribution: payments are COUNTED in the month / range where payment.createdAt falls. Calls are COUNTED where closedAt falls.
 * - Payment status for calls: "Submitted" if submittedAmount > 0 (i.e., there was at least one matched payment in this payments range), otherwise "Unsubmitted".
 */
