const path=require('path');
const fs=require('fs');
const localEnvCandidates=[
 process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'GuideVoyager','app.env'),
 process.env.USERPROFILE&&path.join(process.env.USERPROFILE,'AppData','Local','GuideVoyager','app.env')
].filter(Boolean);
const localEnvPath=localEnvCandidates.find(candidate=>fs.existsSync(candidate));
const envPath=process.env.GUIDE_VOYAGER_ENV_FILE||localEnvPath||path.resolve(__dirname,'..','..','.env');
require('dotenv').config({path:envPath});
const express=require('express');
const helmet=require('helmet');
const cors=require('cors');
const rateLimit=require('express-rate-limit');
const {query,isConfigured,pool}=require('./db');
const api=require('./routes/api');
const app=express();
app.disable('x-powered-by');
app.use(helmet({
 contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com','data:'],imgSrc:["'self'",'data:'],connectSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"],formAction:["'self'"]}},
 crossOriginEmbedderPolicy:false
}));
const allowedOrigins=(process.env.CORS_ORIGIN||'http://localhost:3000,http://localhost:5173,capacitor://localhost,https://localhost').split(',').map(origin=>origin.trim()).filter(Boolean);
app.use(cors({origin:(origin,callback)=>callback(null,!origin||allowedOrigins.includes(origin)),credentials:false}));
app.use(express.json({limit:'256kb'}));
app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false}));
app.use('/api',api);
const root=path.resolve(__dirname,'..','..');
app.use('/admin',express.static(path.join(root,'admin-dashboard')));
app.use('/data',express.static(path.join(root,'mobile-app','public','data')));
app.use('/assets',express.static(path.join(root,'mobile-app','public','assets')));
app.use('/sw.js',express.static(path.join(root,'mobile-app','public','sw.js')));
app.use('/manifest.webmanifest',express.static(path.join(root,'mobile-app','public','manifest.webmanifest')));
const builtMobile=path.join(root,'dist','mobile');
app.use(express.static(fs.existsSync(builtMobile)?builtMobile:path.join(root,'mobile-app')));
app.use((error,_req,res,_next)=>{console.error('Unhandled API error:',error.message);res.status(500).json({error:'Something went wrong. Please try again.'});});
async function bootstrap(){
 if(isConfigured){
  try{const migrationDir=path.join(root,'backend','migrations');const migrations=fs.readdirSync(migrationDir).filter(file=>/^\d+.*\.sql$/.test(file)).sort();for(const file of migrations)await query(fs.readFileSync(path.join(migrationDir,file),'utf8'));console.log(`Database schema is ready (${migrations.length} migrations).`);
    await syncBundledContent();
  }catch(error){console.error('Database setup failed; the offline app can still be served:',error.message);}
  const cleanup=async()=>{try{await query("DELETE FROM analytics_events WHERE occurred_at < now() - interval '24 months'");}catch(error){console.error('Analytics retention cleanup failed:',error.message);}};
  await cleanup();setInterval(cleanup,24*60*60*1000).unref();
 }else console.warn('DATABASE_URL is not set. Serving the offline app; online services are unavailable.');
 const port=Number(process.env.PORT||3000);app.listen(port,'0.0.0.0',()=>console.log(`Guide Voyager is available on http://localhost:${port}`));
}
async function syncBundledContent(){
 const dataDir=path.join(root,'mobile-app','public','data');
 const manifest=JSON.parse(fs.readFileSync(path.join(dataDir,'content-manifest.json'),'utf8'));
 const bundled=JSON.parse(fs.readFileSync(path.join(dataDir,'destinations.json'),'utf8'));
 if(!manifest.contentVersion||!Array.isArray(bundled))throw new Error('The bundled guide manifest or destinations are invalid.');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('guide-voyager-bundled-guide'))");
  const exists=await client.query('SELECT 1 FROM content_versions WHERE version=$1',[manifest.contentVersion]);
  if(exists.rowCount){await client.query('COMMIT');console.log(`Guide content is current (${manifest.contentVersion}).`);return;}
  const published=await client.query("SELECT DISTINCT ON (destination_id) destination_id,payload FROM content_drafts WHERE status='published' AND destination_id IS NOT NULL ORDER BY destination_id,published_at DESC NULLS LAST,updated_at DESC");
  const merged=new Map(bundled.map(place=>[place.id,place]));
  for(const row of published.rows){const draft=row.payload||{};const id=row.destination_id;if(merged.has(id))merged.set(id,{...merged.get(id),...draft,id});else merged.set(id,{...draft,id});}
  const places=[...merged.values()];
  await client.query("UPDATE destinations SET status='archived' WHERE status='published'");
  for(const place of places)await client.query("INSERT INTO destinations(id,payload,status,updated_at) VALUES($1,$2,'published',now()) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,status='published',updated_at=now()",[place.id,JSON.stringify(place)]);
  await client.query('INSERT INTO content_versions(version,destinations) VALUES($1,$2)',[manifest.contentVersion,JSON.stringify(places)]);
  await client.query('COMMIT');
  console.log(`Synchronized guide content ${manifest.contentVersion} (${places.length} places).`);
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
bootstrap();




