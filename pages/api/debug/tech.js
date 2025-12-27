import { getDb, getUser } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  try {
    const db = await getDb();

    // 1️⃣ Token se user nikaalo
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        step: "AUTH",
        error: "No token / invalid token",
      });
    }

    // 2️⃣ Token payload dikhao
    const debug = {
      tokenPayload: user,
      lookups: {},
    };

    // 3️⃣ Try lookup by ObjectId (token.id)
    if (user.id) {
      try {
        debug.lookups.byObjectId = await db
          .collection("technicians")
          .findOne({ _id: new ObjectId(user.id) });
      } catch (e) {
        debug.lookups.byObjectIdError = e.message;
      }
    }

    // 4️⃣ Try lookup by string _id
    if (user.id) {
      debug.lookups.byIdString = await db
        .collection("technicians")
        .findOne({ _id: user.id });
    }

    // 5️⃣ Try lookup by username
    if (user.username) {
      debug.lookups.byUsername = await db
        .collection("technicians")
        .findOne({ username: user.username });
    }

    // 6️⃣ Try lookup by email
    if (user.email) {
      debug.lookups.byEmail = await db
        .collection("technicians")
        .findOne({ email: user.email });
    }

    // 7️⃣ Sample technician (to verify collection)
    debug.sampleTechnician = await db
      .collection("technicians")
      .findOne({});

    res.json(debug);
  } catch (err) {
    console.error("DEBUG ERROR:", err);
    res.status(500).json({
      error: err.message,
    });
  }
}
