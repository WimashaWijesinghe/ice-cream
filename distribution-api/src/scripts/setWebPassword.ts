import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import {createInterface} from 'node:readline';
import {stdin,stdout} from 'node:process';

async function main(){
 const userId=process.argv[2];
 if(!userId || userId.length>2) throw Error('Usage: npm run set-web-password -- 00');
 const rl=createInterface({input:stdin,output:stdout});
 const password=await new Promise<string>(resolve=>rl.question('New WEB password (input visible; use a private terminal): ',resolve));rl.close();
 if(password.length<12) throw Error('Use at least 12 characters');
 const [users]:any=await pool.execute('SELECT UserId FROM users WHERE UserId=? AND user_active=1',[userId]);
 if(!users.length) throw Error('Active legacy user not found');
 const hash=await bcrypt.hash(password,12);
 await pool.execute('INSERT INTO dist_web_credentials(user_id,password_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)',[userId,hash]);
 console.log('Web password configured for existing UserId:',userId);
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>pool.end());
