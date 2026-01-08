// pages/api/tech/my-calls.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

/**
 * Returns forwarded calls for the logged-in technician.
 * Each item includes paymentStatus: "Paid" | "Pending"
 * Now also returns chooseCall (raw) and chooseLabel (human-friendly).
 */

function normalizeForKey(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\d\s+,-]/g, "")
    .trim();
}

function normalizePhone(p = "") {
  return String(p || "").replace(/\D/g, "");
}

async function handler(req, res, user) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    let { tab = "All Calls", page = 1, pageSize } = req.query;
    page = parseInt(page, 10) || 1;
    pageSize = parseInt(pageSize, 10) || 10;

    const ALLOWED_TABS = new Set(["All Calls", "Today Calls", "Pending", "Closed", "Canceled"]);
    if (!ALLOWED_TABS.has(tab)) tab = "All Calls";

    const db = await getDb();
    const forwardedColl = db.collection("forwarded_calls");
    const paymentsColl = db.collection("payments");

    const techIds = [user.id];
    if (ObjectId.isValid(user.id)) techIds.push(new ObjectId(user.id));

    const match = { techId: { $in: techIds } };

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

    // fetch forwarded calls slice (request pageSize + 1 to detect hasMore)
    const docs = await forwardedColl
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize + 1)
      .project({
        clientName: 1,
        customerName: 1,
        name: 1,
        fullName: 1,
        phone: 1,
        mobile: 1,
        contact: 1,
        address: 1,
        addr: 1,
        location: 1,
        type: 1,
        price: 1,
        status: 1,
        createdAt: 1,
        timeZone: 1,
        notes: 1,
        paymentStatus: 1,
        chooseCall: 1, // <-- NEW: include chooseCall in projection
        techName: 1,
      })
      .toArray();

    const hasMore = docs.length > pageSize;
    const slice = docs.slice(0, pageSize);

    // Build arrays to query payments efficiently
    const callIdsAll = slice.map((c) => String(c._id));
    const pricesSet = Array.from(new Set(slice.map((c) => Number(c.price || 0))));

    // If no calls, return fast
    if (slice.length === 0) {
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(200).json({ success: true, items: [], page, pageSize, hasMore });
    }

    // Optimized payments query:
    //  - payments that reference these callIds OR
    //  - payments by this tech that have calls with matching price (narrow down)
    const paymentsQuery = {
      $or: [
        { "calls.callId": { $in: callIdsAll } },
        { techId: { $in: techIds }, "calls.price": { $in: pricesSet } },
      ],
    };

    // Only fetch calls array to keep payload small
    const payments = await paymentsColl.find(paymentsQuery).project({ calls: 1 }).toArray();

    // Build sets
    const paidByCallId = new Set();
    const paidKeyWithPrice = new Set(); // key: normalizedName|phone|address|price

    for (const pay of payments) {
      if (!pay || !Array.isArray(pay.calls)) continue;
      for (const pc of pay.calls) {
        if (!pc) continue;
        if (pc.callId) paidByCallId.add(String(pc.callId));
        const name = normalizeForKey(pc.clientName || pc.name || "");
        const phone = normalizePhone(pc.phone || pc.mobile || pc.contact || "");
        const address = normalizeForKey(pc.address || pc.addr || pc.location || "");
        const price = Number(pc.price || pc.amount || pc.total || 0);
        if (name || phone || address || price) {
          const key = `${name}|${phone}|${address}|${price}`;
          paidKeyWithPrice.add(key);
        }
      }
    }

    // Map final items with paymentStatus determined by sets (callId OR key+price match)
    const items = slice.map((i) => {
      const clientName = i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "Unknown";
      const phone = i.phone ?? i.mobile ?? i.contact ?? "";
      const address = i.address ?? i.addr ?? i.location ?? "";
      const price = Number(i.price || 0);
      const key = `${normalizeForKey(clientName)}|${normalizePhone(phone)}|${normalizeForKey(address)}|${price}`;
      const isPaid =
        paidByCallId.has(String(i._id)) ||
        paidKeyWithPrice.has(key) ||
        (i.paymentStatus && String(i.paymentStatus).toLowerCase().includes("paid"));

      // chooseCall raw + human friendly label
      const chooseRaw = i.chooseCall ?? "";
      const chooseLabel =
        String(chooseRaw || "")
          .replace(/_/g, " ")
          .replace(/\s+/g, " ")
          .trim() || "";

      return {
        _id: String(i._id),
        clientName,
        phone,
        address,
        type: i.type ?? "",
        price,
        status: i.status ?? "Pending",
        createdAt: i.createdAt ?? "",
        timeZone: i.timeZone ?? "",
        notes: i.notes ?? "",
        paymentStatus: isPaid ? "Paid" : "Pending",
        chooseCall: chooseRaw,      // raw value (e.g., CHIMNEY_SOLUTIONS)
        chooseLabel,               // human label (e.g., "CHIMNEY SOLUTIONS")
        techName: i.techName ?? "",
      };
    });

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      success: true,
      items,
      page,
      pageSize,
      hasMore,
    });
  } catch (err) {
    console.error("my-calls error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);
