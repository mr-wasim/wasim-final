import clientPromise from "./mongodb.js";
import { verifyToken } from "./auth.js";

export async function getDb() {
  const client = await clientPromise;
  return client.db("chimney_crm");
}

export function getUser(req) {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return payload;
  } catch (e) {
    return null;
  }
}

export function requireRole(role) {
  return (handler) => async (req, res) => {
    // ✅ Allow CORS preflight requests
    if (req.method === "OPTIONS") {
      res.setHeader("Allow", ["POST", "OPTIONS"]);
      return res.status(200).end();
    }

    // ✅ Handle only POST for role-protected routes
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // ✅ Authentication
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: No token found" });
    }

    // ✅ Role check
    if (user.role !== role) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }

    // ✅ Proceed to main handler
    return handler(req, res, user);
  };
}
