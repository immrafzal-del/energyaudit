const express     = require('express');
const router      = express.Router();
const PDFDocument = require('pdfkit');
const EnergyData  = require('../models/EnergyData');
const Fault       = require('../models/Fault');
const Settings    = require('../models/Settings');

const C = {
  primary:'#1565C0', accent:'#1976D2', critical:'#C62828',
  warning:'#EF6C00', ok:'#2E7D32', rowAlt:'#F5F9FF',
  rowEven:'#FFFFFF', hdrTxt:'#FFFFFF', bodyTxt:'#1A1A2E', border:'#D0D8E8',
};
const fmtN  = (n, d=2) => (isFinite(n) && n !== null ? Number(n).toFixed(d) : '--');
// FIX: Math.round() produced Rs 0 for small values (e.g. 0.018 kWh x Rs 25 = Rs 0.45 to Rs 0).
const fmtRs = n => n >= 10 ? `Rs ${Math.round(n).toLocaleString()}` : `Rs ${Number(n).toFixed(2)}`;
const fmtDT = d        => new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const RATE  = 25;

// Bottom margin — content below this y triggers a page break
const PAGE_BOTTOM = 780;

function nF(r='', faultMeta={}){const s=r.toLowerCase().replace(/_/g,' ').trim();for(const k of Object.keys(faultMeta))if(s.includes(k))return k;return s;}
// FIX: unresolved faults now use actual elapsed time (now - timestamp) instead of a hardcoded 5-minute default.
// The old 5/60 constant made every unresolved fault appear exactly 5 minutes long regardless of when it occurred.
function dH(arr) {
  const now = Date.now();
  return arr.reduce((a, f) => {
    const d = f.resolvedAt
      ? (new Date(f.resolvedAt) - new Date(f.timestamp)) / 3600000
      : (now - new Date(f.timestamp).getTime()) / 3600000;
    return a + Math.abs(d);
  }, 0);
}
function ds(arr,mx=100){if(arr.length<=mx)return arr;const s=arr.length/mx;return Array.from({length:mx},(_,i)=>arr[Math.round(i*s)]);}

// ── PDF helpers ───────────────────────────────────────────────────────────────
function pageHeader(doc, reportNo, period, user) {
  doc.rect(0, 0, doc.page.width, 62).fill(C.primary);
  doc.fontSize(13.5).fillColor('#FFF').font('Helvetica-Bold')
     .text('ENERGY AUDIT AND DIAGNOSTICS SYSTEM', 48, 13, {width: doc.page.width - 200});
  doc.fontSize(7.5).font('Helvetica').fillColor('rgba(255,255,255,0.8)')
     .text('Automated Energy Monitoring & Fault Analysis Report', 48, 31, {width: doc.page.width - 200});
  doc.fontSize(7.5).fillColor('rgba(255,255,255,0.65)').text(user, 48, 44, {width: doc.page.width - 200});
  doc.fillColor('#90CAF9').fontSize(7).font('Helvetica-Bold')
     .text('Report No.', doc.page.width-158, 10, {width:108,align:'right'});
  doc.fillColor('#FFF').fontSize(10).font('Helvetica-Bold')
     .text(reportNo, doc.page.width-158, 19, {width:108,align:'right'});
  doc.fillColor('rgba(255,255,255,0.75)').fontSize(7).font('Helvetica')
     .text(`Period: ${period}`, doc.page.width-158, 31, {width:108,align:'right'})
     .text(`Issued: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`,
           doc.page.width-158, 41, {width:108,align:'right'});
}

// FIX: smart page-break helper — adds a new page with header only when content
// would overflow. This replaces hardcoded doc.addPage() calls and prevents
// both empty pages (from unconditional breaks) and overflow pages (from
// content silently running past the bottom margin).
function ensurePage(doc, y, needed, reportNo, periodLabel, user) {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    pageHeader(doc, reportNo, periodLabel, user);
    return 72;
  }
  return y;
}

function sH(doc, y, title, reportNo, periodLabel, user) {
  // Ensure there's room for the section header + at least one row (32 px)
  y = ensurePage(doc, y, 32, reportNo, periodLabel, user);
  doc.rect(48, y, doc.page.width-96, 16).fill(C.accent);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.hdrTxt)
     .text(title, 54, y+3.5, {width: doc.page.width - 110, lineBreak: false});
  return y + 19;
}

function tHdr(doc, y, cols, rH=17) {
  doc.rect(48, y, doc.page.width-96, rH).fill(C.accent);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.hdrTxt);
  cols.forEach(c => doc.text(c.t, c.x, y+(rH-7.5)/2, {width:c.w, align:c.a||'left', lineBreak:false}));
  return y + rH;
}

function tRow(doc, y, cols, alt, rH=15) {
  doc.rect(48, y, doc.page.width-96, rH).fill(alt ? C.rowAlt : C.rowEven);
  cols.forEach(c =>
    doc.font(c.b?'Helvetica-Bold':'Helvetica').fontSize(7.5)
       .fillColor(c.color||C.bodyTxt)
       .text(c.t, c.x, y+(rH-7.5)/2, {width:c.w, align:c.a||'left', lineBreak:false})
  );
  return y + rH;
}

function lineChart(doc, samples, ox, oy, w, h, color, label, unit) {
  if (!samples || samples.length < 2) return;
  // Y-axis always starts from 0 so the chart shows true magnitude.
  // A voltage of 180V filling 90% of the chart is more honest than
  // 178-180V filling 100% and looking like massive variation.
  const mn  = 0;
  const mx  = Math.max(...samples);
  const rng = mx || 1;
  const avg = samples.reduce((a,b)=>a+b,0)/samples.length;
  const realMn = Math.min(...samples);
  doc.rect(ox, oy, w, h).fill('#F0F5FF').stroke(C.border);
  doc.fontSize(5.5).font('Helvetica').fillColor('#777');
  doc.text(fmtN(mx,1), ox-28, oy+1,   {width:26,align:'right'});
  doc.text('0',         ox-28, oy+h-8, {width:26,align:'right'});
  doc.fontSize(7).font('Helvetica-Bold').fillColor(color)
     .text(`${label} (${unit})`, ox+w-88, oy+2, {width:84,align:'right'});
  doc.fontSize(6).font('Helvetica').fillColor('#555')
     .text(`min ${fmtN(realMn,1)}  avg ${fmtN(avg,1)}  max ${fmtN(mx,1)} ${unit}`, ox+2, oy+2, {width:w-92});
  doc.save(); doc.rect(ox,oy,w,h).clip();
  doc.strokeColor('#D8E4F0').lineWidth(0.4).opacity(0.6);
  for(let i=1;i<4;i++){const gy=oy+(h/4)*i;doc.moveTo(ox,gy).lineTo(ox+w,gy).stroke();}
  const pts=samples.map((v,i)=>({x:ox+(i/(samples.length-1))*w, y:oy+h-((v-mn)/rng)*h}));
  doc.opacity(0.1).fillColor(color);
  doc.moveTo(pts[0].x,oy+h);pts.forEach(p=>doc.lineTo(p.x,p.y));
  doc.lineTo(pts[pts.length-1].x,oy+h).fill();
  doc.opacity(1).strokeColor(color).lineWidth(1.2);
  doc.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>doc.lineTo(p.x,p.y));
  doc.stroke(); doc.restore();
}

// ── Route ──────────────────────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const {startDate, endDate, periodLabel='Custom Period'} = req.body;
    const start=new Date(startDate), end=new Date(endDate);
    if (isNaN(start)||isNaN(end)||start>=end)
      return res.status(400).json({error:'Invalid date range'});

    const durHrs = (end-start)/3600000;
    const user   = 'admin@energy.com';
    const reportNo = `EAR-${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;

    // Load user-configured thresholds so fault register matches Settings page
    let dbSettings = null;
    try { dbSettings = await Settings.findOne(); } catch(e) {}
    const thr = {
      voltageMax:  dbSettings?.voltage?.max    ?? 250,
      voltageMin:  dbSettings?.voltage?.min    ?? 200,
      currentMax:  dbSettings?.current?.max    ?? 30,
      powerMax:    dbSettings?.power?.max      ?? 3000,
      pfMin:       dbSettings?.powerFactor?.min?? 0.80,
      freqMax:     dbSettings?.frequency?.max  ?? 51,
      freqMin:     dbSettings?.frequency?.min  ?? 49,
      tempMax:     dbSettings?.temperature?.max?? 75,
    };

    // Dynamic FAULT_META using actual configured thresholds
    const FAULT_META = {
      'overvoltage':          {label:'Overvoltage',        sev:'Critical', thr:`V > ${thr.voltageMax} V`,               root:'Utility supply fluctuation',    lossMech:'Extra consumption at elevated V',lossRate:0.05 },
      'undervoltage':         {label:'Undervoltage',       sev:'Warning',  thr:`V < ${thr.voltageMin} V`,               root:'Line voltage sag / heavy load', lossMech:'Efficiency drop under low V',    lossRate:0.025},
      'overcurrent':          {label:'Overcurrent',        sev:'Critical', thr:`I > ${thr.currentMax} A`,               root:'Equipment overload / fault',    lossMech:'I\u00b2R copper losses in wiring',lossRate:0.012},
      'high current':         {label:'High Current',       sev:'Warning',  thr:`I > warning level`,                     root:'Load increase / partial fault', lossMech:'Elevated conduction losses',    lossRate:0.006},
      'overload':             {label:'Overload',           sev:'Critical', thr:`P > ${thr.powerMax} W`,                 root:'Simultaneous load switching',   lossMech:'Thermal & conduction losses',   lossRate:0.05 },
      'high power':           {label:'High Power',         sev:'Warning',  thr:`P > warning level`,                     root:'Multiple loads active',         lossMech:'Elevated distribution losses',  lossRate:0.02 },
      'low power factor':     {label:'Low Power Factor',   sev:'Warning',  thr:`PF < ${thr.pfMin}`,                     root:'Inductive / capacitive loads',  lossMech:'Reactive power from supply',    lossRate:0.007},
      'frequency deviation':  {label:'Freq. Deviation',    sev:'Warning',  thr:`${thr.freqMin}\u2013${thr.freqMax} Hz`, root:'Grid instability',             lossMech:'Motor & converter eff. drop',   lossRate:0.008},
      'overtemperature':      {label:'Overtemperature',    sev:'Critical', thr:`T > ${thr.tempMax} \u00b0C`,            root:'Inadequate cooling / overload', lossMech:'Thermal derating losses',       lossRate:0.03 },
      'high temperature':     {label:'High Temperature',   sev:'Warning',  thr:`T > warning level`,                     root:'Increased ambient temperature', lossMech:'Elevated conduction resistance', lossRate:0.01 },
    };

    const energyData = await EnergyData.find({timestamp:{$gte:start,$lte:end},isHardware:true})
                                       .sort({timestamp:1}).limit(10000);
    const faults     = await Fault.find({timestamp:{$gte:start,$lte:end}}).sort({timestamp:1});

    // FIX: bufferPages:true lets us add footers at the end.
    // autoFirstPage defaults to true so the first page is created automatically.
    // FIX: bottom margin reduced to 10 px so the content zone extends to ~831 px.
    // Footer is drawn at ~813 px — safely inside the zone, preventing PDFKit
    // from auto-creating extra blank pages for each doc.text() footer call.
    const doc = new PDFDocument({size:'A4', margins:{top:68,bottom:10,left:48,right:48}, bufferPages:true});

    // FIX: handle PDF stream errors so they don't crash the server.
    // Without this, any error after doc.pipe(res) throws an unhandled
    // 'error' event on the response stream which kills Node.js.
    doc.on('error', (err) => {
      console.error('PDF stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'PDF generation failed: ' + err.message });
      } else {
        res.end();
      }
    });

    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename=energy-audit-${Date.now()}.pdf`);
    doc.pipe(res);

    // ── Page 1 ────────────────────────────────────────────────────────────────
    pageHeader(doc, reportNo, periodLabel, user);
    let y = 72;

    // Info bar
    const infoBar = [
      ['AUDIT TYPE',    'Automated Energy Audit'],
      ['SYSTEM RATING', '300 V / 10 kHz / 30 A'],
      ['USER',          user],
      ['PERIOD',        periodLabel],
    ];
    doc.rect(48, y, doc.page.width-96, 30).fill('#EEF3FA');
    const cW = (doc.page.width-96)/infoBar.length;
    infoBar.forEach(([l,v],i)=>{
      const x=48+i*cW;
      doc.fontSize(6).font('Helvetica').fillColor('#777').text(l,x+4,y+3,{width:cW-6,lineBreak:false});
      doc.fontSize(8).font('Helvetica-Bold').fillColor(C.bodyTxt).text(v,x+4,y+13,{width:cW-6,lineBreak:false});
    });
    y += 34;

    // No hardware data
    if (!energyData.length) {
      y = sH(doc, y, 'SECTION 1: REPORT STATUS', reportNo, periodLabel, user);
      doc.rect(48,y,doc.page.width-96,80).fill('#FFF3E0').stroke('#EF6C00');
      doc.fontSize(11).font('Helvetica-Bold').fillColor(C.warning)
         .text('  No Real Hardware Data Found', 64, y+10, {width: doc.page.width - 128});
      doc.fontSize(8.5).font('Helvetica').fillColor(C.bodyTxt)
         .text(`No ESP32 data for: ${fmtDT(start)} to ${fmtDT(end)}\nConnect hardware then re-generate report.`,
               64, y+28, {width:doc.page.width-128,lineGap:3});
      addFooters(doc, reportNo, periodLabel, user);
      doc.end(); return;
    }

    // ── Statistics ────────────────────────────────────────────────────────────
    const n=energyData.length;
    let sV=0,sI=0,sP=0,sF=0,sT=0,sPF=0,mxV=-Infinity,mnV=Infinity,mxI=-Infinity,mnI=Infinity,mxP=-Infinity,mnP=Infinity;
    energyData.forEach(d=>{
      sV+=d.voltage;sI+=d.current;sP+=d.power;sF+=d.frequency;sT+=d.temperature;sPF+=(d.powerFactor||0.85);
      if(d.voltage>mxV)mxV=d.voltage;if(d.voltage<mnV)mnV=d.voltage;
      if(d.current>mxI)mxI=d.current;if(d.current<mnI)mnI=d.current;
      if(d.power>mxP)mxP=d.power;if(d.power<mnP)mnP=d.power;
    });
    const avgV=sV/n,avgI=sI/n,avgP=sP/n,avgF=sF/n,avgT=sT/n,avgPF=sPF/n;
    const gross = avgP * durHrs / 1000;   // kWh — real (active) energy
    // FIX 1 — Apparent/Reactive energy (gross is already active energy):
    const apparent = avgPF > 0 ? gross / avgPF : gross;                        // kVAh
    const react    = apparent * Math.sqrt(Math.max(0, 1 - avgPF * avgPF));     // kVArh

    // FIX 2 — Wiring loss from I^2R instead of hardcoded 4.56%:
    // Assume typical residential wiring resistance approx. 0.5  Ohm (conservative).
    // P_wire = I^2 x R to E_wire = I^2 x R  x t
    const R_WIRE  = 0.5;   // ohms — adjustable
    const wLoss   = (avgI * avgI * R_WIRE * durHrs) / 1000;   // kWh

    // FIX 3 — Other system losses: transformer + contact resistance (typical 2%)
    const oLoss   = gross * 0.02;

    // FIX 4 — Voltage regulation: (Vmax - Vmin) / Vnom x 100
    // Old formula divided by (2x230) = 460, giving exactly half the true value.
    const vReg = mxV > 0 ? (mxV - mnV) / (avgV > 0 ? avgV : 230) * 100 : 0;
    const fG={};faults.forEach(f=>{const k=nF(f.type, FAULT_META);if(!fG[k])fG[k]=[];fG[k].push(f);});
    let tFL=0;
    const fRows=Object.entries(fG).map(([key,arr])=>{
      const m=FAULT_META[key]||{label:key,sev:'Warning',thr:'--',root:'--',lossMech:'--',lossRate:0.01};
      const dh=dH(arr),eL=avgP/1000*dh*m.lossRate;tFL+=eL;
      return{key,m,count:arr.length,dh,avgMin:arr.length?dh*60/arr.length:0,eL};
    });
    const tLoss=wLoss+oLoss+tFL,useful=Math.max(0,gross-tLoss);
    const eff=gross>0?useful/gross*100:0;
    let score=100;
    if(eff<95)score-=(95-eff)*1.2;
    if(avgPF<0.95)score-=(0.95-avgPF)*50;
    score-=Math.min(20,faults.length*0.5);
    score=Math.round(Math.max(0,Math.min(100,score)));
    const sLbl=score>=90?'Excellent':score>=75?'Good':score>=60?'Fair':'Poor';

    // ── S1 Executive Summary ──────────────────────────────────────────────────
    y = sH(doc, y, 'SECTION 1: EXECUTIVE SUMMARY', reportNo, periodLabel, user);
    const si=[
      {l:'ENERGY SCORE',       b:String(score),              s:sLbl,                                     c:score>=75?C.ok:score>=60?C.warning:C.critical},
      {l:'ENERGY CONSUMED',    b:`${fmtN(gross,3)} kWh`,     s:'Total input from supply'},
      {l:'USEFUL ENERGY',      b:`${fmtN(useful,3)} kWh`,    s:'Net to loads'},
      {l:'FAULT ENERGY LOSS',  b:`${fmtN(tFL,4)} kWh`,       s:`${gross>0?fmtN(tFL/gross*100,1):'0.0'}% of total`, c:tFL>0?C.critical:C.ok},
      {l:'TOTAL FAULT EVENTS', b:String(faults.length),       s:`${Object.keys(fG).length} types`,        c:faults.length>0?C.critical:C.ok},
    ];
    const bW=(doc.page.width-96)/si.length;
    si.forEach((it,i)=>{
      const bx=48+i*bW;
      doc.rect(bx,y,bW,46).fill(i===0?'#F0F7FF':'#FAFCFF').stroke(C.border);
      doc.fontSize(5.5).font('Helvetica').fillColor('#888').text(it.l,bx+3,y+3,{width:bW-6,lineBreak:false});
      doc.fontSize(i===0?15:11).font('Helvetica-Bold').fillColor(it.c||C.primary)
         .text(it.b,bx+3,y+(i===0?11:18),{width:bW-6,lineBreak:false});
      doc.fontSize(6).font('Helvetica').fillColor('#666').text(it.s,bx+3,y+36,{width:bW-6,lineBreak:false});
    });
    y += 49;
    doc.fontSize(7).font('Helvetica').fillColor(C.ok)
       .text(`${n.toLocaleString()} hardware readings  |  ${fmtDT(start)} to ${fmtDT(end)}`,
             48, y, {width:doc.page.width-96, align:'center', lineBreak:false});
    y += 12;

    // ── S2 Trend Charts ───────────────────────────────────────────────────────
    // Charts need ~200px; get a fresh page if needed
    y = ensurePage(doc, y, 210, reportNo, periodLabel, user);
    y = sH(doc, y, `SECTION 2: VOLTAGE / CURRENT / POWER TRENDS  (${periodLabel}  |  ${n} samples)`, reportNo, periodLabel, user);
    const vS=ds(energyData.map(d=>d.voltage)),iS=ds(energyData.map(d=>d.current)),pS=ds(energyData.map(d=>d.power));
    const cx=82, cw=doc.page.width-126, ch=50, gp=9;
    lineChart(doc,vS,cx,y,    cw,ch,'#1565C0','Voltage','V');
    lineChart(doc,iS,cx,y+ch+gp, cw,ch,'#2E7D32','Current','A');
    lineChart(doc,pS,cx,y+2*(ch+gp),cw,ch,'#E65100','Power','W');
    const xLY=y+3*(ch+gp);
    doc.fontSize(7).font('Helvetica').fillColor('#777')
       .text(fmtDT(start),cx,xLY,{width:130,lineBreak:false})
       .text(fmtDT(end),cx+cw-130,xLY,{width:130,align:'right',lineBreak:false})
       .text(' Time to',cx+cw/2-25,xLY,{width:50,align:'center',lineBreak:false});
    y = xLY + 14;

    // ── S3 Energy Statement ───────────────────────────────────────────────────
    // FIX: instead of unconditional doc.addPage(), check if S3 fits.
    // If there's less than 260px remaining (statement needs ~240px), start a new page.
    y = ensurePage(doc, y, 260, reportNo, periodLabel, user);
    y = sH(doc, y, 'SECTION 3: ENERGY CONSUMPTION STATEMENT', reportNo, periodLabel, user);
    const stmt=[
      ['Gross (active) energy drawn from supply',`${fmtN(gross,3)} kWh`,  false,false],
      ['Apparent energy (S = P/PF x t)',          `${fmtN(apparent,3)} kVAh`, true, false],
      ['Reactive energy (Q = S x sin(phi))',          `${fmtN(react,3)} kVArh`,true, false],
      ['Less: Total energy losses',         `- ${fmtN(tLoss,4)} kWh`,false,false],
      ['  Wiring losses (I^2 x R, R=0.5 Ohm est.)',`- ${fmtN(wLoss,5)} kWh`,true, false],
      ['  Fault-induced losses',            `- ${fmtN(tFL,4)} kWh`,  true, false],
      ['  Other system losses',             `- ${fmtN(oLoss,4)} kWh`,true, false],
      ['Net useful energy delivered',       `${fmtN(useful,3)} kWh`, false,true ],
      ['','',false,false],
      [`Total energy cost (@ Rs ${RATE}/kWh)`,fmtRs(gross*RATE),    false,false],
      ['Cost of useful energy',             fmtRs(useful*RATE),      true, false],
      ['Cost of all losses',                fmtRs(tLoss*RATE),       true, false],
      ['Cost wasted due to faults',         fmtRs(tFL*RATE),         true, false],
      ['','',false,false],
      ['System efficiency',                 `${fmtN(eff,1)}%`,       false,true ],
      ['Fault-loss share of total losses',  `${tLoss>0?fmtN(tFL/tLoss*100,1):'0.0'}%`,false,false],
      ['Recoverable savings (faults fixed)',fmtRs(tFL*RATE),          false,false],
    ];
    stmt.forEach((row,i)=>{
      if(!row[0]){y+=4;return;}
      const isTot=row[3],isInd=row[2],rH=13;
      // FIX: check for page overflow before each row
      y = ensurePage(doc, y, rH + 4, reportNo, periodLabel, user);
      doc.rect(48,y,doc.page.width-96,rH).fill(isTot?'#E8F0FE':i%2===1?C.rowAlt:C.rowEven);
      const lC=(row[0].startsWith('Less')||row[0].startsWith('  '))?C.critical:C.bodyTxt;
      doc.font(isTot?'Helvetica-Bold':'Helvetica').fontSize(7.5).fillColor(isTot?C.primary:C.bodyTxt)
         .text(row[0],isInd?66:52,y+3,{width:260,lineBreak:false});
      doc.font(isTot?'Helvetica-Bold':'Helvetica').fontSize(7.5).fillColor(isTot?C.primary:lC)
         .text(row[1],52,y+3,{width:doc.page.width-108,align:'right',lineBreak:false});
      y+=rH;
    });
    y+=6;

    // ── S4 Fault Register ─────────────────────────────────────────────────────
    y = ensurePage(doc, y, 55, reportNo, periodLabel, user);
    y = sH(doc, y, 'SECTION 4: FAULT REGISTER', reportNo, periodLabel, user);
    const fc4=[{t:'#',x:52,w:18,a:'center'},{t:'Fault Type',x:74,w:80},{t:'Severity',x:158,w:52},
               {t:'Threshold',x:214,w:76},{t:'Events',x:294,w:30,a:'right'},
               {t:'Avg Dur.',x:328,w:44,a:'right'},{t:'Total Dur.',x:376,w:48,a:'right'},{t:'Root Cause',x:428,w:128}];
    y = ensurePage(doc, y, 17 + 15, reportNo, periodLabel, user);
    y = tHdr(doc, y, fc4);
    if(!fRows.length){
      doc.rect(48,y,doc.page.width-96,18).fill('#F1FDF4');
      doc.fontSize(7.5).font('Helvetica').fillColor(C.ok)
         .text('No fault events detected.',54,y+5,{lineBreak:false});
      y+=18;
    } else {
      fRows.forEach((fr,i)=>{
        // FIX: check overflow before each data row
        y = ensurePage(doc, y, 15, reportNo, periodLabel, user);
        const sc=fr.m.sev==='Critical'?C.critical:C.warning;
        y=tRow(doc,y,[{t:String(i+1),x:52,w:18,a:'center'},{t:fr.m.label,x:74,w:80,b:true},
          {t:fr.m.sev,x:158,w:52,color:sc,b:true},{t:fr.m.thr,x:214,w:76},
          {t:String(fr.count),x:294,w:30,a:'right',b:true},
          {t:`${fmtN(fr.avgMin,1)} min`,x:328,w:44,a:'right'},
          {t:`${fmtN(fr.dh,3)} hr`,x:376,w:48,a:'right'},{t:fr.m.root,x:428,w:128}],i%2===1);
      });
      const totD=fRows.reduce((a,r)=>a+r.dh,0);
      y = ensurePage(doc, y, 16 + 5, reportNo, periodLabel, user);
      doc.rect(48,y,doc.page.width-96,16).fill('#EEF3FA');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.primary)
         .text('Total',54,y+4,{width:160,lineBreak:false})
         .text(String(faults.length),294,y+4,{width:30,align:'right',lineBreak:false})
         .text(`${fmtN(totD,2)} hr`,376,y+4,{width:48,align:'right',lineBreak:false});
      y+=20;
    }

    // Recent faults (last 6 only, compact)
    if(faults.length>0){
      y = ensurePage(doc, y, 15 + 9 + 15*6 + 5, reportNo, periodLabel, user);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.primary)
         .text('Recent Events:',48,y,{lineBreak:false});
      y+=9;
      const rc=[{t:'Time',x:52,w:88},{t:'Type',x:144,w:90},{t:'Sev.',x:238,w:46},
                {t:'Value',x:288,w:56},{t:'Threshold',x:348,w:70},{t:'Message',x:422,w:130}];
      y=tHdr(doc,y,rc,15);
      faults.slice(-6).reverse().forEach((f,i)=>{
        y = ensurePage(doc, y, 13, reportNo, periodLabel, user);
        const sc=f.severity==='critical'?C.critical:f.severity==='warning'?C.warning:C.primary;
        y=tRow(doc,y,[
          {t:new Date(f.timestamp).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),x:52,w:88},
          {t:f.type,x:144,w:90,b:true},{t:f.severity,x:238,w:46,color:sc,b:true},
          {t:f.value||'--',x:288,w:56},{t:f.threshold||'--',x:348,w:70},
          {t:(f.message||'').substring(0,48),x:422,w:130}],i%2===1,13);
      });
      y+=5;
    }

    // ── S5 Loss Analysis ──────────────────────────────────────────────────────
    y = ensurePage(doc, y, 55, reportNo, periodLabel, user);
    y = sH(doc, y, 'SECTION 5: ENERGY LOSS ANALYSIS DUE TO FAULTS', reportNo, periodLabel, user);
    const fc5=[{t:'#',x:52,w:18,a:'center'},{t:'Fault Type',x:74,w:74},{t:'Sev.',x:152,w:46},
               {t:'Loss Mechanism',x:202,w:110},{t:'Dur.(hr)',x:316,w:48,a:'right'},
               {t:'Energy(kWh)',x:368,w:56,a:'right'},{t:'%',x:428,w:36,a:'right'},{t:'Cost Lost',x:468,w:88,a:'right'}];
    y = ensurePage(doc, y, 17 + 15, reportNo, periodLabel, user);
    y=tHdr(doc,y,fc5);
    if(!fRows.length){
      doc.rect(48,y,doc.page.width-96,18).fill('#F1FDF4');
      doc.fontSize(7.5).font('Helvetica').fillColor(C.ok)
         .text('No fault-induced losses.',54,y+5,{lineBreak:false});
      y+=18;
    } else {
      fRows.forEach((fr,i)=>{
        y = ensurePage(doc, y, 15, reportNo, periodLabel, user);
        const pct=tFL>0?fr.eL/tFL*100:0,sc=fr.m.sev==='Critical'?C.critical:C.warning;
        y=tRow(doc,y,[{t:String(i+1),x:52,w:18,a:'center'},{t:fr.m.label,x:74,w:74,b:true},
          {t:fr.m.sev,x:152,w:46,color:sc,b:true},{t:fr.m.lossMech,x:202,w:110},
          {t:fmtN(fr.dh,3),x:316,w:48,a:'right'},{t:fmtN(fr.eL,4),x:368,w:56,a:'right'},
          {t:`${fmtN(pct,1)}%`,x:428,w:36,a:'right'},{t:fmtRs(fr.eL*RATE),x:468,w:88,a:'right',color:C.critical}],i%2===1);
      });
      const totD2=fRows.reduce((a,r)=>a+r.dh,0);
      y = ensurePage(doc, y, 16 + 20, reportNo, periodLabel, user);
      doc.rect(48,y,doc.page.width-96,16).fill('#EEF3FA');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.primary)
         .text('Total',54,y+4,{width:210,lineBreak:false})
         .text(fmtN(totD2,3),316,y+4,{width:48,align:'right',lineBreak:false})
         .text(fmtN(tFL,4),368,y+4,{width:56,align:'right',lineBreak:false})
         .text(`${gross>0?fmtN(tFL/gross*100,1):'0.0'}%`,428,y+4,{width:36,align:'right',lineBreak:false})
         .text(fmtRs(tFL*RATE),468,y+4,{width:88,align:'right',lineBreak:false});
      y+=20;
    }

    // ── S6 Power Quality ──────────────────────────────────────────────────────
    // S6 needs header (19) + col header (17) + 4 rowsx17 + gap (7) = ~111px
    y = ensurePage(doc, y, 115, reportNo, periodLabel, user);
    y = sH(doc, y, 'SECTION 6: POWER QUALITY ASSESSMENT', reportNo, periodLabel, user);
    const fc6=[{t:'Parameter',x:54,w:100},{t:'Measured',x:158,w:60},{t:'Status',x:222,w:60},
               {t:'Standard Reference',x:286,w:105},{t:'Recommendation',x:395,w:161}];
    y=tHdr(doc,y,fc6);
    const pfSt=avgPF>=0.90?{s:'Good',c:C.ok}:avgPF>=0.80?{s:'Fair',c:C.warning}:{s:'Poor',c:C.critical};
    const vrSt=vReg<=3?{s:'Good',c:C.ok}:vReg<=5?{s:'Marginal',c:C.warning}:{s:'Poor',c:C.critical};
    // FIX: THD now estimated from avgPF using harmonic model (same as oscilloscope FFT panel).
    // Old code hardcoded '~4.3%' and '~3.0%' regardless of actual measured PF.
    const pfClamp  = Math.min(1, Math.max(0.5, avgPF));
    const k        = (1 - pfClamp) / 0.3;
    const h3 = 0.04 + k * 0.11, h5 = 0.02 + k * 0.07, h7 = 0.01 + k * 0.04;
    const h2 = 0.008, h4 = 0.004, h6 = 0.003, h9 = 0.005 + k * 0.02;
    const thdV = Math.sqrt(h2**2+h3**2+h4**2+h5**2+h6**2+h7**2+h9**2)*100;
    const thdI = thdV * 0.7;  // current THD typically lower than voltage THD
    const thdVSt = thdV<5?{s:'Acceptable',c:C.ok}:thdV<8?{s:'Marginal',c:C.warning}:{s:'Poor',c:C.critical};
    const thdISt = thdI<8?{s:'Acceptable',c:C.ok}:thdI<12?{s:'Marginal',c:C.warning}:{s:'Poor',c:C.critical};

    [['Avg. Power Factor',`${fmtN(avgPF,3)}`,pfSt,'IEC 61000-3-2: >= 0.90',avgPF<0.90?'Install capacitor bank':'Within range'],
     ['Voltage Regulation',`${fmtN(vReg,1)}%`,vrSt,'Standard: <= 3%',vReg>5?'Install AVR urgently':vReg>3?'Monitor; install AVR':'Within standard'],
     [`Voltage THD (est.)`,`${fmtN(thdV,1)}%`,thdVSt,'IEEE 519: <= 5%',thdV>5?'Voltage harmonic filters needed':'Within limits'],
     [`Current THD (est.)`,`${fmtN(thdI,1)}%`,thdISt,'IEEE 519: <= 8%',thdI>8?'Current harmonic filters needed':'Within limits'],
    ].forEach((row,i)=>{
      y = ensurePage(doc, y, 17, reportNo, periodLabel, user);
      y=tRow(doc,y,[{t:row[0],x:54,w:100,b:true},{t:row[1],x:158,w:60,b:true,color:C.primary},
         {t:row[2].s,x:222,w:60,b:true,color:row[2].c},{t:row[3],x:286,w:105,color:'#555'},{t:row[4],x:395,w:161}],i%2===1,17);
    });
    y+=7;

    // ── S7 Recommendations ────────────────────────────────────────────────────
    y = ensurePage(doc, y, 55, reportNo, periodLabel, user);
    y = sH(doc, y, 'SECTION 7: RECOMMENDATIONS', reportNo, periodLabel, user);
    const recs=[];
    if(avgPF<0.90) recs.push({n:recs.length+1,title:'Install Power Factor Correction Capacitor Bank',detail:`Avg PF ${fmtN(avgPF,3)} detected (IEC 61000-3-2 target >= 0.90). Install a capacitor bank sized to bring PF above 0.95. Est. saving: ${fmtRs(react*RATE*0.05)}/period.`});
    if(vReg>3)     recs.push({n:recs.length+1,title:'Install Automatic Voltage Regulator (AVR)',detail:`Voltage regulation ${fmtN(vReg,1)}% exceeds the +/-3% standard. An AVR maintains stable output voltage and prevents both over and under-voltage faults.`});

    // Fault-type-specific recommendations
    const faultTypes = Object.keys(fG);
    const hasTemp  = faultTypes.some(k=>k.includes('temperature'));
    const hasVolt  = faultTypes.some(k=>k.includes('voltage'));
    const hasCurr  = faultTypes.some(k=>k.includes('current')||k.includes('overload'));
    const hasFreq  = faultTypes.some(k=>k.includes('frequency'));
    const hasPF    = faultTypes.some(k=>k.includes('power factor'));

    if(hasTemp)  recs.push({n:recs.length+1,title:'Improve Thermal Management',detail:`High temperature faults detected (avg temp ${fmtN(avgT,1)} C). Check ventilation, clean heat sinks, verify ambient temperature is within equipment rating. Consider adding cooling fans or relocating equipment.`});
    if(hasVolt)  recs.push({n:recs.length+1,title:'Investigate Voltage Supply Quality',detail:`Voltage faults detected (range ${fmtN(mnV,1)}-${fmtN(mxV,1)} V). Check utility supply, verify wiring connections, and consider UPS or AVR installation.`});
    if(hasCurr)  recs.push({n:recs.length+1,title:'Load Scheduling and Overload Protection',detail:`Overcurrent or overload faults detected. Reschedule heavy loads to off-peak hours. Install properly-rated MCBs and thermal overload relays.`});
    if(hasFreq)  recs.push({n:recs.length+1,title:'Grid Frequency Stabilisation',detail:`Frequency deviation faults detected. This indicates grid instability. Consider a UPS with frequency regulation for sensitive equipment.`});
    if(hasPF)    recs.push({n:recs.length+1,title:'Power Factor Correction Required',detail:`Low power factor faults detected. Install capacitor banks at the load to reduce reactive current and improve system efficiency.`});
    if(tFL*RATE>0.05) recs.push({n:recs.length+1,title:'Fault Resolution — Financial Recovery',detail:`${fmtRs(tFL*RATE)} estimated lost to fault-induced losses this period. Resolving faults would recover this cost.`});
    if(!recs.length) recs.push({n:1,title:'Continue Regular Monitoring',detail:'No critical issues detected. All parameters within configured thresholds. Maintain periodic audits to sustain optimal performance.'});

    recs.forEach(rec=>{
      // FIX: calculate how much space this recommendation needs before drawing it
      const detailH = doc.heightOfString(rec.detail, {width: doc.page.width - 120});
      const recHeight = 13 + detailH + 7;
      y = ensurePage(doc, y, recHeight, reportNo, periodLabel, user);

      doc.rect(48,y,12,12).fill(C.primary);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFF')
         .text(String(rec.n),48,y+2,{width:12,align:'center',lineBreak:false});
      doc.fontSize(9).font('Helvetica-Bold').fillColor(C.primary)
         .text(rec.title,64,y+1,{width:doc.page.width-120,lineBreak:false});
      y+=13;
      doc.fontSize(8).font('Helvetica').fillColor(C.bodyTxt)
         .text(rec.detail,64,y,{width:doc.page.width-120,lineBreak:true});
      y+=detailH+7;
    });

    // ── Footers on all pages ──────────────────────────────────────────────────
    addFooters(doc, reportNo, periodLabel, user);
    doc.end();

  } catch(err){
    console.error('Report error:', err.message);
    // If headers not sent yet, we can send a proper JSON error response.
    // If headers WERE already sent (PDF streaming started), we must NOT
    // write to res again — that would throw ERR_STREAM_WRITE_AFTER_END
    // and crash the server. Instead just destroy the stream cleanly.
    if (!res.headersSent) {
      res.status(500).json({ error: 'Report generation failed: ' + err.message });
    } else {
      try { res.end(); } catch(e) { /* stream already closed */ }
    }
  }
});

// FIX: footer y-coordinates are now safely within the content zone.
// Previously drawn at page.height - 22 = ~819 px, which is past the old
// bottom margin boundary of ~801 px. PDFKit auto-created a new page for
// every doc.text() call, producing 4 extra blank pages on a 2-page report.
// With margin.bottom = 10, content zone extends to ~831 px.
// lineY = ~808 and textY = ~818 are both well within that zone.
function addFooters(doc, reportNo, periodLabel, user) {
  const rng   = doc.bufferedPageRange();
  const lineY = doc.page.height - 33;   // separator line
  const textY = doc.page.height - 23;   // footer text baseline

  for (let i = 0; i < rng.count; i++) {
    doc.switchToPage(rng.start + i);
    const fw = doc.page.width - 96;

    // Thin separator line
    doc.rect(48, lineY, fw, 0.5).fill(C.border);

    // Left-aligned label — explicit width so it doesn't overflow to right
    doc.fontSize(7).font('Helvetica').fillColor('#888')
       .text(
         `Energy Audit and Diagnostics System  |  ${user}  |  ${periodLabel}`,
         48, textY,
         { width: fw - 70, lineBreak: false }
       );

    // Right-aligned page number — anchored from the right edge
    doc.fontSize(7).font('Helvetica').fillColor('#888')
       .text(
         `Page ${i + 1} of ${rng.count}`,
         doc.page.width - 48 - 70, textY,
         { width: 70, align: 'right', lineBreak: false }
       );
  }
}

module.exports = router;
