
import cookie from "cookie";
export default async function handler(req,res){
  res.setHeader('Set-Cookie', cookie.serialize('token','',{ path:'/', httpOnly:true, maxAge:0 }));
  res.json({ ok:true });
}
