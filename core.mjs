export const APP_VERSION = '0.4.0-map-r1';
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_JPEG_QUALITY = 0.78;
export const BACKUP_FORMAT = 'cropchronicle-backup-v1';
export const BACKUP_REMINDER_DAYS = 7;
export const PLACE_TYPES = ['field','greenhouse','barn','pasture','herd/pen'];
export const ENTITY_STORES = {farm:'farms',place:'places',place_boundary:'boundaries',season:'seasons',observation:'observations',ag_sample:'ag_samples',harvest:'harvests',application:'applications',experiment:'experiments',weather_snapshot:'weather_snapshots',reference_layer:'reference_layers',sharing:'sharing',event:'events',media:'media',task:'tasks'};

export function newId(prefix='cc') {
  const id=globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}
export function createVersioned(input, now=new Date().toISOString()) { return {...input,version:1,updatedAt:now}; }
export function updateVersioned(current, changes, now=new Date().toISOString()) {
  if(!current || !Number.isInteger(current.version) || current.version<1) throw new Error('A current versioned record is required.');
  return {...current,...changes,version:current.version+1,updatedAt:now};
}
export function migrateLegacyFieldRecord(field) {
  return {...field,type:field.type||'field'};
}
export function migrateLegacyOutboxMutation(mutation) {
  let entityType=mutation.entityType==='field'?'place':mutation.entityType==='field_boundary'?'place_boundary':mutation.entityType;
  let payload=mutation.payload;
  if(payload && typeof payload==='object') {
    payload={...payload};
    if(!payload.placeId && payload.fieldId) payload.placeId=payload.fieldId;
    if(entityType==='place' && !payload.type) payload.type='field';
  }
  return {...mutation,entityType,payload};
}
export function makeOutboxMutation(entityType, entity, operation, baseVersion, now=new Date().toISOString()) {
  if(!ENTITY_STORES[entityType]) throw new Error(`Unsupported entity type: ${entityType}`);
  return {mutationId:newId('mut'),entityType,entityId:entity.id,operation,baseVersion:baseVersion??null,payload:clone(entity),createdAt:now};
}
export function sortTimeline(events) {
  return [...events].sort((a,b)=>String(b.occurredAt??'').localeCompare(String(a.occurredAt??'')) || String(b.createdAt??b.updatedAt??'').localeCompare(String(a.createdAt??a.updatedAt??'')));
}
export function fitWithin(width,height,maxEdge=PHOTO_MAX_EDGE) {
  if(!(width>0)||!(height>0)) throw new Error('Invalid image dimensions.');
  const largest=Math.max(width,height); if(largest<=maxEdge) return {width:Math.round(width),height:Math.round(height),scale:1};
  const scale=maxEdge/largest; return {width:Math.round(width*scale),height:Math.round(height*scale),scale};
}
export function buildBackupEnvelope(data, exportedAt=new Date().toISOString()) { return {format:BACKUP_FORMAT,exportedAt,app:'CropChronicle',appVersion:APP_VERSION,data}; }
export function backupAgeDays(lastBackupAt, nowIso=new Date().toISOString()) {
  if(!lastBackupAt) return null;
  const ms=Date.parse(nowIso)-Date.parse(lastBackupAt);
  if(!Number.isFinite(ms)) return null;
  return Math.max(0,Math.floor(ms/86400000));
}
export function backupReminderDue(lastBackupAt, nowIso=new Date().toISOString()) {
  const age=backupAgeDays(lastBackupAt,nowIso);
  return age !== null && age >= BACKUP_REMINDER_DAYS;
}
export function normalizeRepeat(kind='none', everyNDays=1, dueDate='') {
  if(kind==='daily') return {kind:'daily'};
  if(kind==='weekly') return {kind:'weekly'};
  if(kind==='every_n_days') return {kind:'every_n_days',interval:Math.max(1,Number.parseInt(everyNDays,10)||1)};
  if(kind==='monthly') return {kind:'monthly',anchorDay:parseDateOnly(dueDate).day};
  return {kind:'none'};
}
export function nextRepeatDue(dueDate, repeat, completedOn) {
  if(!repeat || repeat.kind==='none') return null;
  let next=advanceRepeat(dueDate,repeat);
  while(next<=completedOn) next=advanceRepeat(next,repeat);
  return next;
}
export function groupTasksForToday(tasks, today) {
  const open=tasks.filter((t)=>t.status==='open');
  const through=addDays(today,7);
  const sort=(xs)=>xs.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.title.localeCompare(b.title));
  return {
    overdue:sort(open.filter((t)=>t.dueDate<today)),
    today:sort(open.filter((t)=>t.dueDate===today)),
    next7:sort(open.filter((t)=>t.dueDate>today&&t.dueDate<=through)),
  };
}
function advanceRepeat(date, repeat) {
  if(repeat.kind==='daily') return addDays(date,1);
  if(repeat.kind==='weekly') return addDays(date,7);
  if(repeat.kind==='every_n_days') return addDays(date,Math.max(1,repeat.interval||1));
  if(repeat.kind==='monthly') {
    const {year,month}=parseDateOnly(date);
    const serial=year*12+(month-1)+1;
    const y=Math.floor(serial/12),m=(serial%12)+1;
    const d=Math.min(repeat.anchorDay||parseDateOnly(date).day,daysInMonth(y,m));
    return formatDateOnly(y,m,d);
  }
  return null;
}
function addDays(date, days) {
  const {year,month,day}=parseDateOnly(date);
  const d=new Date(Date.UTC(year,month-1,day+days));
  return formatDateOnly(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());
}
function parseDateOnly(value) {
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');
  if(!m) throw new Error(`Invalid date: ${value}`);
  return {year:Number(m[1]),month:Number(m[2]),day:Number(m[3])};
}
function formatDateOnly(y,m,d){return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function daysInMonth(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate();}
function clone(value){ if(globalThis.structuredClone) return globalThis.structuredClone(value); return JSON.parse(JSON.stringify(value)); }
