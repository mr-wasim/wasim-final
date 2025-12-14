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
  if (req.method !== "GET") return res.status(405).end();

  try {
    let { tab = "All Calls", page = 1 } = req.query;

    // ---------------- VALIDATION ----------------
    tab = String(tab);
    if (!ALLOWED_TABS.has(tab)) tab = "All Calls";

    page = parseInt(page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    // ---------------- DB ----------------
    const db = await getDb();
    const coll = db.collection("forwarded_calls");
    const paymentColl = db.collection("payments");

    // ---------------- TECH MATCH ----------------
    const techIds = [user.id];
    if (ObjectId.isValid(user.id)) techIds.push(new ObjectId(user.id));

    const match = { techId: { $in: techIds } };

    // ---------------- TAB FILTER (SINGLE SOURCE) ----------------
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
      // All Calls (default)
      match.status = { $ne: "Canceled" };
    }

    // ---------------- PAGINATION ----------------
    const skip = (page - 1) * PAGE_SIZE;

    const docs = await coll
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
        paymentStatus: 1,
      })
      .toArray();

    const hasMore = docs.length > PAGE_SIZE;
    const sliced = docs.slice(0, PAGE_SIZE);

    // ---------------- PAYMENT STATUS (ULTRA FAST) ----------------
    const callIds = sliced.map((c) => String(c._id));

    let paidSet = new Set();
    if (callIds.length > 0) {
      const paidDocs = await paymentColl
        .find(
          { "calls.callId": { $in: callIds } },
          { projection: { "calls.callId": 1 } }
        )
        .toArray();

      for (const p of paidDocs) {
        if (Array.isArray(p.calls)) {
          for (const c of p.calls) {
            if (c?.callId) paidSet.add(String(c.callId));
          }
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
    res.setHeader("Cache-Control", "private, no-store");

    return res.status(200).json({
      success: true,
      items,
      page,
      pageSize: PAGE_SIZE,
      hasMore,
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
