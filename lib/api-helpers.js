
import clientPromise from "./mongodb.js";
import { verifyToken } from "./auth.js";

export async function getDb(){
  const client = await clientPromise;
  return client.db("chimney_crm");
}

export function getUser(req){
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ","");
  if(!token) return null;
  try{
    const payload = verifyToken(token);
    return payload;
  }catch(e){
    return null;
  }
}

export function requireRole(role){
  return (handler)=> async (req,res)=>{
    const user = getUser(req);
    if(!user || user.role !== role){
      return res.status(401).json({ error: "Unauthorized" });
    }
    return handler(req,res,user);
  };
}
