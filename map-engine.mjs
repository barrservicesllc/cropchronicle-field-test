import {CROP_VISUALS,normalizeCrop} from './ag-intel.mjs';
import {basemapConfig,cdlWmsSource,nrcsSoilRasterSource,usgsHydroSource,usgsSlopeSource} from './providers.mjs';

export const MAPLIBRE_VERSION='6.11.2';
export const MAPLIBRE_MODULE='./vendor/maplibre-gl.mjs';
export const MAPLIBRE_CSS='./vendor/maplibre-gl.css';

export function fieldFeature(boundary,place=null,season=null){
 const geometry=boundary?.geometry;if(!geometry||geometry.type!=='Polygon')return null;
 const crop=normalizeCrop(season?.crop??'other');
 return {type:'Feature',id:boundary.id,geometry,properties:{boundaryId:boundary.id,placeId:boundary.placeId,name:place?.name??'Field',crop,cropLabel:CROP_VISUALS[crop]?.label??crop,pattern:CROP_VISUALS[crop]?.pattern??'none',acres:boundary.acreageOverride??boundary.acreageCalculated??place?.acreage??null,privacy:boundary.privacy??'private'}};
}
export function fieldCollection(boundaries=[],places=[],seasons=[]){
 const pm=new Map(places.map(x=>[x.id,x])),sm=new Map();
 for(const s of seasons.slice().sort((a,b)=>String(a.year??'').localeCompare(String(b.year??''))))sm.set(s.placeId,s);
 return {type:'FeatureCollection',features:boundaries.map(b=>fieldFeature(b,pm.get(b.placeId),sm.get(b.placeId))).filter(Boolean)};
}
export function boundsForFeatures(fc){
 const pts=[];for(const f of fc?.features??[])for(const ring of f.geometry?.coordinates??[])for(const p of ring)if(Number.isFinite(p?.[0])&&Number.isFinite(p?.[1]))pts.push(p);
 if(!pts.length)return null;return pts.reduce((b,[x,y])=>[[Math.min(b[0][0],x),Math.min(b[0][1],y)],[Math.max(b[1][0],x),Math.max(b[1][1],y)]],[[Infinity,Infinity],[-Infinity,-Infinity]]);
}
export function farmStyle(basemapId='none'){const base=basemapConfig(basemapId),sources={},layers=[{id:'background',type:'background',paint:{'background-color':'#102b19'}}];if(base.kind==='raster'){sources.basemap={type:'raster',tiles:base.tiles,tileSize:base.tileSize,attribution:base.attribution,maxzoom:base.maxzoom};layers.push({id:'basemap',type:'raster',source:'basemap'});}return {version:8,name:'CropChronicle farm map',sources,layers};}
export function emptyFarmStyle(){return farmStyle('none');}
export async function loadMapLibre(){
 try{const maplibre=await import(MAPLIBRE_MODULE);maplibre.setWorkerUrl?.(new URL('./vendor/maplibre-gl-worker.mjs',import.meta.url).href);return maplibre;}catch(error){console.error('CropChronicle MapLibre load failed',error);return null;}
}
export async function createFarmMap({container,featureCollection,onSelect,onMapClick,onStatus,basemapId='usgs_imagery',center=null}){
 const maplibre=await loadMapLibre();if(!maplibre||!container)return null;
 const map=new maplibre.Map({container,style:farmStyle(basemapId),center:center&&Number.isFinite(center.lon)&&Number.isFinite(center.lat)?[center.lon,center.lat]:[0,0],zoom:center?16:2,attributionControl:true,maplibreLogo:false});
 map.on('error',e=>{const err=e?.error??e;const msg=String(err?.message??err??'');const status=Number(err?.status??err?.statusCode??0);if(status===404||/404|not found/i.test(msg)){console.warn('CropChronicle map tile unavailable',msg);return;}console.error('CropChronicle map error',err);if(onStatus)onStatus('Map imagery failed to load · farm records remain available');});map.on('idle',()=>{if(onStatus)onStatus(basemapId==='none'?'Fields-only map ready':'USGS map ready');});map.on('click',e=>{if(onMapClick)onMapClick({lon:e.lngLat.lng,lat:e.lngLat.lat});});map.on('load',()=>{addFieldLayers(map,featureCollection);addBoundaryDraftLayers(map);const bounds=boundsForFeatures(featureCollection);if(bounds)map.fitBounds(bounds,{padding:40,maxZoom:16});map.on('click','farm-fields-fill',e=>{const f=e.features?.[0];if(f&&onSelect)onSelect(f.properties);});});
 return map;
}

export function setBasemap(map,id='none',featureCollection=null){if(!map)return false;map.setStyle(farmStyle(id));map.once('styledata',()=>{if(featureCollection)addFieldLayers(map,featureCollection);});return true;}
export function addFieldLayers(map,featureCollection){if(!map.getSource('farm-fields'))map.addSource('farm-fields',{type:'geojson',data:featureCollection});if(!map.getLayer('farm-fields-fill'))map.addLayer({id:'farm-fields-fill',type:'fill',source:'farm-fields',paint:{'fill-color':['match',['get','crop'],'corn','#d8b94a','soybean','#78a95a','wheat','#d8c079','pasture','#5a9b68','cover_crop','#4f8b74','#7f9b69'],'fill-opacity':.38}});if(!map.getLayer('farm-fields-line'))map.addLayer({id:'farm-fields-line',type:'line',source:'farm-fields',paint:{'line-color':'#e8ffe9','line-width':2}});}
export function setSoilOverlay(map,enabled){if(!map)return false;if(enabled){if(!map.getSource('nrcs-soils'))map.addSource('nrcs-soils',nrcsSoilRasterSource());if(!map.getLayer('nrcs-soils'))map.addLayer({id:'nrcs-soils',type:'raster',source:'nrcs-soils',paint:{'raster-opacity':.55}},map.getLayer('farm-fields-fill')?'farm-fields-fill':undefined);}else{if(map.getLayer('nrcs-soils'))map.removeLayer('nrcs-soils');if(map.getSource('nrcs-soils'))map.removeSource('nrcs-soils');}return true;}

function setRasterOverlay(map,id,enabled,source,opacity=.55,before='farm-fields-fill'){if(!map)return false;try{if(enabled){if(!map.getSource(id))map.addSource(id,source);if(!map.getLayer(id))map.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':opacity}},map.getLayer(before)?before:undefined);}else{if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);}return true;}catch(error){console.warn('CropChronicle optional overlay unavailable',id,error?.message||error);try{if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);}catch{}return false;}}
export function setCropContext(map,enabled,year){return setRasterOverlay(map,'usda-cdl',enabled,cdlWmsSource(year),.48);}
export function setSlopeOverlay(map,enabled){return setRasterOverlay(map,'usgs-slope',enabled,usgsSlopeSource(),.5);}
export function setWaterOverlay(map,enabled){return setRasterOverlay(map,'usgs-water',enabled,usgsHydroSource(),.62);}

export function boundaryPointDistanceMeters(a,b){if(!a||!b)return Infinity;const lat=((a.lat+b.lat)/2)*Math.PI/180,dy=(b.lat-a.lat)*111132.92,dx=(b.lon-a.lon)*111412.84*Math.cos(lat);return Math.hypot(dx,dy);}
function orient(a,b,c){return Math.sign((b.lon-a.lon)*(c.lat-a.lat)-(b.lat-a.lat)*(c.lon-a.lon));}
function segmentsCross(a,b,c,d){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);return o1!==o2&&o3!==o4;}
export function canAppendBoundaryPoint(points=[],point,{minMeters=3}={}){if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return {ok:false,reason:'invalid'};if(points.some(p=>boundaryPointDistanceMeters(p,point)<minMeters))return {ok:false,reason:'duplicate'};if(points.length>=3){const a=points[points.length-1],b=point;for(let i=0;i<points.length-2;i++)if(segmentsCross(points[i],points[i+1],a,b))return {ok:false,reason:'crossing'};}return {ok:true,reason:null};}
export function boundarySelfIntersects(points=[]){if(points.length<4)return false;const closed=[...points,points[0]];for(let i=0;i<closed.length-1;i++)for(let j=i+1;j<closed.length-1;j++){if(Math.abs(i-j)<=1||(i===0&&j===closed.length-2))continue;if(segmentsCross(closed[i],closed[i+1],closed[j],closed[j+1]))return true;}return false;}
export function boundaryDraftData(points=[]){
 const coords=points.filter(p=>Number.isFinite(p?.lon)&&Number.isFinite(p?.lat)).map(p=>[p.lon,p.lat]),features=coords.map((c,i)=>({type:'Feature',properties:{vertex:i+1},geometry:{type:'Point',coordinates:c}}));
 if(coords.length>=2)features.unshift({type:'Feature',properties:{kind:'draft-line'},geometry:{type:'LineString',coordinates:coords}});
 if(coords.length>=3)features.unshift({type:'Feature',properties:{kind:'draft-area'},geometry:{type:'Polygon',coordinates:[[...coords,coords[0]]]}});
 return {type:'FeatureCollection',features};
}
export function addBoundaryDraftLayers(map){
 if(!map||map.getSource('boundary-draft'))return;
 map.addSource('boundary-draft',{type:'geojson',data:boundaryDraftData([])});
 map.addLayer({id:'boundary-draft-fill',type:'fill',source:'boundary-draft',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#ffd166','fill-opacity':.18}});
 map.addLayer({id:'boundary-draft-line',type:'line',source:'boundary-draft',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#ffd166','line-width':3}});
 map.addLayer({id:'boundary-draft-points',type:'circle',source:'boundary-draft',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':6,'circle-color':'#ffd166','circle-stroke-color':'#102b19','circle-stroke-width':2}});
}
export function setBoundaryDraft(map,points=[]){if(!map)return false;const src=map.getSource?.('boundary-draft');if(src?.setData){src.setData(boundaryDraftData(points));return true;}if(map.isStyleLoaded?.()){addBoundaryDraftLayers(map);map.getSource('boundary-draft')?.setData(boundaryDraftData(points));return true;}return false;}
