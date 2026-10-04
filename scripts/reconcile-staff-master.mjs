const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'};
const request=async(path,init={})=>{
  const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{...headers,...init.headers}});
  const text=await response.text();
  if(!response.ok)throw new Error(`${response.status} ${text}`);
  return text?JSON.parse(text):null;
};

const transferred=new Map([
  ['334220.0','爱林'],['354855.0','小二'],['355045.0','小弟'],['355054.0','小姗'],
  ['355056.0','小龙'],['355058.0','星星'],['355060.0','阿里'],['355062.0','阿桑'],
  ['355434.0','尤达'],['356026.0','安斯'],['356109.0','阿亚'],['356114.0','雷沃'],
  ['356263.0','发尼'],['358485.0','威利'],['JA525081201','伟航'],['JA525092601','PUDGE']
]);

const all=await request('staff_master?select=*&limit=1000');
for(const [employeeId,employeeName] of transferred){
  const matches=all.filter(row=>row.employee_id===employeeId&&row.employee_name===employeeName);
  if(matches.length!==1)throw new Error(`Expected one exact row for ${employeeId} ${employeeName}, found ${matches.length}`);
}

for(const [employeeId] of transferred){
  await request(`staff_master?employee_id=eq.${encodeURIComponent(employeeId)}`,{
    method:'PATCH',body:JSON.stringify({work_mode:'现场转居家',updated_at:new Date().toISOString()})
  });
}

const adeRows=all.filter(row=>row.employee_name==='阿德'&&String(row.employee_id||'').replace(/\.0$/,'')==='355683');
if(adeRows.length!==2)throw new Error(`Expected two 阿德 rows before reconciliation, found ${adeRows.length}`);
const onsite=adeRows.find(row=>row.work_mode==='现场');
const home=adeRows.find(row=>row.id!==onsite?.id);
if(!onsite||!home)throw new Error('Cannot identify 阿德 onsite and home rows');
const merged={
  employee_id:'355683',employee_name:'阿德',role:'财务',department:'财务',
  shift:onsite.shift||home.shift||'夜班',country:'印尼',work_mode:'现场',join_date:'2025-11-17',
  account_name:onsite.account_name||home.account_name||'',platform:onsite.platform||'印度',
  group_name:'财务',status:'在职',platform_country:'印度',resign_date:null,
  work_telegram:home.work_telegram||onsite.work_telegram||'',
  backend_account:onsite.backend_account||home.backend_account||'',
  bank_account:home.bank_account||onsite.bank_account||'',
  bank_holder:home.bank_holder||onsite.bank_holder||'',bank_name:home.bank_name||onsite.bank_name||'',
  updated_at:new Date().toISOString()
};
await request(`staff_master?id=eq.${onsite.id}`,{method:'PATCH',body:JSON.stringify(merged)});
await request(`staff_master?id=eq.${home.id}`,{method:'DELETE'});

const verified=await request('staff_master?select=id,employee_id,employee_name,work_mode,status&limit=1000');
const transferredRows=verified.filter(row=>row.work_mode==='现场转居家');
const invalidTransferred=[...transferred].filter(([employeeId,employeeName])=>!transferredRows.some(row=>row.employee_id===employeeId&&row.employee_name===employeeName));
const adeVerified=verified.filter(row=>row.employee_name==='阿德');
if(verified.length!==222)throw new Error(`Expected 222 staff rows, found ${verified.length}`);
if(transferredRows.length!==16||invalidTransferred.length)throw new Error(`Transfer verification failed: ${JSON.stringify(invalidTransferred)}`);
if(adeVerified.length!==1||adeVerified[0].work_mode!=='现场'||adeVerified[0].employee_id!=='355683')throw new Error(`阿德 verification failed: ${JSON.stringify(adeVerified)}`);
console.log(JSON.stringify({total:verified.length,transferred:transferredRows.length,onsite:verified.filter(row=>row.work_mode==='现场').length,home:verified.filter(row=>row.work_mode==='居家').length,ade:adeVerified[0]},null,2));
