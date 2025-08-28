
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import bcrypt from "bcryptjs";

async function handler(req,res,user){
  if(req.method!=='POST') return res.status(405).end();
  const { username, password } = req.body||{};
  if(!username || !password) return res.status(400).json({ error:'Missing' });
  const db = await getDb();
  const exists = await db.collection('technicians').findOne({ username });
  if(exists) return res.status(400).json({ error:'Username already exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const r = await db.collection('technicians').insertOne({ username, passwordHash, createdAt: new Date() });
  res.json({ ok:true, id: r.insertedId.toString() });
}
export default requireRole('admin')(handler);
