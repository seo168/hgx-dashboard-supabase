import {gunzipSync} from 'node:zlib';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,encoded=process.env.STAFF_IMPORT_DATA_B64;
if(!url||!key||!encoded)throw new Error('Missing import environment');
const payload=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'};
async function request(path,options={}){const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{...headers,...options.headers}});if(!r.ok)throw new Error(`${path}: ${r.status} ${await r.text()}`);return r;}
for(let i=0;i<payload.staff.length;i+=100)await request('staff_master?on_conflict=employee_id',{method:'POST',body:JSON.stringify(payload.staff.slice(i,i+100))});
const current=await (await request('staff_master?select=employee_id,work_mode&limit=1000')).json();
const imported=new Set(payload.staff.map(x=>x.employee_id));
for(const row of current)if(row.work_mode!=='现场'&&!imported.has(row.employee_id))await request(`staff_master?employee_id=eq.${encodeURIComponent(row.employee_id)}`,{method:'DELETE'});
await request('staff_events?created_by=is.null',{method:'DELETE'});
for(let i=0;i<payload.events.length;i+=100)await request('staff_events',{method:'POST',body:JSON.stringify(payload.events.slice(i,i+100))});
for(let i=0;i<payload.performance.length;i+=100)await request('staff_monthly_performance?on_conflict=employee_id,period,source_sheet',{method:'POST',body:JSON.stringify(payload.performance.slice(i,i+100))});
console.log(`Imported ${payload.staff.length} staff, ${payload.events.length} events, ${payload.performance.length} performance rows.`);
