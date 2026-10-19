const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query, pool, isConfigured } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();
const syncLimiter = require('express-rate-limit')({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
const emailSchema = z.string().email().max(254);
const destinationSchema = z.object({
  id: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2).max(120), category: z.string().min(2).max(80),
  summary: z.string().min(5).max(280), description: z.string().min(10).max(3000),
  source: z.string().url().max(500).refine(value=>value.startsWith('https://'),'Use an HTTPS source link.'), source_label: z.string().min(2).max(160),
  visiting: z.string().max(500).optional().default(''), name_te: z.string().max(120).optional().default(''),
  name_hi: z.string().max(120).optional().default(''), kind: z.string().max(40).optional().default('place'),
  accent: z.string().max(40).optional().default('heritage'), glyph: z.string().max(12).optional().default('⌖'),
  verified: z.boolean().optional().default(false)
});
function ensureDatabase(req,res,next){if(!isConfigured)return res.status(503).json({error:'Database is not configured.'});next();}
function makeToken(user){if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('Authentication requires a JWT_SECRET with at least 32 characters.');return jwt.sign({sub:user.id,email:user.email,role:user.role},process.env.JWT_SECRET,{expiresIn:'12h',issuer:'guide-voyager'});}

router.get('/health', async (_req,res)=>{
  let database='not-configured';
  if(isConfigured){try{await query('SELECT 1');database='connected';}catch{database='unavailable';}}
  res.status(database==='unavailable'?503:200).json({status:database==='unavailable'?'degraded':'ok',database,service:'guide-voyager-api'});
});
router.get('/destinations',ensureDatabase,async(_req,res)=>{
 try{const result=await query("SELECT destinations FROM content_versions ORDER BY published_at DESC LIMIT 1");res.json({destinations:result.rows[0]?.destinations||[],version:result.rows[0]?.version||null});}
 catch(error){console.error('Destination read failed:',error.message);res.status(500).json({error:'Could not load destinations.'});}
});
router.get('/content/current',ensureDatabase,async(_req,res)=>{
 try{const result=await query('SELECT version,destinations,published_at FROM content_versions ORDER BY published_at DESC LIMIT 1');if(!result.rowCount)return res.status(404).json({error:'No published content is available.'});res.json(result.rows[0]);}
 catch(error){console.error('Content read failed:',error.message);res.status(500).json({error:'Could not load published content.'});}
});
router.get('/app-version',(_req,res)=>res.json({version:process.env.APP_VERSION||'0.1.0',storeUrl:process.env.PLAY_STORE_URL||null}));

router.post('/auth/register',ensureDatabase,async(req,res)=>{
 const parsed=z.object({email:emailSchema, password:z.string().min(10).max(128)}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Enter a valid email and a password with at least 10 characters.'});
 if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)return res.status(503).json({error:'Authentication requires a JWT_SECRET with at least 32 characters.'});
 try{const passwordHash=await bcrypt.hash(parsed.data.password,12);const result=await query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id,email,role,created_at',[parsed.data.email.toLowerCase(),passwordHash]);const user=result.rows[0];res.status(201).json({token:makeToken(user),user:{id:user.id,email:user.email,role:user.role}});}
 catch(error){if(error.code==='23505')return res.status(409).json({error:'An account with this email already exists.'});console.error('Registration failed:',error.message);res.status(500).json({error:'Could not create the account.'});}
});
router.post('/auth/login',ensureDatabase,async(req,res)=>{
 const parsed=z.object({email:emailSchema,password:z.string().min(1).max(128)}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Enter your email and password.'});
 if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)return res.status(503).json({error:'Authentication requires a JWT_SECRET with at least 32 characters.'});
 try{const result=await query('SELECT id,email,role,password_hash FROM users WHERE email=$1',[parsed.data.email.toLowerCase()]);const user=result.rows[0];if(!user||!await bcrypt.compare(parsed.data.password,user.password_hash))return res.status(401).json({error:'Email or password is incorrect.'});res.json({token:makeToken(user),user:{id:user.id,email:user.email,role:user.role}});}
 catch(error){console.error('Login failed:',error.message);res.status(500).json({error:'Could not sign in.'});}
});
router.get('/auth/me',authenticate,(req,res)=>res.json({user:{id:req.user.sub,email:req.user.email,role:req.user.role}}));

const eventSchema=z.object({id:z.string().uuid(),type:z.enum(['feedback','destination_view','itinerary_place_added','qr_scan','kiosk_open']),destinationId:z.string().max(100).optional(),rating:z.number().int().min(1).max(5).optional(),comment:z.string().max(500).optional(),payload:z.record(z.unknown()).optional(),createdAt:z.string().datetime()});
router.post('/sync/events',syncLimiter,ensureDatabase,async(req,res)=>{
 const parsed=z.object({events:z.array(eventSchema).max(100)}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'One or more queued events are invalid.'});
 const client=await pool.connect();let accepted=0;
 try{await client.query('BEGIN');for(const event of parsed.data.events){const {id,type,destinationId,rating,comment,payload,createdAt}=event;
   if(type==='feedback'&&(!destinationId||!rating))continue;
   const inserted=await client.query('INSERT INTO analytics_events(event_id,event_type,payload,occurred_at) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING RETURNING event_id',[id,type,payload|| (type==='feedback'?{destinationId,rating}:{}),createdAt]);
   if(type==='feedback')await client.query('INSERT INTO feedback(event_id,destination_id,rating,comment,submitted_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_id) DO NOTHING',[id,destinationId,rating,comment||'',createdAt]);
   if(inserted.rowCount)accepted++;
 }await client.query('COMMIT');res.status(202).json({accepted,received:parsed.data.events.length});}
 catch(error){await client.query('ROLLBACK');console.error('Event sync failed:',error.message);res.status(500).json({error:'Could not process queued events.'});}
 finally{client.release();}
});

router.use('/admin',authenticate,requireRole('admin'));
router.get('/admin/drafts',ensureDatabase,async(_req,res)=>{
 try{const result=await query('SELECT id,destination_id,payload,status,created_at,updated_at,published_at FROM content_drafts ORDER BY updated_at DESC');res.json({drafts:result.rows});}
 catch(error){console.error('Draft list failed:',error.message);res.status(500).json({error:'Could not load content drafts.'});}
});
router.get('/admin/destinations',ensureDatabase,async(_req,res)=>{
 try{const result=await query("SELECT payload,updated_at FROM destinations WHERE status='published' ORDER BY id");res.json({destinations:result.rows});}
 catch(error){console.error('Published destination list failed:',error.message);res.status(500).json({error:'Could not load published destinations.'});}
});
router.post('/admin/drafts',ensureDatabase,async(req,res)=>{
 const parsed=destinationSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Check the required destination fields.',details:parsed.error.flatten().fieldErrors});
 try{const result=await query("INSERT INTO content_drafts(destination_id,payload,created_by,updated_by) VALUES($1,$2,$3,$3) RETURNING id,destination_id,payload,status,created_at,updated_at",[parsed.data.id,parsed.data,req.user.sub]);res.status(201).json({draft:result.rows[0]});}
 catch(error){console.error('Draft create failed:',error.message);res.status(500).json({error:'Could not save the draft.'});}
});
router.put('/admin/drafts/:id',ensureDatabase,async(req,res)=>{
 const parsed=destinationSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Check the required destination fields.',details:parsed.error.flatten().fieldErrors});
 try{const result=await query("UPDATE content_drafts SET destination_id=$2,payload=$3,status='draft',updated_by=$4,updated_at=now() WHERE id=$1 AND status<>'published' RETURNING id,destination_id,payload,status,created_at,updated_at",[req.params.id,parsed.data.id,parsed.data,req.user.sub]);if(!result.rowCount)return res.status(404).json({error:'Draft not found or already published.'});res.json({draft:result.rows[0]});}
 catch(error){console.error('Draft update failed:',error.message);res.status(500).json({error:'Could not update the draft.'});}
});
router.post('/admin/drafts/:id/preview',ensureDatabase,async(req,res)=>{
 try{const result=await query('SELECT id,payload FROM content_drafts WHERE id=$1 AND status<>\'published\'',[req.params.id]);if(!result.rowCount)return res.status(404).json({error:'Draft not found.'});const parsed=destinationSchema.safeParse(result.rows[0].payload);if(!parsed.success)return res.status(400).json({error:'Draft content failed validation.',details:parsed.error.flatten().fieldErrors});await query("UPDATE content_drafts SET status='ready',updated_at=now() WHERE id=$1",[req.params.id]);res.json({valid:true,preview:parsed.data});}
 catch(error){console.error('Draft preview failed:',error.message);res.status(500).json({error:'Could not validate the draft.'});}
});
router.post('/admin/drafts/:id/publish',ensureDatabase,async(req,res)=>{
 const client=await pool.connect();
 try{await client.query('BEGIN');const selected=await client.query("SELECT id,destination_id,payload FROM content_drafts WHERE id=$1 AND status='ready' FOR UPDATE",[req.params.id]);if(!selected.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Preview and validate this draft before publishing.'});}
  const {id,destination_id,payload}=selected.rows[0];await client.query("INSERT INTO destinations(id,payload,status,updated_at) VALUES($1,$2,'published',now()) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,status='published',updated_at=now()",[destination_id,payload]);
  const allRows=await client.query("SELECT payload FROM destinations WHERE status='published' ORDER BY id");const version=`content-${new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,17)}`;await client.query('INSERT INTO content_versions(version,destinations,published_by) VALUES($1,$2,$3)',[version,JSON.stringify(allRows.rows.map(r=>r.payload)),req.user.sub]);await client.query("UPDATE content_drafts SET status='published',published_at=now(),updated_at=now() WHERE id=$1",[id]);await client.query('COMMIT');res.json({published:true,version,destination:payload});
 }catch(error){await client.query('ROLLBACK');console.error('Publish failed:',error.message);res.status(500).json({error:'Could not publish content.'});}finally{client.release();}
});
router.get('/admin/feedback',ensureDatabase,async(_req,res)=>{
 try{const [items,aggregate]=await Promise.all([query('SELECT event_id,destination_id,rating,comment,review_status,submitted_at FROM feedback ORDER BY submitted_at DESC LIMIT 500'),query('SELECT destination_id,count(*)::int AS count,round(avg(rating)::numeric,2) AS average_rating FROM feedback WHERE review_status=\'approved\' GROUP BY destination_id ORDER BY count(*) DESC')]);res.json({feedback:items.rows,ratings:aggregate.rows});}
 catch(error){console.error('Feedback read failed:',error.message);res.status(500).json({error:'Could not load feedback.'});}
});
router.patch('/admin/feedback/:eventId/review',ensureDatabase,async(req,res)=>{
 const parsed=z.object({status:z.enum(['approved','rejected'])}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Choose approved or rejected.'});
 try{const result=await query('UPDATE feedback SET review_status=$2,reviewed_by=$3,reviewed_at=now() WHERE event_id=$1 RETURNING event_id,review_status',[req.params.eventId,parsed.data.status,req.user.sub]);if(!result.rowCount)return res.status(404).json({error:'Feedback entry not found.'});res.json({feedback:result.rows[0]});}
 catch(error){console.error('Feedback review failed:',error.message);res.status(500).json({error:'Could not update feedback review.'});}
});
module.exports=router;
