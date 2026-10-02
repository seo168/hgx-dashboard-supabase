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

const rows=parseCsv(csv).slice(1).filter(row=>String(row[2]||'').trim());
const staff=rows.map(row=>({
  platform:String(row[0]||'').trim(),
  group_name:String(row[1]||'').trim(),
  staff_id:String(row[2]||'').trim(),
  name:String(row[3]||'').trim(),
  role:String(row[4]||'').trim(),
  shift:String(row[5]||'').trim(),
  join_date:String(row[6]||'').trim(),
  status:String(row[7]||'').trim(),
  country:String(row[8]||'').trim(),
  department:String(row[9]||'').trim()
}));

const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'};
for(let index=0;index<staff.length;index+=200){
  const response=await fetch(`${supabaseUrl}/rest/v1/staff_master?on_conflict=staff_id`,{method:'POST',headers,body:JSON.stringify(staff.slice(index,index+200))});
  if(!response.ok)throw new Error(`Supabase upsert failed: ${response.status} ${await response.text()}`);
}

const ids=staff.map(item=>`"${item.staff_id.replaceAll('"','\\"')}"`).join(',');
if(ids){
  const response=await fetch(`${supabaseUrl}/rest/v1/staff_master?staff_id=not.in.(${encodeURIComponent(ids)})`,{method:'DELETE',headers});
  if(!response.ok)throw new Error(`Supabase stale-row cleanup failed: ${response.status} ${await response.text()}`);
}

console.log(`Synced ${staff.length} staff rows from Google Sheet to Supabase.`);
