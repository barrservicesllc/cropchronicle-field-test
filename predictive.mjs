// CropChronicle R1: deterministic, offline, explainable field pattern engine.
// No external inference, pesticide prescriptions, or automatic nutrient dosing.
const dateOf=r=>String(r?.sampledAt??r?.observedAt??r?.appliedAt??r?.harvestedAt??r?.occurredAt??r?.createdAt??'').slice(0,10);
const yearOf=r=>Number(r?.year??dateOf(r).slice(0,4));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const byYear=(records,y)=>records.filter(r=>yearOf(r)===y);
const evidence=(kind,records)=>records.map(r=>({kind,id:r.id??null,date:dateOf(r),source:r.provenance?.provider??r.source??'Farmer record'}));
const make=(id,title,observation,nextStep,records,level='exploratory')=>({id,title,observation,nextStep,evidence:records,confidence:level,advisory:false,causal:false});
export function nutrientSamples(samples=[],nutrient='K'){
 const key=nutrient.toLowerCase();return samples.filter(s=>finite(s.values?.[nutrient]??s.values?.[key]??s[nutrient]??s[key])).map(s=>({date:dateOf(s),value:num(s.values?.[nutrient]??s.values?.[key]??s[nutrient]??s[key]),unit:s.units?.[nutrient]??s.units?.[key]??s.unit??null,method:s.method??null,id:s.id??null,source:s.provenance?.provider??s.lab??'Farmer-entered sample'})).filter(s=>s.date).sort((a,b)=>a.date.localeCompare(b.date));
}
export function numericTrend(points=[]){if(points.length<2)return null;const a=points[0],b=points[points.length-1];if(!finite(a.value)||!finite(b.value))return null;return {first:a.value,last:b.value,change:b.value-a.value,direction:b.value>a.value?'increasing':b.value<a.value?'decreasing':'unchanged',count:points.length};}
export function almanacPattern({seasons=[],harvests=[],almanac=[]}={}){
 // Almanac labels are displayed for exploration, never treated as causal evidence.
 const years=new Set(harvests.map(yearOf));return almanac.filter(a=>years.has(yearOf(a))).map(a=>({year:yearOf(a),title:a.title??'Traditional almanac note',kind:a.kind??'traditional',id:a.id??null,interpretation:'Historical coincidence only; no demonstrated causal relationship.'}));
}
export function fieldPatternReport({place=null,seasons=[],harvests=[],applications=[],samples=[],weather=[],scouts=[],almanac=[],asOf=new Date().toISOString()}={}){
 const pid=place?.id;if(!pid)return {placeId:null,mode:'no_field',suggestions:[],coverage:{},patterns:[]};
 const own=xs=>xs.filter(x=>x.placeId===pid);
 const ss=own(seasons),hs=own(harvests),apps=own(applications),labs=own(samples),obs=own(scouts),notes=own(almanac);
 const years=[...new Set(ss.map(yearOf).filter(y=>y>1900))].sort((a,b)=>a-b);
 const suggestions=[],patterns=[];
 if(!labs.length)suggestions.push(make('soil-sample-needed','Establish measured soil fertility','No field-linked soil or plant laboratory samples are recorded.','Obtain a representative soil test and record its lab, method, units and sampling date.',[], 'evidence_gap'));
 for(const nutrient of ['N','P','K','pH','organicMatter']){
  const rows=nutrientSamples(labs,nutrient),methods=[...new Set(rows.map(x=>x.method??'unknown'))],units=[...new Set(rows.map(x=>x.unit??'unknown'))];
  if(rows.length>=2&&methods.length===1&&units.length===1){const t=numericTrend(rows);patterns.push({kind:'measured_nutrient_trend',nutrient,trend:t,unit:units[0],method:methods[0],samples:rows});if(t.direction!=='unchanged')suggestions.push(make('review-'+nutrient,'Review measured '+nutrient+' trend',nutrient+' changed from '+t.first+' to '+t.last+' '+units[0]+' across '+t.count+' comparable samples.','Review sampling consistency and consult local agronomic guidance before changing inputs.',evidence('soil_sample',labs.filter(x=>rows.some(y=>y.id===x.id))),'observed'));}
  else if(rows.length>=2)patterns.push({kind:'incomparable_nutrient_samples',nutrient,reason:'Different or missing lab methods/units; do not compare values.'});
 }
 if(apps.length&&!labs.length)suggestions.push(make('applications-unverified','Applications do not measure nutrient availability',apps.length+' application records exist but no soil/plant tests establish current nutrient levels.','Add soil/plant measurements before assessing nutrient sufficiency.',evidence('application',apps),'evidence_gap'));
 const yields=hs.filter(h=>finite(h.perAcre)&&h.unit).map(h=>({year:yearOf(h),crop:ss.find(s=>yearOf(s)===yearOf(h))?.crop??null,value:Number(h.perAcre),unit:h.unit,id:h.id}));
 const groups=new Map();for(const h of yields){const key=h.crop+'|'+h.unit;groups.set(key,[...(groups.get(key)??[]),h]);}
 for(const [key,rows] of groups){const unique=[...new Set(rows.map(r=>r.year))];if(unique.length<3)continue;const ordered=rows.slice().sort((a,b)=>a.year-b.year),t=numericTrend(ordered);patterns.push({kind:'yield_history',crop:ordered[0].crop,unit:ordered[0].unit,trend:t,years:unique.length,observations:ordered});suggestions.push(make('review-yield-'+key,'Review comparable yield history',unique.length+' seasons with crop '+(ordered[0].crop??'unknown')+' and '+ordered[0].unit+'/acre were recorded.','Review planting, rotation, soil tests, weather and management alongside yield; do not infer causation.',evidence('harvest',hs.filter(h=>ordered.some(r=>r.id===h.id))),'exploratory'));}
 if(years.length>=2){const rotation=ss.filter(s=>years.includes(yearOf(s))).sort((a,b)=>yearOf(a)-yearOf(b)).map(s=>({year:yearOf(s),crop:s.crop??'unknown'}));patterns.push({kind:'rotation',seasons:rotation});}
 const almanacMatches=almanacPattern({seasons:ss,harvests:hs,almanac:notes});if(almanacMatches.length)patterns.push({kind:'traditional_almanac_overlap',entries:almanacMatches,causal:false});
 if(obs.some(o=>['high','moderate'].includes(o.severity)))suggestions.push(make('scout-followup','Review recorded scouting issues','Moderate or high severity observations are present.','Inspect current field conditions and compare against dated scouting notes.',evidence('scouting',obs.filter(o=>['high','moderate'].includes(o.severity))),'observed'));
 const coverage={seasons:years.length,harvests:hs.length,applications:apps.length,soilSamples:labs.length,scouting:obs.length,weather:weather.filter(w=>w.placeId===pid).length,almanac:notes.length};
 return {placeId:pid,generatedAt:asOf,mode:'descriptive_r1',coverage,patterns,suggestions,limitations:['No automated fertilizer or pesticide rate recommendations.','No causal claims from observational data.','No yield forecast without validated field-level model and holdout testing.','Weather is excluded unless explicitly linked to this field and season.','Traditional almanac observations are exploratory, not established agronomy.']};
}

export function dataSufficiency(report={}){
 const c=report.coverage??{},score=[c.seasons>=3,c.harvests>=3,c.soilSamples>=2,c.applications>=2,c.weather>=2].filter(Boolean).length;
 return {score,max:5,label:score>=4?'strong':score>=3?'developing':score>=1?'limited':'insufficient',missing:[c.seasons>=3?null:'3+ seasons',c.harvests>=3?null:'3+ harvests',c.soilSamples>=2?null:'2+ comparable soil/plant samples',c.applications>=2?null:'2+ application records',c.weather>=2?null:'field-linked measured weather'].filter(Boolean)};
}
export function historicalHoldout({place=null,seasons=[],harvests=[],applications=[],samples=[],weather=[],scouts=[],almanac=[]}={}){
 if(!place?.id)return {status:'no_field',trials:[]};
 const pid=place.id,own=xs=>xs.filter(x=>x.placeId===pid),hs=own(harvests).filter(h=>finite(h.perAcre)&&h.unit).sort((a,b)=>yearOf(a)-yearOf(b)),trials=[];
 for(let i=2;i<hs.length;i++){const target=hs[i],year=yearOf(target),prior=hs.slice(0,i).filter(h=>h.unit===target.unit);if(prior.length<2)continue;const vals=prior.map(h=>Number(h.perAcre)),baseline=vals.reduce((a,b)=>a+b,0)/vals.length,actual=Number(target.perAcre),error=actual-baseline,ape=actual===0?null:Math.abs(error)/Math.abs(actual)*100;trials.push({year,unit:target.unit,baseline,actual,error,absolutePercentError:ape,method:'prior comparable yield mean',causal:false});}
 const usable=trials.filter(t=>finite(t.absolutePercentError)),mae=trials.length?trials.reduce((n,t)=>n+Math.abs(t.error),0)/trials.length:null,mape=usable.length?usable.reduce((n,t)=>n+t.absolutePercentError,0)/usable.length:null;
 return {status:trials.length?'evaluated':'insufficient_history',trials,summary:{holdouts:trials.length,meanAbsoluteError:mae,meanAbsolutePercentError:mape},limitations:['Baseline backtest measures historical predictability only.','It does not validate nutrient prescriptions or prove causes of yield differences.']};
}
export function fieldSuggestions(input={}){const report=fieldPatternReport(input),sufficiency=dataSufficiency(report),backtest=historicalHoldout(input);return {...report,sufficiency,backtest,suggestionMode:backtest.status==='evaluated'&&sufficiency.score>=3?'evidence_supported':'learning'};}

const daysBetween=(a,b)=>{const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?Math.round((x-y)/86400000):null;};
const seasonStart=s=>String(s?.plantedAt??s?.startedAt??s?.createdAt??'').slice(0,10);
export function seasonFeatureVectors({place=null,seasons=[],harvests=[],applications=[],samples=[],weather=[],scouts=[]}={}){
 if(!place?.id)return [];const pid=place.id,ss=seasons.filter(x=>x.placeId===pid).slice().sort((a,b)=>yearOf(a)-yearOf(b));
 return ss.map((season,i)=>{const year=yearOf(season),plant=seasonStart(season),hs=byYear(harvests.filter(x=>x.placeId===pid),year),apps=byYear(applications.filter(x=>x.placeId===pid),year),wx=byYear(weather.filter(x=>x.placeId===pid&&x.kind!=='forecast'),year),obs=byYear(scouts.filter(x=>x.placeId===pid),year),priorCrop=i?ss[i-1].crop??null:null,yields=hs.filter(h=>finite(h.perAcre)&&h.unit),yieldUnits=[...new Set(yields.map(h=>h.unit))],yieldPerAcre=yieldUnits.length===1&&yields.length?yields.reduce((n,h)=>n+Number(h.perAcre),0)/yields.length:null,temps=wx.map(w=>w.values??{}),gdd=temps.reduce((n,v)=>{const hi=num(v.highTemperature??v.temperature),lo=num(v.lowTemperature??v.temperature);if(hi===null||lo===null)return n;const avg=Math.min(86,Math.max(50,(hi+lo)/2));return n+Math.max(0,avg-50);},0),precip=temps.reduce((n,v)=>n+(num(v.precipitation)??0),0),applicationTiming=apps.map(a=>({id:a.id??null,category:a.category??null,product:a.product??null,daysFromPlanting:plant?daysBetween(dateOf(a),plant):null,recordedRate:a.rate??null,rateUnit:a.rateUnit??null}));return {year,crop:season.crop??null,priorCrop,plantingDate:plant||null,yieldPerAcre,yieldUnit:yieldUnits.length===1?yieldUnits[0]:null,applicationCount:apps.length,applicationTiming,measuredWeatherRecords:wx.length,gdd,precipitation:precip,scoutingIssues:obs.filter(o=>['moderate','high'].includes(o.severity)).length,soilSamples:byYear(samples.filter(x=>x.placeId===pid),year).length};});
}
export function pearson(xs=[],ys=[]){if(xs.length!==ys.length||xs.length<3)return null;const pairs=xs.map((x,i)=>[num(x),num(ys[i])]).filter(([x,y])=>x!==null&&y!==null);if(pairs.length<3)return null;const mx=pairs.reduce((n,p)=>n+p[0],0)/pairs.length,my=pairs.reduce((n,p)=>n+p[1],0)/pairs.length;let top=0,dx=0,dy=0;for(const [x,y] of pairs){const a=x-mx,b=y-my;top+=a*b;dx+=a*a;dy+=b*b;}if(!dx||!dy)return null;return top/Math.sqrt(dx*dy);}
export function relationshipDiscovery(vectors=[]){const comparable=vectors.filter(v=>finite(v.yieldPerAcre)&&v.yieldUnit),units=[...new Set(comparable.map(v=>v.yieldUnit))];if(comparable.length<3||units.length!==1)return {status:'insufficient',relationships:[]};const relationships=[];for(const [key,label] of [['gdd','GDD'],['precipitation','recorded precipitation'],['applicationCount','application count'],['scoutingIssues','moderate/high scouting count']]){const rows=comparable.filter(v=>finite(v[key])),r=pearson(rows.map(v=>v[key]),rows.map(v=>v.yieldPerAcre));if(r!==null)relationships.push({feature:key,label,r,n:rows.length,strength:Math.abs(r)>=.7?'strong_association':Math.abs(r)>=.4?'moderate_association':'weak_association',causal:false});}return {status:'exploratory',yieldUnit:units[0],relationships};}
export function designFieldExperiment({placeId,title,hypothesis,treatment,control,metric,seasonYear}={}){
 if(!placeId||!title||!hypothesis||!treatment||!control||!metric||!Number.isInteger(Number(seasonYear)))throw new Error('Experiment requires field, year, hypothesis, treatment, control and outcome metric.');
 if(String(treatment).trim()===String(control).trim())throw new Error('Treatment and control must differ.');
 return {id:'experiment-'+placeId+'-'+seasonYear+'-'+String(title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),placeId,seasonYear:Number(seasonYear),title:String(title),hypothesis:String(hypothesis),treatment:String(treatment),control:String(control),metric:String(metric),status:'planned',registeredAt:new Date().toISOString(),outcome:null,causalClaim:false,notes:'Plan fixed before outcome collection. Follow applicable labels, laws and agronomic guidance; CropChronicle does not prescribe application rates.'};
}
export function predictiveR2(input={}){const base=fieldSuggestions(input),vectors=seasonFeatureVectors(input),relationships=relationshipDiscovery(vectors);return {...base,mode:'predictive_r2_exploratory',featureVectors:vectors,relationships};}
