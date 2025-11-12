
// import jwt from "jsonwebtoken";
// import bcrypt from "bcryptjs";
// import clientPromise from "./mongodb";

// const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// export async function ensureAdminSeed(){
//   const client = await clientPromise;
//   const db = client.db("chimney_crm");
//   const admins = db.collection("admins");
//   const username = "admin";
//   const pass = process.env.ADMIN_PASSWORD || "Chimneysolution@123#";
//   const existing = await admins.findOne({ username });
//   if(!existing){
//     const hash = await bcrypt.hash(pass, 10);
//     await admins.insertOne({ username, passwordHash: hash, createdAt: new Date() });
//   }
// }

// export function signToken(payload){
//   return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
// }

// export function verifyToken(token){
//   try{ return jwt.verify(token, JWT_SECRET); }catch(e){ return null; }
// }


import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import clientPromise from "./mongodb.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function ensureAdminSeed() {
  const client = await clientPromise;
  
  // ✅ Always use DB name from .env only
  const dbName = process.env.MONGODB_DB;
  if (!dbName) {
    throw new Error("❌ MONGODB_DB not defined in .env file");
  }

  const db = client.db(dbName);
  const admins = db.collection("admins");

  const username = "admin";
  const pass = process.env.ADMIN_PASSWORD || "Chimneysolution@123#";

  const existing = await admins.findOne({ username });
  if (!existing) {
    const hash = await bcrypt.hash(pass, 10);
    await admins.insertOne({
      username,
      password: hash, // ✅ hashed password field
      role: "admin",
      createdAt: new Date(),
    });
    console.log(`✅ Admin user created successfully in ${dbName}`);
  } else {
    console.log(`ℹ️ Admin user already exists in ${dbName}`);
  }
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}
