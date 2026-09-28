export const CROP_CATEGORIES=['corn','soybean','wheat','barley','oats','rye','sorghum','alfalfa_hay','pasture','cover_crop','fallow','orchard_perennial','vegetable_specialty','greenhouse','other'];
const ALIASES=new Map([['maize','corn'],['corn','corn'],['soy','soybean'],['soybean','soybean'],['soybeans','soybean'],['hay','alfalfa_hay'],['alfalfa','alfalfa_hay'],['cover crop','cover_crop'],['orchard','orchard_perennial'],['vegetable','vegetable_specialty']]);
export function normalizeCrop(value=''){const key=String(value).trim().toLowerCase();const normalized=ALIASES.get(key)??key.replace(/[ -]+/g,'_');return CROP_CATEGORIES.includes(normalized)?normalized:'other';}
export function polygonAreaAcres(points=[]){
  if(points.length<3)return 0;
  const meanLat=points.reduce((s,p)=>s+Number(p.lat),0)/points.length;
  const metersPerDegLat=111132.92;
  const metersPerDegLon=111412.84*Math.cos(meanLat*Math.PI/180);
  const xy=points.map(p=>({x:Number(p.lon)*metersPerDegLon,y:Number(p.lat)*metersPerDegLat}));
  let twice=0;for(let i=0;i<xy.length;i++){const a=xy[i],b=xy[(i+1)%xy.length];twice+=a.x*b.y-b.x*a.y;}
  return Math.abs(twice)/2/4046.8564224;
}
export function sourceFreshness(record,nowIso=new Date().toISOString()){
  if(!record?.retrievedAt)return 'unknown';
  if(record.staleAfter&&Date.parse(nowIso)>Date.parse(record.staleAfter))return 'stale';
  return 'fresh';
}
export function buildAgProvenance(input={}){
  if(!String(input.provider??'').trim())throw new Error('Agricultural information requires a provider/source.');
  if(!input.retrievedAt||!Number.isFinite(Date.parse(input.retrievedAt)))throw new Error('Agricultural information requires retrievedAt.');
  return {kind:input.kind??'external',provider:String(input.provider),sourceUrl:input.sourceUrl??null,datasetId:input.datasetId??null,retrievedAt:input.retrievedAt,observedAt:input.observedAt??null,forecastFor:input.forecastFor??null,validFrom:input.validFrom??null,validTo:input.validTo??null,resolution:input.resolution??null,units:input.units??null,limitations:input.limitations??null,license:input.license??null,attribution:input.attribution??null,staleAfter:input.staleAfter??null};
}
export const ALMANAC_KINDS=['measured','forecast','agronomic_reference','traditional'];
export function almanacLabel(kind){return ({measured:'Measured / recorded',forecast:'Forecast',agronomic_reference:'Agronomic reference',traditional:'Traditional almanac — not established agronomic fact'})[kind]??'Unclassified';}

export const CROP_VISUALS={
 corn:{label:'Corn / maize',pattern:'vertical'},soybean:{label:'Soybean',pattern:'dots'},wheat:{label:'Wheat',pattern:'diagonal'},barley:{label:'Barley',pattern:'cross'},oats:{label:'Oats',pattern:'horizontal'},rye:{label:'Rye',pattern:'diagonal'},sorghum:{label:'Sorghum',pattern:'dots'},alfalfa_hay:{label:'Alfalfa / hay',pattern:'cross'},pasture:{label:'Pasture',pattern:'horizontal'},cover_crop:{label:'Cover crop',pattern:'diagonal'},fallow:{label:'Fallow',pattern:'none'},orchard_perennial:{label:'Orchard / perennial',pattern:'dots'},vegetable_specialty:{label:'Vegetable / specialty',pattern:'cross'},greenhouse:{label:'Greenhouse',pattern:'none'},other:{label:'Other / unknown',pattern:'none'}
};
export const SCOUT_CATEGORIES=['weed','insect','disease','nutrient','water','wildlife','damage','other'];
export const SCOUT_SEVERITIES=['trace','low','moderate','high'];
export function validateScout(input={}){
 const category=SCOUT_CATEGORIES.includes(input.category)?input.category:'other',severity=SCOUT_SEVERITIES.includes(input.severity)?input.severity:'low',notes=String(input.notes??'').trim();
 if(!notes)throw new Error('Scouting notes are required.');
 const location=input.location&&Number.isFinite(Number(input.location.lat))&&Number.isFinite(Number(input.location.lon))?{lat:Number(input.location.lat),lon:Number(input.location.lon),accuracy:Number(input.location.accuracy)||null}:null;
 return {category,severity,notes,location};
}

export function growingDegreeDays({tMin,tMax,base=50,cap=86}={}){
  for(const n of [tMin,tMax,base,cap])if(!Number.isFinite(Number(n)))throw new Error('GDD temperatures must be numeric.');
  const lo=Math.min(Number(tMin),Number(cap)),hi=Math.min(Number(tMax),Number(cap));
  return Math.max(0,((lo+hi)/2)-Number(base));
}
export function precipitationTotal(records=[]){
  return records.reduce((sum,r)=>sum+(Number.isFinite(Number(r.precipitation))?Number(r.precipitation):0),0);
}
export function daylightHours({sunrise,sunset}={}){
  const a=Date.parse(sunrise),b=Date.parse(sunset);if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return null;return (b-a)/36e5;
}
export function weatherSnapshot(input={}){
  const provenance=buildAgProvenance(input.provenance??{});
  const values={temperature:numOrNull(input.temperature),humidity:numOrNull(input.humidity),windSpeed:numOrNull(input.windSpeed),windDirection:numOrNull(input.windDirection),windGust:numOrNull(input.windGust),precipitation:numOrNull(input.precipitation),dewPoint:numOrNull(input.dewPoint),soilTemperature:numOrNull(input.soilTemperature),soilMoisture:numOrNull(input.soilMoisture)};
  return {id:input.id??null,kind:input.kind??'measured',values,provenance};
}
function numOrNull(v){return v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);}
export function almanacCard({kind,title,value='',detail='',provenance=null}={}){
  if(!ALMANAC_KINDS.includes(kind))throw new Error('Unknown almanac information kind.');
  if(!String(title).trim())throw new Error('Almanac cards require a title.');
  return {kind,title:String(title),value:String(value),detail:String(detail),label:almanacLabel(kind),provenance};
}
export function sprayWeatherFlags({windSpeed,windGust,precipitation,temperature}={}){
  const flags=[];if(Number.isFinite(Number(windSpeed)))flags.push({code:'wind',value:Number(windSpeed),message:'Check product label wind limits and local rules.'});
  if(Number.isFinite(Number(windGust)))flags.push({code:'gust',value:Number(windGust),message:'Gusts can increase drift risk; check the applicable label.'});
  if(Number(precipitation)>0)flags.push({code:'rain',value:Number(precipitation),message:'Rain is recorded/forecast; check rainfast requirements on the applicable label.'});
  if(Number.isFinite(Number(temperature)))flags.push({code:'temperature',value:Number(temperature),message:'Check label temperature restrictions and crop conditions.'});
  return flags;
}
export function frostContext({temperature,forecastLow}={}){
  const values=[temperature,forecastLow].filter(v=>Number.isFinite(Number(v))).map(Number);if(!values.length)return {level:'unknown',message:'No sourced temperature data.'};
  const low=Math.min(...values);if(low<=28)return {level:'hard_freeze_possible',message:'Temperature data is at or below 28°F.'};if(low<=32)return {level:'freeze_possible',message:'Temperature data is at or below 32°F.'};if(low<=36)return {level:'frost_watch',message:'Temperature is near freezing; local frost can vary by terrain and conditions.'};return {level:'none_from_temperature',message:'Provided temperature data is above 36°F.'};
}

export function fieldIntelligence({place=null,boundary=null,season=null,weather=null,scouts=[],tasks=[],events=[],layers={}}={}){
 const acres=boundary?.acreageOverride??boundary?.acreageCalculated??place?.acreage??null,crop=season?.crop?normalizeCrop(season.crop):null,temp=weather?.values?.temperature??null;
 const frost=weather?frostContext({temperature:temp}):{level:'unknown',message:'No sourced temperature data.'};
 const gdd=weather&&Number.isFinite(Number(weather.values?.temperature))?null:null;
 const openTasks=tasks.filter(t=>t.status!=='done'),recentScouts=scouts.slice().sort((a,b)=>String(b.observedAt??b.createdAt).localeCompare(String(a.observedAt??a.createdAt))).slice(0,5),recentEvents=events.slice().sort((a,b)=>String(b.occurredAt??b.createdAt).localeCompare(String(a.occurredAt??a.createdAt))).slice(0,5);
 return {placeId:place?.id??null,name:place?.name??'Field',type:place?.type??null,acres,crop,cropLabel:crop?(CROP_VISUALS[crop]?.label??crop):null,variety:season?.variety??null,plantedAt:season?.plantedAt??null,seasonStatus:season?.status??null,weather:weather?{temperature:temp,humidity:weather.values?.humidity??null,windSpeed:weather.values?.windSpeed??null,precipitation:weather.values?.precipitation??null,freshness:sourceFreshness(weather.provenance),provider:weather.provenance?.provider??'Unknown source'}:null,frost,openTasks,recentScouts,recentEvents,layers:{soil:Boolean(layers.soil),cropContext:Boolean(layers.cropContext),slope:Boolean(layers.slope),water:Boolean(layers.water)}};
}

export function normalizeYield({amount,unit,acres}={}){
 const a=Number(amount),land=Number(acres);if(!Number.isFinite(a)||a<0)throw new Error('Yield amount must be zero or greater.');
 const u=String(unit||'').trim();if(!u)throw new Error('Yield unit is required.');
 return {amount:a,unit:u,acres:Number.isFinite(land)&&land>0?land:null,perAcre:Number.isFinite(land)&&land>0?a/land:null};
}
export function fieldSeasonHistory({seasons=[],events=[],harvests=[],scouts=[],tasks=[]}={}){
 const years=new Set();
 for(const x of [...seasons,...events,...harvests,...scouts,...tasks]){const y=Number(x.year??String(x.occurredAt??x.observedAt??x.createdAt??'').slice(0,4));if(Number.isInteger(y)&&y>1900)years.add(y);}
 return [...years].sort((a,b)=>b-a).map(year=>{const season=seasons.find(s=>Number(s.year)===year)??null,hs=harvests.filter(h=>Number(h.year??String(h.harvestedAt??h.createdAt??'').slice(0,4))===year),yieldTotal=hs.reduce((n,h)=>n+(Number(h.amount)||0),0),units=[...new Set(hs.map(h=>h.unit).filter(Boolean))],eventsForYear=events.filter(e=>Number(e.year??String(e.occurredAt??e.createdAt??'').slice(0,4))===year),scoutsForYear=scouts.filter(e=>Number(e.year??String(e.observedAt??e.createdAt??'').slice(0,4))===year);
 return {year,crop:season?.crop?normalizeCrop(season.crop):null,variety:season?.variety??null,plantedAt:season?.plantedAt??null,status:season?.status??null,harvestCount:hs.length,yieldTotal:units.length<=1?yieldTotal:null,yieldUnit:units.length===1?units[0]:null,mixedYieldUnits:units.length>1,scoutCount:scoutsForYear.length,eventCount:eventsForYear.length,harvests:hs};
 });
}
export function historyComparisonNote(rows=[]){if(rows.length<2)return 'Add another season before comparing field history.';return 'Season history is descriptive. Differences in yield or observations do not by themselves establish what caused the change.';}

export function seasonWeatherSummary(records=[],{base=50}={}){
 const rows=records.filter(r=>r?.kind!=='forecast').slice().sort((a,b)=>String(a.provenance?.observedAt??a.createdAt).localeCompare(String(b.provenance?.observedAt??b.createdAt)));
 let gdd=0,precip=0,days=0;for(const r of rows){const v=r.values??{},hi=v.highTemperature??v.temperature,lo=v.lowTemperature??v.temperature;if(Number.isFinite(Number(hi))&&Number.isFinite(Number(lo))){gdd+=growingDegreeDays({tMin:Number(lo),tMax:Number(hi),base});days++;}if(Number.isFinite(Number(v.precipitation)))precip+=Number(v.precipitation);}
 return {gdd,precipitation:precip,temperatureDays:days,recordCount:rows.length,base};
}
export function cropRotation(seasons=[]){return seasons.slice().sort((a,b)=>Number(a.year)-Number(b.year)).map(s=>({year:Number(s.year),crop:s.crop?normalizeCrop(s.crop):null,variety:s.variety??null}));}
export function applicationRecord(input={}){
 const appliedAt=String(input.appliedAt||'');if(!/^\d{4}-\d{2}-\d{2}/.test(appliedAt))throw new Error('Application date is required.');
 const category=String(input.category||'').trim();if(!category)throw new Error('Application category is required.');
 const product=String(input.product||'').trim();if(!product)throw new Error('Record the product or material actually applied.');
 const rate=input.rate===''||input.rate==null?null:Number(input.rate);if(rate!==null&&(!Number.isFinite(rate)||rate<0))throw new Error('Recorded rate must be zero or greater.');
 const rateUnit=rate===null?null:String(input.rateUnit||'').trim();if(rate!==null&&!rateUnit)throw new Error('A unit is required for a recorded rate.');
 return {appliedAt,year:Number(appliedAt.slice(0,4)),category,product,rate,rateUnit,totalAmount:input.totalAmount===''||input.totalAmount==null?null:Number(input.totalAmount),notes:String(input.notes||'').trim(),source:'farmer_recorded',advisory:false};
}
export function yieldTrend(history=[]){return history.filter(r=>r.harvestCount&&!r.mixedYieldUnits&&Number.isFinite(Number(r.yieldTotal))).map(r=>({year:r.year,value:Number(r.yieldTotal),unit:r.yieldUnit}));}

export function farmToday({places=[],boundaries=[],seasons=[],tasks=[],scouts=[],weather=null,harvests=[],now=new Date().toISOString()}={}){
 const today=String(now).slice(0,10),boundaryPlaces=new Set(boundaries.map(x=>x.placeId)),seasonPlaces=new Set(seasons.map(x=>x.placeId)),harvestPlaces=new Set(harvests.map(x=>x.placeId)),items=[];
 for(const t of tasks.filter(x=>x.status!=='done')){const due=String(t.dueAt??t.dueDate??'').slice(0,10),level=due&&due<today?'overdue':due===today?'due_today':'open';items.push({kind:'task',level,placeId:t.placeId??null,title:t.title??'Open task',reason:due?('Due '+due):'Open work item'});}
 for(const o of scouts){if(['high','moderate'].includes(o.severity))items.push({kind:'scouting',level:o.severity==='high'?'attention':'review',placeId:o.placeId,title:(o.category??'Scouting')+' observation',reason:(o.severity??'')+(o.notes?' · '+o.notes:'')});}
 if(weather){const frost=frostContext({temperature:weather.values?.temperature});if(frost.level!=='none_from_temperature'&&frost.level!=='unknown')items.push({kind:'weather',level:'review',placeId:null,title:'Temperature / frost context',reason:frost.message});}
 for(const p of places.filter(x=>x.type==='field')){if(!boundaryPlaces.has(p.id))items.push({kind:'record_gap',level:'setup',placeId:p.id,title:p.name+': map boundary missing',reason:'No saved field boundary.'});if(!seasonPlaces.has(p.id))items.push({kind:'record_gap',level:'setup',placeId:p.id,title:p.name+': crop/season missing',reason:'No season record.'});}
 const active=seasons.filter(s=>['growing','harvest_ready'].includes(s.status));for(const s of active){if(s.status==='harvest_ready'&&!harvestPlaces.has(s.placeId))items.push({kind:'harvest',level:'review',placeId:s.placeId,title:'Harvest-ready field has no harvest record',reason:'Season is marked harvest ready.'});}
 const order={overdue:0,attention:1,due_today:2,review:3,open:4,setup:5};items.sort((a,b)=>(order[a.level]??9)-(order[b.level]??9));
 return {date:today,items,counts:{fields:places.filter(x=>x.type==='field').length,openTasks:tasks.filter(x=>x.status!=='done').length,attention:items.filter(x=>['overdue','attention','due_today','review'].includes(x.level)).length,recordGaps:items.filter(x=>x.kind==='record_gap').length}};
}
