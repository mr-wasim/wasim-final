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

    let { month = "", techId = "" } = req.query;

    // month range (start inclusive, end exclusive)
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

    // tech filter accepts both string and ObjectId
    const techCandidates = [];
    if (techId && typeof techId === "string") {
      techCandidates.push(techId);
      const maybeObj = toObjectIdIfPossible(techId);
      if (maybeObj && typeof maybeObj !== "string") techCandidates.push(maybeObj);
    }

    // month stats from forwarded_calls (closed in month)
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

    // lifetime stats from forwarded_calls
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

    // payments in month (from payments collection) -> total collected (submitted)
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

    // month summary from forwarded_calls (status wise)
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

    // lifetime overall closed totals
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

    // technicians list
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

    // calls list for selected tech + month: lookup payments collection by callId
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

        // lookup payments where payments.calls contains this call id (handle ObjectId or string by comparing $toString)
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
              { $project: { _id: 1, createdAt: 1, calls: 1, onlineAmount: 1, cashAmount: 1 } },
            ],
            as: "paymentDocs",
          },
        },

        // compute paid amount: sum(embedded payments on call) + sum(matching call entries inside paymentDocs.calls)
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
            // sum amounts from paymentDocs.calls that match this callId
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
                            cond: { $eq: [{ $toString: "$$pc.callId" }, "$callIdStr"] },
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
      monthSubmitted: monthPaymentsTotal.total || 0, // total collected/submitted from payments collection
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
