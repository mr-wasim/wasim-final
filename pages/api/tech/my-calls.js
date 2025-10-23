import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

async function handler(req, res, user) {
  const { tab = "All Calls", page = 1 } = req.query;
  const db = await getDb();
  const coll = db.collection("forwarded_calls");

  const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const match = { techId };

  switch (tab) {
    case "Today Calls":
      match.createdAt = { $gte: todayStart };
      break;
    case "Pending":
    case "Completed":
    case "Closed":
      match.status = tab;
      break;
    default:
      break;
  }

  const limit = 4;
  const skip = (Number(page) - 1) * limit;

  const [items, total] = await Promise.all([
    coll
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    coll.countDocuments(match),
  ]);

  // 🔥 Dynamic field detection for client name
  const mappedItems = items.map((x) => {
    let clientName = "";

    // possible fields in DB
    if (x.clientName) clientName = x.clientName;
    else if (x.customerName) clientName = x.customerName;
    else if (x.name) clientName = x.name;
    else if (x.client) clientName = x.client;
    else if (x.fullName) clientName = x.fullName;

    return {
      _id: x._id.toString(),
      clientName,
      phone: x.phone || "",
      address: x.address || "",
      type: x.type || "",
      price: x.price || 0,
      status: x.status || "Pending",
      createdAt: x.createdAt,
    };
  });

  res.json({
    success: true,
    items: mappedItems,
    total,
  });
}

export default requireRole("technician")(handler);
