// pages/api/forwarded-calls/index.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

const ALLOWED_TABS = new Set([
  "All Calls",
  "Today Calls",
  "Pending",
  "Closed",
  "Canceled",
]);

const PAGE_SIZE = 10;

async function handler(req, res, user) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false });
  }

  try {
    // ---------------- QUERY SANITIZATION ----------------
    let { tab = "All Calls", page = "1" } = req.query;

    tab = ALLOWED_TABS.has(tab) ? tab : "All Calls";
    page = Math.max(parseInt(page, 10) || 1, 1);

    // ---------------- DB ----------------
    const db = await getDb();
    const callsColl = db.collection("forwarded_calls");
    const paymentColl = db.collection("payments");

    // ---------------- TECH MATCH ----------------
    const techIds = [user.id];
    if (ObjectId.isValid(user.id)) techIds.push(new ObjectId(user.id));

    /** 
     * 🔑 SINGLE SOURCE OF TRUTH
     * 👉 tab decides the query
     */
    const match = {
      techId: { $in: techIds },
    };

    // ---------------- TAB LOGIC ----------------
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
      // All Calls
      match.status = { $ne: "Canceled" };
    }

    // ---------------- PAGINATION ----------------
    const skip = (page - 1) * PAGE_SIZE;

    /**
     * 🚀 FAST QUERY
     * - indexed fields only
     * - limit + 1 for hasMore
     */
    const docs = await callsColl
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PAGE_SIZE + 1)
      .project({
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
      })
      .toArray();

    const hasMore = docs.length > PAGE_SIZE;
    const sliced = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

    // ---------------- PAYMENT LOOKUP (O(1)) ----------------
    const callIds = sliced.map((c) => String(c._id));

    const paidSet = new Set();
    if (callIds.length) {
      const payments = await paymentColl
        .find(
          { "calls.callId": { $in: callIds } },
          { projection: { "calls.callId": 1 } }
        )
        .toArray();

      for (const p of payments) {
        for (const c of p.calls || []) {
          if (c?.callId) paidSet.add(String(c.callId));
        }
      }
    }

    // ---------------- FINAL MAP ----------------
    const items = sliced.map((i) => ({
      _id: String(i._id),

      clientName:
        i.clientName ??
        i.customerName ??
        i.name ??
        i.fullName ??
        "Unknown",

      phone: i.phone ?? "",
      address: i.address ?? "",
      type: i.type ?? "",
      price: i.price ?? 0,

      status: i.status ?? "Pending",
      createdAt: i.createdAt ?? "",
      timeZone: i.timeZone ?? "",
      notes: i.notes ?? "",

      paymentStatus: paidSet.has(String(i._id)) ? "Paid" : "Pending",
    }));

    // ---------------- RESPONSE ----------------
    res.setHeader("Cache-Control", "private, no-store, max-age=0");

    return res.status(200).json({
      success: true,
      tab,          // 👈 echo back (debug + safety)
      page,
      pageSize: PAGE_SIZE,
      hasMore,
      items,
    });
  } catch (err) {
    console.error("forwarded-calls error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
}

export default requireRole("technician")(handler);
