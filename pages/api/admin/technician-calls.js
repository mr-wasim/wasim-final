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

    // Accept month, techId, dateFrom, dateTo (keeps original UI behavior)
    let { month = "", techId = "", dateFrom = "", dateTo = "" } = req.query;

    // DETERMINE START / END based on dateFrom/dateTo or month (dateFrom/dateTo takes precedence)
    let start, end;
    if (dateFrom || dateTo) {
      if (dateFrom) start = new Date(dateFrom + "T00:00:00");
      if (dateTo) end = new Date(dateTo + "T23:59:59.999");
      if (start && !end) {
        const tmp = new Date(start);
        tmp.setDate(tmp.getDate() + 1);
        end = tmp;
      }
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

    // 1) month stats (Closed within start..end)
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

    // 2) lifetime stats from forwarded_calls
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

    // 3) payments total in same range (payment.js sums payment.onlineAmount + payment.cashAmount at payment-level)
    const paymentsMatch = {
      createdAt: { $gte: start, $lt: end },
      ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}),
    };

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

    // 4) month summary by status
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

    // 5) lifetime overall closed totals
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

    // 6) technicians list
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

    // 7) calls list for selected tech + month: lookup payments collection and compute matchedCalls correctly
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

        // lookup payments where payments.calls contains this call id AND payment createdAt in the same start..end
        {
          $lookup: {
            from: "payments",
            let: { callIdStr: "$callIdStr" },
            pipeline: [
              {
                $match: {
                  createdAt: { $gte: start, $lt: end },
                  ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}),
                  // we cannot directly test calls array here with $expr easily, so we filter later
                },
              },
              {
                $project: {
                  _id: 1,
                  createdAt: 1,
                  mode: 1,
                  receiver: 1,
                  techId: 1,
                  calls: 1,
                },
              },
              // keep payments that actually contain any calls that match; the outer pipeline will filter further
            ],
            as: "paymentDocs",
          },
        },

        // compute matchedCalls (flatten matched payment.calls that belong to this callIdStr)
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
            // matchedCalls: flattened array of objects { paymentId, paymentCreatedAt, onlineAmount, cashAmount, receiver, mode }
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
                            cond: { $eq: [{ $toString: "$$pc.callId" }, "$callIdStr"] },
                          },
                        },
                        as: "mc",
                        in: {
                          paymentId: { $toString: "$$this._id" },
                          paymentCreatedAt: "$$this.createdAt",
                          onlineAmount: { $ifNull: ["$$mc.onlineAmount", 0] },
                          cashAmount: { $ifNull: ["$$mc.cashAmount", 0] },
                          receiver: "$$this.receiver",
                          mode: "$$this.mode",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },

        // compute submittedAmount as sum of matchedCalls' online+cash and paymentStatus/lastPaymentAt
        {
          $addFields: {
            submittedAmount: {
              $reduce: {
                input: "$matchedCalls",
                initialValue: 0,
                in: { $add: ["$$value", { $add: ["$$this.onlineAmount", "$$this.cashAmount"] }] },
              },
            },
            lastPaymentAt: { $max: "$matchedCalls.paymentCreatedAt" },
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
            matchedPayments: "$matchedCalls", // renamed for clarity in the response
            paymentStatus: {
              $switch: {
                branches: [
                  { case: { $gte: ["$submittedAmount", "$price"] }, then: "Submitted" },
                  { case: { $gt: ["$submittedAmount", 0] }, then: "Partial" },
                ],
                default: "Unsubmitted",
              },
            },
            lastPaymentAt: 1,
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
      monthSubmitted: monthPaymentsTotal.total || 0, // total collected/submitted from payments collection in range
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
 * Notes:
 * - This uses the same "range" semantics as your payment totals (we compute the paymentsMonthAgg using payments.createdAt in [start,end) ).
 * - Key fix: matchedPayments is built from payment.calls entries (per-call amounts), and submittedAmount sums those per-call amounts only.
 * - Ensure your payments collection stores per-call amounts inside payments.calls[].onlineAmount and .cashAmount as in your payment.js.
 * - Recommended indexes for performance:
 *   db.forwarded_calls.createIndex({ status: 1, techId: 1, createdAt: -1 });
 *   db.forwarded_calls.createIndex({ closedAt: -1 });
 *   db.payments.createIndex({ createdAt: -1 });
 *   db.payments.createIndex({ techId: 1 });
 */
