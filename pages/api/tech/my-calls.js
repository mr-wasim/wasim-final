// pages/api/tech/my-calls.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

const ALLOWED_TABS = new Set([
  "All Calls",
  "Today Calls",
  "Pending",
  "Closed",
  "Canceled",
]);

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 2000; // safety

/**
 * Strategy:
 * 1) FAST PATH: use .find() reading forwarded_calls.paymentStatus directly (must be denormalized).
 *    - This is the O(1) fastest path and should be used in production.
 * 2) FALLBACK: if items lack paymentStatus (legacy), run a targeted aggregation with $lookup
 *    but limited to pageSize to avoid heavy work.
 *
 * Also: ensure proper indexes described below for ultra speed.
 */

async function handler(req, res, user) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    let { tab = "All Calls", page = "1", pageSize } = req.query;

    tab = String(tab);
    if (!ALLOWED_TABS.has(tab)) tab = "All Calls";

    page = Math.max(parseInt(page, 10) || 1, 1);
    pageSize = Math.min(
      Math.max(parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );

    const db = await getDb();
    const callsColl = db.collection("forwarded_calls");
    const paymentColl = db.collection("payments");

    // normalize techId as ObjectId if possible (assumes forwarded_calls.techId stored as ObjectId)
    const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;

    // build base match
    const match = { techId };

    if (tab === "Today Calls") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      match.createdAt = { $gte: start };
      match.status = { $ne: "Canceled" };
    } else if (tab === "Pending") {
      match.status = "Pending";
    } else if (tab === "Closed") {
      match.status = "Closed";
    } else if (tab === "Canceled") {
      match.status = "Canceled";
    } else {
      match.status = { $ne: "Canceled" };
    }

    const skip = (page - 1) * pageSize;

    // ---------- FAST PATH: simple find + projection (use denormalized paymentStatus) ----------
    const projection = {
      clientName: 1,
      customerName: 1,
      name: 1,
      fullName: 1,
      phone: 1,
      address: 1,
      type: 1,
      price: 1,
      status: 1,
      createdAt: 1,
      timeZone: 1,
      notes: 1,
      paymentStatus: 1, // main fast read
    };

    const docs = await callsColl
      .find(match, { projection })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();

    // If all docs already have paymentStatus defined => return immediately (ultra fast)
    const allHavePaymentStatus = docs.length > 0 && docs.every((d) => d.hasOwnProperty("paymentStatus"));

    if (allHavePaymentStatus) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[my-calls] FAST PATH, docs:", docs.length);
      }

      const items = docs.map((i) => ({
        _id: String(i._id),
        clientName:
          i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "Unknown",
        phone: i.phone ?? "",
        address: i.address ?? "",
        type: i.type ?? "",
        price: i.price ?? 0,
        status: i.status ?? "Pending",
        createdAt: i.createdAt ?? "",
        timeZone: i.timeZone ?? "",
        notes: i.notes ?? "",
        paymentStatus: i.paymentStatus ?? "Pending",
      }));

      return res.status(200).json({
        success: true,
        items,
        page,
        pageSize,
      });
    }

    // ---------- FALLBACK: targeted aggregation with lookup (only for cases where paymentStatus missing) ----------
    // This is slower but limited to pageSize docs.
    if (process.env.NODE_ENV !== "production") {
      console.log("[my-calls] FALLBACK path (missing paymentStatus). Running aggregation for", docs.length, "docs");
    }

    // We'll aggregate with the same match + sort + limit but do $lookup to payments
    const aggPipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $lookup: {
          from: "payments",
          localField: "_id",
          foreignField: "calls.callId",
          as: "paymentDocs",
        },
      },
      {
        $addFields: {
          paymentStatus: {
            $cond: [{ $gt: [{ $size: "$paymentDocs" }, 0] }, "Paid", "Pending"],
          },
        },
      },
      {
        $project: {
          paymentDocs: 0,
        },
      },
    ];

    const aggregated = await callsColl.aggregate(aggPipeline).toArray();

    const items = aggregated.map((i) => ({
      _id: String(i._id),
      clientName:
        i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "Unknown",
      phone: i.phone ?? "",
      address: i.address ?? "",
      type: i.type ?? "",
      price: i.price ?? 0,
      status: i.status ?? "Pending",
      createdAt: i.createdAt ?? "",
      timeZone: i.timeZone ?? "",
      notes: i.notes ?? "",
      paymentStatus: i.paymentStatus ?? "Pending",
    }));

    // NOTE: optional - we can write back the computed paymentStatus to forwarded_calls to
    // make next requests faster (idempotent). Uncomment if you want auto-backfill on read.
    /*
    const toUpdate = aggregated
      .filter(a => a.paymentStatus)
      .map(a => ({
        updateOne: {
          filter: { _id: a._id },
          update: { $set: { paymentStatus: a.paymentStatus } }
        }
      }));
    if (toUpdate.length) {
      await callsColl.bulkWrite(toUpdate, { ordered: false }).catch(() => {});
    }
    */

    return res.status(200).json({
      success: true,
      items,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("🔥 my-calls API ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
}

export default requireRole("technician")(handler);
