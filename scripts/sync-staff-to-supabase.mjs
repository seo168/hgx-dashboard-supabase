const sheetUrl = process.env.STAFF_GOOGLE_SHEET_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sheetUrl || !supabaseUrl || !serviceKey) {
  throw new Error('Missing STAFF_GOOGLE_SHEET_URL, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY');
}

function parseCsv(text) {
  const rows=[];
  let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i],next=text[i+1];
    if(char==='"'&&quoted&&next==='"'){cell+='"';i++;continue;}
    if(char==='"'){quoted=!quoted;continue;}
    if(char===','&&!quoted){row.push(cell.trim());cell='';continue;}
    if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';continue;}
    cell+=char;
  }
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  return rows;
}

const sheetResponse=await fetch(`${sheetUrl}${sheetUrl.includes('?')?'&':'?'}t=${Date.now()}`);
if(!sheetResponse.ok)throw new Error(`Google Sheet returned HTTP ${sheetResponse.status}`);
const csv=await sheetResponse.text();
if(/^\s*</.test(csv))throw new Error('Google Sheet returned HTML instead of CSV');

const parsedRows=parseCsv(csv);
const sheetHeaders=parsedRows[0]||[];
const remarkIndex=sheetHeaders.findIndex(cell=>String(cell||'').trim()==='备注');
const isResignedRemark=value=>/(?:resign(?:ed)?|辞职|离职|已离职)/i.test(String(value||'').trim());
const rows=parsedRows.slice(1).filter(row=>{
  const employeeId=String(row[2]||'').trim();
  const remark=remarkIndex>=0?row[remarkIndex]:row[14];
  return employeeId&&!isResignedRemark(remark);
});
const monthNames={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
function normalizeJoinDate(value){
  const raw=String(value||'').trim();if(!raw)return null;
  const full=raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(full)return `${full[1]}-${String(full[2]).padStart(2,'0')}-${String(full[3]).padStart(2,'0')}`;
  const partial=raw.toLowerCase().match(/([a-z]+)\s+(\d{1,2})/);if(!partial||monthNames[partial[1]]===undefined)return null;
  const today=new Date(),date=new Date(today.getFullYear(),monthNames[partial[1]],Number(partial[2]));if(date>today)date.setFullYear(date.getFullYear()-1);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
const staff=rows.map(row=>({
  platform:String(row[0]||'').trim(),
  group_name:String(row[1]||'').trim(),
  employee_id:String(row[2]||'').trim(),
  employee_name:String(row[3]||'').trim(),
  role:String(row[1]||'').trim(),
  shift:String(row[5]||'').trim(),
  join_date:normalizeJoinDate(row[6]),
  status:String(row[7]||'').trim(),
  country:String(row[8]||'').trim(),
  department:String(row[9]||'').trim(),
  work_mode:String(row[10]||'').trim(),
  account_name:String(row[4]||'').trim(),
  updated_at:new Date().toISOString()
}));

const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'};
for(let index=0;index<staff.length;index+=200){
  const response=await fetch(`${supabaseUrl}/rest/v1/staff_master?on_conflict=employee_id`,{method:'POST',headers,body:JSON.stringify(staff.slice(index,index+200))});
  if(!response.ok)throw new Error(`Supabase upsert failed: ${response.status} ${await response.text()}`);
}

const ids=staff.map(item=>`"${item.employee_id.replaceAll('"','\\"')}"`).join(',');
if(ids){
  const response=await fetch(`${supabaseUrl}/rest/v1/staff_master?employee_id=not.in.(${encodeURIComponent(ids)})`,{method:'DELETE',headers});
  if(!response.ok)throw new Error(`Supabase stale-row cleanup failed: ${response.status} ${await response.text()}`);
}

console.log(`Synced ${staff.length} staff rows from Google Sheet to Supabase.`);
