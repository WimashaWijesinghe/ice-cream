import { Router } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { requireWebAuth } from '../middleware/auth';

export function authRouter(pool: Pool) {
 const router = Router();
 const auth = requireWebAuth(pool);
 router.post('/login', rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false}), async (req,res) => {
   const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
   const password = typeof req.body?.password === 'string' ? req.body.password : '';
   if (!username || !password || username.length>15 || password.length>256) {res.status(400).json({error:'Invalid credentials'});return;}
   try {
     const [rows] = await pool.execute<RowDataPacket[]>(`SELECT u.UserId, u.UserName, u.user_active, c.password_hash
       FROM users u LEFT JOIN dist_web_credentials c ON c.user_id=u.UserId WHERE u.UserName=? LIMIT 1`, [username]);
     const row = rows[0];
     // No automatic conversion from unknown legacy password format.
     if (!row || Number(row.user_active)!==1 || !row.password_hash || !(await bcrypt.compare(password,row.password_hash))) {
       res.status(401).json({error:'Invalid username or password'});return;
     }
     const secret=process.env.JWT_SECRET;
     if (!secret || secret.length<32) {res.status(500).json({error:'Server authentication not configured'});return;}
     const token=jwt.sign({},secret,{algorithm:'HS256',subject:String(row.UserId),expiresIn:'8h'});
     res.cookie('dist_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:8*60*60*1000});
     res.json({success:true,username:row.UserName});
   } catch(e) {console.error('login error',e);res.status(500).json({error:'Login unavailable'});}
 });
 router.get('/me',auth,(req,res)=>res.json(req.webUser));
 router.post('/logout',(_req,res)=>{res.clearCookie('dist_session',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});res.json({success:true});});
 return router;
}
