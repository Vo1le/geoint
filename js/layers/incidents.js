/* js/layers/incidents.js */
const IncidentsLayer = (() => {
  const DATA=[
    {lat:37.9,lng:23.7,type:'Séisme',sev:'moyen',mag:'4.2',region:'Grèce'},
    {lat:13.5,lng:2.1,type:'Inondation',sev:'élevé',region:'Niger'},
    {lat:39.9,lng:-8.1,type:'Feux de forêt',sev:'élevé',region:'Portugal'},
    {lat:27.0,lng:85.3,type:'Séisme',sev:'moyen',mag:'5.1',region:'Népal'},
    {lat:35.7,lng:140.2,type:'Séisme',sev:'moyen',mag:'4.8',region:'Japon'},
    {lat:6.4,lng:-11.8,type:'Inondation',sev:'élevé',region:'Libéria'},
    {lat:25.2,lng:55.3,type:'Canicule',sev:'moyen',region:'UAE'},
    {lat:19.4,lng:-99.1,type:'Séisme',sev:'faible',mag:'3.9',region:'Mexique'},
    {lat:-33.9,lng:151.2,type:'Feux',sev:'moyen',region:'Australie NSW'},
    {lat:14.1,lng:-87.2,type:'Ouragan',sev:'élevé',region:'Honduras'},
    {lat:44.8,lng:20.5,type:'Inondation',sev:'moyen',region:'Serbie'},
    {lat:-4.3,lng:15.3,type:'Épidémie',sev:'moyen',region:'RDC'},
    {lat:36.5,lng:2.9,type:'Séisme',sev:'faible',mag:'3.2',region:'Algérie'},
    {lat:28.6,lng:77.2,type:'Canicule',sev:'élevé',region:'Inde Delhi'},
    {lat:-22.9,lng:-43.2,type:'Glissement',sev:'moyen',region:'Brésil Rio'},
    {lat:60.2,lng:24.9,type:'Tempête',sev:'faible',region:'Finlande'},
    {lat:1.3,lng:103.8,type:'Pollution',sev:'faible',region:'Singapour'},
    {lat:55.7,lng:37.6,type:'Tempête',sev:'faible',region:'Russie Moscou'},
    {lat:51.5,lng:-0.1,type:'Accident ind.',sev:'faible',region:'UK Londres'},
    {lat:3.9,lng:30.0,type:'Conflit',sev:'élevé',region:'Soudan du Sud'},
  ];
  function load() {
    if(!State.layers.incidents){State.removeByType('incident');MapCtrl.clearType('incident');App.updateStats();App.updateFeed();return;}
    State.removeByType('incident');
    DATA.forEach((d,i)=>{
      const e={id:`INC-${String(i).padStart(3,'0')}`,type:'incident',incidentType:d.type,severity:d.sev,
        severityScore:{faible:1,moyen:2,élevé:3}[d.sev]||1,magnitude:d.mag||null,region:d.region,
        lat:d.lat+U.rand(-.03,.03),lng:d.lng+U.rand(-.03,.03),ts:Date.now()-Math.floor(Math.random()*86400000)};
      State.upsert(e);
    });
    MapCtrl.renderIncidents(State.byType('incident'));
    App.updateStats(); App.updateFeed();
  }
  return {load};
})();

/* js/layers/infra.js */
const InfraLayer = (() => {
  const NAMED=[
    // AWS
    {p:'AWS',asn:'AS16509',city:'N. Virginia',lat:38.96,lng:-77.43},{p:'AWS',asn:'AS16509',city:'Ohio',lat:40.41,lng:-82.59},
    {p:'AWS',asn:'AS16509',city:'N. California',lat:37.78,lng:-122.40},{p:'AWS',asn:'AS16509',city:'Oregon',lat:45.87,lng:-119.69},
    {p:'AWS',asn:'AS16509',city:'Dublin',lat:53.34,lng:-6.26},{p:'AWS',asn:'AS16509',city:'London',lat:51.51,lng:-0.13},
    {p:'AWS',asn:'AS16509',city:'Frankfurt',lat:50.11,lng:8.68},{p:'AWS',asn:'AS16509',city:'Singapore',lat:1.35,lng:103.82},
    {p:'AWS',asn:'AS16509',city:'Tokyo',lat:35.68,lng:139.69},{p:'AWS',asn:'AS16509',city:'Sydney',lat:-33.87,lng:151.21},
    {p:'AWS',asn:'AS16509',city:'São Paulo',lat:-23.55,lng:-46.63},{p:'AWS',asn:'AS16509',city:'Stockholm',lat:59.33,lng:18.07},
    {p:'AWS',asn:'AS16509',city:'Mumbai',lat:19.08,lng:72.88},{p:'AWS',asn:'AS16509',city:'Seoul',lat:37.57,lng:126.98},
    // GCP
    {p:'GCP',asn:'AS15169',city:'Iowa',lat:41.60,lng:-93.61},{p:'GCP',asn:'AS15169',city:'S. Carolina',lat:33.84,lng:-81.16},
    {p:'GCP',asn:'AS15169',city:'Belgium',lat:50.45,lng:3.82},{p:'GCP',asn:'AS15169',city:'Netherlands',lat:51.99,lng:5.91},
    {p:'GCP',asn:'AS15169',city:'Taiwan',lat:24.05,lng:120.54},{p:'GCP',asn:'AS15169',city:'Tokyo',lat:35.65,lng:139.74},
    {p:'GCP',asn:'AS15169',city:'Sydney',lat:-33.92,lng:151.18},{p:'GCP',asn:'AS15169',city:'Mumbai',lat:19.07,lng:72.86},
    // Azure
    {p:'Azure',asn:'AS8075',city:'Virginia',lat:37.33,lng:-79.39},{p:'Azure',asn:'AS8075',city:'Amsterdam',lat:52.37,lng:4.90},
    {p:'Azure',asn:'AS8075',city:'Dublin',lat:53.34,lng:-6.25},{p:'Azure',asn:'AS8075',city:'Hong Kong',lat:22.39,lng:114.11},
    {p:'Azure',asn:'AS8075',city:'Tokyo',lat:35.72,lng:139.72},{p:'Azure',asn:'AS8075',city:'São Paulo',lat:-23.59,lng:-46.65},
    {p:'Azure',asn:'AS8075',city:'Sydney',lat:-33.86,lng:151.20},{p:'Azure',asn:'AS8075',city:'Chennai',lat:12.98,lng:80.26},
    // Cloudflare
    {p:'Cloudflare',asn:'AS13335',city:'Frankfurt',lat:50.10,lng:8.69},{p:'Cloudflare',asn:'AS13335',city:'London',lat:51.52,lng:-0.11},
    {p:'Cloudflare',asn:'AS13335',city:'Singapore',lat:1.36,lng:103.80},{p:'Cloudflare',asn:'AS13335',city:'Tokyo',lat:35.65,lng:139.75},
    {p:'Cloudflare',asn:'AS13335',city:'Sydney',lat:-33.88,lng:151.22},{p:'Cloudflare',asn:'AS13335',city:'Ashburn',lat:39.01,lng:-77.46},
    {p:'Cloudflare',asn:'AS13335',city:'Los Angeles',lat:34.05,lng:-118.24},{p:'Cloudflare',asn:'AS13335',city:'São Paulo',lat:-23.52,lng:-46.64},
    // OVH
    {p:'OVH',asn:'AS16276',city:'Gravelines',lat:51.00,lng:2.13},{p:'OVH',asn:'AS16276',city:'Roubaix',lat:50.69,lng:3.17},
    {p:'OVH',asn:'AS16276',city:'Strasbourg',lat:48.57,lng:7.75},{p:'OVH',asn:'AS16276',city:'Beauharnois CA',lat:45.31,lng:-73.87},
    {p:'OVH',asn:'AS16276',city:'Singapore',lat:1.35,lng:103.76},
    // Hetzner
    {p:'Hetzner',asn:'AS24940',city:'Nuremberg DE',lat:49.45,lng:11.08},{p:'Hetzner',asn:'AS24940',city:'Helsinki FI',lat:60.17,lng:24.95},
    {p:'Hetzner',asn:'AS24940',city:'Falkenstein DE',lat:50.47,lng:12.37},{p:'Hetzner',asn:'AS24940',city:'Ashburn US',lat:39.03,lng:-77.47},
    // IXPs
    {p:'AMS-IX',asn:'AS1200',city:'Amsterdam',lat:52.35,lng:4.91},{p:'LINX',asn:'AS5459',city:'London',lat:51.55,lng:-0.05},
    {p:'DE-CIX',asn:'AS49210',city:'Frankfurt',lat:50.12,lng:8.74},{p:'JPIX',asn:'AS9396',city:'Tokyo',lat:35.66,lng:139.77},
    {p:'Equinix',asn:'AS24115',city:'Singapore',lat:1.32,lng:103.77},{p:'Equinix',asn:'AS24115',city:'New York',lat:40.73,lng:-74.01},
    // Alibaba / Tencent
    {p:'Alibaba',asn:'AS45102',city:'Hangzhou CN',lat:30.27,lng:120.15},{p:'Alibaba',asn:'AS45102',city:'Beijing CN',lat:39.91,lng:116.39},
    {p:'Tencent',asn:'AS132203',city:'Guangzhou CN',lat:23.13,lng:113.26},{p:'Tencent',asn:'AS132203',city:'Shanghai CN',lat:31.23,lng:121.47},
  ];

  const EXTRA_PROVIDERS=['DigitalOcean','Linode','Vultr','Leaseweb','Cogent','NTT','PCCW','Telia','Orange','BT','AT&T','Zayo'];
  const EXTRA_REGIONS=[
    {la:[48,60],lo:[-5,20]},{la:[30,45],lo:[-90,-70]},{la:[20,40],lo:[100,145]},
    {la:[-40,-10],lo:[110,155]},{la:[-35,5],lo:[-70,-30]},{la:[15,35],lo:[30,80]},
    {la:[-35,10],lo:[10,50]},{la:[55,70],lo:[10,50]},
  ];

  function load() {
    if(!State.layers.infra){State.removeByType('infra');MapCtrl.clearType('infra');App.updateStats();App.updateFeed();return;}
    State.removeByType('infra');
    const all=[...NAMED];
    for(let i=0;i<140;i++){
      const reg=EXTRA_REGIONS[Math.floor(Math.random()*EXTRA_REGIONS.length)];
      all.push({p:EXTRA_PROVIDERS[Math.floor(Math.random()*EXTRA_PROVIDERS.length)],
        asn:`AS${Math.floor(Math.random()*65000+1000)}`,city:`Node-${i}`,
        lat:U.rand(reg.la[0],reg.la[1]),lng:U.rand(reg.lo[0],reg.lo[1])});
    }
    all.forEach((n,i)=>{
      const e={id:`${n.asn}-${String(i).padStart(3,'0')}`,type:'infra',provider:n.p,asn:n.asn,city:n.city,
        ip:`${Math.floor(U.rand(1,254))}.${Math.floor(U.rand(1,254))}.${Math.floor(U.rand(1,254))}.${Math.floor(U.rand(1,254))}`,
        lat:n.lat+U.rand(-.05,.05),lng:n.lng+U.rand(-.05,.05),ts:Date.now()};
      State.upsert(e);
    });
    MapCtrl.renderInfra(State.byType('infra'));
    U.notify(`${all.length} nœuds infra chargés`,'success');
    App.updateStats(); App.updateFeed();
  }
  return {load};
})();

/* js/layers/traffic.js */
const TrafficLayer = (() => {
  const CITIES=[
    {city:'Paris',lat:48.857,lng:2.347},{city:'London',lat:51.507,lng:-0.128},
    {city:'Berlin',lat:52.520,lng:13.405},{city:'New York',lat:40.712,lng:-74.006},
    {city:'Los Angeles',lat:34.052,lng:-118.244},{city:'Tokyo',lat:35.682,lng:139.691},
    {city:'Beijing',lat:39.904,lng:116.407},{city:'São Paulo',lat:-23.550,lng:-46.633},
    {city:'Mumbai',lat:19.076,lng:72.878},{city:'Cairo',lat:30.033,lng:31.233},
    {city:'Moscow',lat:55.751,lng:37.618},{city:'Lagos',lat:6.524,lng:3.379},
    {city:'Istanbul',lat:41.015,lng:28.979},{city:'Mexico City',lat:19.432,lng:-99.133},
    {city:'Jakarta',lat:-6.208,lng:106.846},{city:'Dubai',lat:25.204,lng:55.270},
    {city:'Sydney',lat:-33.868,lng:151.209},{city:'Chicago',lat:41.878,lng:-87.630},
    {city:'Seoul',lat:37.566,lng:126.978},{city:'Madrid',lat:40.416,lng:-3.703},
  ];
  const TYPES=['Embouteillage','Accident','Travaux','Route fermée','Ralentissement','Incident','Déviation'];
  const SEVS=['faible','modéré','sévère'];

  async function tryOverpass(zone) {
    const delta=0.2, bbox=`${zone.lat-delta},${zone.lng-delta},${zone.lat+delta},${zone.lng+delta}`;
    const q=`[out:json][timeout:6];(node["barrier"="block"](${bbox});way["access"="no"]["highway"](${bbox}););out body 3;`;
    try {
      const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q,signal:AbortSignal.timeout(6000)});
      if(!r.ok) return [];
      const d=await r.json();
      return (d.elements||[]).filter(e=>e.lat&&e.lon).slice(0,2).map((el,i)=>({
        id:`TRF-OSM-${el.id}`,type:'traffic',incidentType:'Signalement OSM',severity:'modéré',
        city:zone.city,lat:el.lat,lng:el.lon,ts:Date.now()
      }));
    } catch { return []; }
  }

  async function load() {
    if(!State.layers.traffic){State.removeByType('traffic');MapCtrl.clearType('traffic');App.updateStats();App.updateFeed();return;}
    if(!State.canCall('traffic',3)){U.notify('Traffic: rate limit','warn');return;}
    State.removeByType('traffic');MapCtrl.clearType('traffic');
    U.notify('Chargement incidents routiers...','info');
    const all=[];
    // Try Overpass for first 3 cities
    for(const z of CITIES.slice(0,3)){
      const osm=await tryOverpass(z);
      if(osm.length) all.push(...osm);
      const n=Math.floor(U.rand(1,4));
      for(let i=0;i<n;i++) all.push({id:`TRF-${z.city.replace(/\s/,'')}-${i}`,type:'traffic',
        incidentType:TYPES[Math.floor(Math.random()*TYPES.length)],severity:SEVS[Math.floor(Math.random()*SEVS.length)],
        city:z.city,lat:z.lat+U.rand(-.08,.08),lng:z.lng+U.rand(-.08,.08),ts:Date.now()});
    }
    // Simulate rest
    CITIES.slice(3).forEach(z=>{
      const n=Math.floor(U.rand(1,4));
      for(let i=0;i<n;i++) all.push({id:`TRF-${z.city.replace(/\s/,'')}-${i}`,type:'traffic',
        incidentType:TYPES[Math.floor(Math.random()*TYPES.length)],severity:SEVS[Math.floor(Math.random()*SEVS.length)],
        city:z.city,lat:z.lat+U.rand(-.08,.08),lng:z.lng+U.rand(-.08,.08),ts:Date.now()});
    });
    all.forEach(e=>State.upsert(e));
    MapCtrl.renderTraffic(all);
    U.notify(`${all.length} incidents routiers chargés`,'success');
    App.updateStats(); App.updateFeed();
  }
  return {load};
})();
