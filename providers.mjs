import {buildAgProvenance,weatherSnapshot} from './ag-intel.mjs';

export const PROVIDERS={
 nws:{id:'nws',label:'NOAA / National Weather Service',base:'https://api.weather.gov',kind:'weather',license:'U.S. Government open data'},
 nrcs:{id:'nrcs',label:'USDA NRCS Soil Data Access',base:'https://sdmdataaccess.nrcs.usda.gov',kind:'soil',license:'USDA public data'},
 maplibre:{id:'maplibre',label:'MapLibre renderer',kind:'map_renderer',license:'BSD-3-Clause'}
};
function validCoord(lat,lon){return Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Number(lat)>=-90&&Number(lat)<=90&&Number(lon)>=-180&&Number(lon)<=180;}
async function getJson(url,{signal}={}){const r=await fetch(url,{headers:{Accept:'application/geo+json, application/json'},signal});if(!r.ok)throw new Error('Provider request failed: '+r.status);return r.json();}
export async function nwsPointForecast(lat,lon,{signal}={}){
 if(!validCoord(lat,lon))throw new Error('Valid coordinates are required.');
 const point=await getJson(PROVIDERS.nws.base+'/points/'+Number(lat).toFixed(4)+','+Number(lon).toFixed(4),{signal});
 const forecastUrl=point?.properties?.forecastHourly||point?.properties?.forecast;if(!forecastUrl)throw new Error('NWS did not return a forecast endpoint.');
 const data=await getJson(forecastUrl,{signal}),retrievedAt=new Date().toISOString(),periods=data?.properties?.periods??[];
 return {provider:PROVIDERS.nws,point:{office:point?.properties?.gridId??null,gridX:point?.properties?.gridX??null,gridY:point?.properties?.gridY??null},updated:data?.properties?.updated??null,periods,provenance:buildAgProvenance({provider:PROVIDERS.nws.label,sourceUrl:forecastUrl,retrievedAt,forecastFor:periods[0]?.startTime??null,staleAfter:periods[0]?.endTime??null,limitations:'Forecast grid is not field-scale ground truth.',license:PROVIDERS.nws.license,attribution:'National Weather Service'})};
}
export function nwsPeriodToSnapshot(period,provenance,id=null){
 if(!period)throw new Error('Forecast period required.');
 const wind=parseFloat(String(period.windSpeed??'').match(/[\d.]+/)?.[0]??'');
 return weatherSnapshot({id,kind:'forecast',temperature:period.temperature,windSpeed:Number.isFinite(wind)?wind:null,provenance:{...provenance,forecastFor:period.startTime??null,validFrom:period.startTime??null,validTo:period.endTime??null,staleAfter:period.endTime??provenance.staleAfter}});
}
export function nrcsSoilWmsConfig(){
 return {id:'nrcs-soils',type:'raster',service:'WMS',version:'1.1.1',base:PROVIDERS.nrcs.base+'/Spatial/SDM.wms',attribution:'Soil Survey Staff, USDA NRCS — Soil Data Access',provider:PROVIDERS.nrcs.label};
}
export function providerStatus(error){if(!error)return {ok:true,message:'available'};return {ok:false,message:error?.name==='AbortError'?'request cancelled':'temporarily unavailable'};}

export const BASEMAPS={
 none:{id:'none',label:'Fields only',kind:'none',attribution:'CropChronicle local field records'},
 usgs_imagery:{id:'usgs_imagery',label:'USGS aerial imagery',kind:'raster',tiles:['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:16,attribution:'USGS The National Map — Imagery Only',usage:'online'},
 usgs_topo:{id:'usgs_topo',label:'USGS topographic',kind:'raster',tiles:['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:16,attribution:'USGS The National Map — USGS Topo',usage:'online'}
};
export function basemapConfig(id='none'){return BASEMAPS[id]??BASEMAPS.none;}
export function nrcsSoilRasterSource(){
 return {type:'raster',tiles:['https://sdmdataaccess.sc.egov.usda.gov/Spatial/SDM.wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=mapunitpoly&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],tileSize:256,attribution:'Soil Survey Staff, USDA NRCS — Soil Data Access'};
}

export const CONTEXT_LAYERS={
 cdl:{id:'cdl',label:'USDA NASS Cropland Data Layer',kind:'classified_crop_reference',provider:'USDA NASS / CroplandCROS',limitations:'Satellite-derived crop-specific land-cover classification. It is not a neighboring farmer declaration and must not be presented as real-time private crop records.'},
 slope:{id:'slope',label:'USGS 3DEP slope',kind:'terrain_reference',provider:'USGS 3D Elevation Program',limitations:'Terrain model derived from published elevation data; field drainage and trafficability require field verification.'},
 water:{id:'water',label:'USGS hydrography',kind:'hydrography_reference',provider:'USGS National Hydrography',limitations:'Reference surface-water mapping; not a determination of water rights, drainage permission, flood risk, or current flow.'}
};
export function cdlWmsSource(year=new Date().getFullYear()-1){
 const y=Number(year);if(!Number.isInteger(y)||y<2008||y>new Date().getFullYear())throw new Error('Unsupported CDL year.');
 return {type:'raster',tiles:['https://nassgeodata.gmu.edu/CropScapeService/wms_cdlall.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=cdl_'+y+'&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],tileSize:256,attribution:'USDA NASS Cropland Data Layer via CroplandCROS',year:y,...CONTEXT_LAYERS.cdl};
}
export function usgsSlopeSource(){return {type:'raster',tiles:['https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&renderingRule=%7B%22rasterFunction%22%3A%22Slope%20Map%22%7D&f=image'],tileSize:256,attribution:'USGS National Map 3DEP',...CONTEXT_LAYERS.slope};}
export function usgsHydroSource(){return {type:'raster',tiles:['https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image'],tileSize:256,attribution:'USGS National Hydrography Dataset — legacy reference; 3DHP is the current program',...CONTEXT_LAYERS.water};}
