import type { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Pool, RowDataPacket } from 'mysql2/promise';

export type WebUser = { id: string; username: string; permissions: string[]; sections: string[] };
declare global { namespace Express { interface Request { webUser?: WebUser } } }

export function requireWebAuth(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.dist_session;
    if (!token || !process.env.JWT_SECRET) { res.status(401).json({error:'Login required'}); return; }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {algorithms:['HS256']}) as JwtPayload;
      if (typeof decoded.sub !== 'string') throw Error('Invalid subject');
      const [users] = await pool.execute<RowDataPacket[]>('SELECT UserId, UserName, user_active FROM users WHERE UserId=? LIMIT 1', [decoded.sub]);
      if (!users.length || Number(users[0].user_active) !== 1) { res.status(401).json({error:'Account inactive'}); return; }
      const [permissions] = await pool.execute<RowDataPacket[]>('SELECT mod_name FROM user_permission WHERE user_id=?', [decoded.sub]);
      const [sections] = await pool.execute<RowDataPacket[]>('SELECT section_SecId FROM usersec WHERE users_UserId=?', [decoded.sub]);
      req.webUser = {id:decoded.sub, username:users[0].UserName, permissions:permissions.map(x=>x.mod_name), sections:sections.map(x=>x.section_SecId)};
      next();
    } catch { res.status(401).json({error:'Session expired or invalid'}); }
  };
}
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.webUser?.permissions.includes(permission)) {res.status(403).json({error:'Permission denied'});return;}
    next();
  };
}
