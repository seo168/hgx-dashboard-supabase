import {gunzipSync} from 'node:zlib';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const encoded=process.env.STAFF_BANK_FIX_B64;
if(!url||!key||!encoded)throw new Error('Missing Supabase environment or STAFF_BANK_FIX_B64');
const corrections=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
if(!Array.isArray(corrections)||corrections.length!==203)throw new Error(`Expected 203 verified bank rows, found ${corrections?.length}`);

const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'};
const request=async(path,init={})=>{
  const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{...headers,...init.headers}});
  const text=await response.text();
  if(!response.ok)throw new Error(`${response.status} ${text}`);
  return text?JSON.parse(text):null;
};
const normalizeId=value=>String(value||'').trim().replace(/\.0$/,'');
const all=await request('staff_master?select=id,employee_id,employee_name&limit=1000');
const used=new Set();
for(const correction of corrections){
  const matches=all.filter(row=>normalizeId(row.employee_id)===normalizeId(correction.employee_id)&&row.employee_name===correction.employee_name);
  if(matches.length!==1)throw new Error(`Expected one row for ${correction.employee_id} ${correction.employee_name}, found ${matches.length}`);
  const row=matches[0];
  if(used.has(row.id))throw new Error(`Duplicate correction target ${row.id}`);
  used.add(row.id);
  await request(`staff_master?id=eq.${row.id}`,{
    method:'PATCH',body:JSON.stringify({
      employee_id:normalizeId(correction.employee_id),
      bank_account:correction.bank_account,
      bank_holder:correction.bank_holder,
      bank_name:correction.bank_name,
      updated_at:new Date().toISOString()
    })
  });
}

const verified=await request('staff_master?select=id,employee_id,employee_name,bank_account,bank_holder,bank_name&limit=1000');
const failures=corrections.filter(correction=>!verified.some(row=>
  row.employee_id===normalizeId(correction.employee_id)&&row.employee_name===correction.employee_name&&
  String(row.bank_account||'')===correction.bank_account&&String(row.bank_holder||'')===correction.bank_holder&&String(row.bank_name||'')===correction.bank_name
));
const decimalIds=verified.filter(row=>/\.0$/.test(row.employee_id));
if(failures.length||decimalIds.length)throw new Error(`Verification failed: bank=${failures.length}, decimalIds=${decimalIds.length}`);
console.log(JSON.stringify({updated:corrections.length,total:verified.length,decimalIds:decimalIds.length},null,2));
