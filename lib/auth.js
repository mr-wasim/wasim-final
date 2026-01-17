import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import clientPromise from "./mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function ensureAdminSeed(){
  const client = await clientPromise;
  const db = client.db("mydatabase");
  const admins = db.collection("admins");
  const username = "admin";
  const pass = process.env.ADMIN_PASSWORD || "Chimneysolution@123#";
  const existing = await admins.findOne({ username });
  if(!existing){
    const hash = await bcrypt.hash(pass, 10);
    await admins.insertOne({ username, passwordHash: hash, createdAt: new Date() });
  }
}

// ✅ NOTE: No expiresIn -> token will not contain exp claim (i.e. won't auto-expire)
export function signToken(payload){
  return jwt.sign(payload, JWT_SECRET);
}

export function verifyToken(token){
  try{ return jwt.verify(token, JWT_SECRET); }catch(e){ return null; }
}
