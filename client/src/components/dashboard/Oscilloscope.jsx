import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import './Oscilloscope.css'

function getCanvasSize(canvas) {
  const rect = canvas.getBoundingClientRect()
  return { w: rect.width  || canvas.parentElement?.clientWidth  || 600,
           h: rect.height || canvas.parentElement?.clientHeight || 280 }
}

function adcToNorm(samples) {
  if (!samples || samples.length < 2) return []
  const mean    = samples.reduce((a, b) => a + b, 0) / samples.length
  const centred = samples.map(s => s - mean)
  const peak    = Math.max(...centred.map(Math.abs)) || 1
  return centred.map(s => s / peak)
}

// Fixed full-scale references — amplitude changes clearly visible
const V_FULL_SCALE = 350   // peak volts  (covers 250 V RMS)
const I_FULL_SCALE = 50    // peak amps   (covers 30 A RMS)

// ── Smooth Catmull-Rom spline draw ───────────────────────────────────────────
function drawSmooth(ctx, samples, color, W, midY, halfH) {
  if (!samples || samples.length < 2) return
  const N = samples.length, step = W / (N - 1)
  const px = i => i * step
  const py = i => midY - samples[i] * halfH

  // Glow fill
  ctx.save()
  ctx.beginPath(); ctx.moveTo(px(0), midY)
  for (let i = 0; i < N - 1; i++) {
    const p0 = samples[Math.max(i-1,0)], p1 = samples[i]
    const p2 = samples[i+1], p3 = samples[Math.min(i+2,N-1)]
    const x1 = px(i), x2 = px(i+1)
    const cp1x = x1 + (x2 - px(Math.max(i-1,0))) / 6
    const cp1y = (midY - p1*halfH) + ((midY - p2*halfH) - (midY - p0*halfH)) / 6
    const cp2x = x2 - (px(Math.min(i+2,N-1)) - x1) / 6
    const cp2y = (midY - p2*halfH) - ((midY - p3*halfH) - (midY - p1*halfH)) / 6
    if (i === 0) ctx.moveTo(x1, py(i))
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, py(i+1))
  }
  ctx.lineTo(px(N-1), midY); ctx.closePath()
  ctx.fillStyle = color + '18'; ctx.fill()

  // Smooth waveform line
  ctx.beginPath()
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.shadowBlur = 8; ctx.shadowColor = color
  for (let i = 0; i < N - 1; i++) {
    const p0 = samples[Math.max(i-1,0)], p1 = samples[i]
    const p2 = samples[i+1], p3 = samples[Math.min(i+2,N-1)]
    const x1 = px(i), x2 = px(i+1)
    const cp1x = x1 + (x2 - px(Math.max(i-1,0))) / 6
    const cp1y = (midY - p1*halfH) + ((midY - p2*halfH) - (midY - p0*halfH)) / 6
    const cp2x = x2 - (px(Math.min(i+2,N-1)) - x1) / 6
    const cp2y = (midY - p2*halfH) - ((midY - p3*halfH) - (midY - p1*halfH)) / 6
    if (i === 0) ctx.moveTo(x1, py(i))
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, py(i+1))
  }
  ctx.stroke(); ctx.shadowBlur = 0; ctx.restore()
}

// ── DualOscilloscope ──────────────────────────────────────────────────────────
export function DualOscilloscope({
  voltage, current, frequency, powerFactor,
  voltageBuffer, currentBuffer
}) {
  const vCanvasRef = useRef(null)
  const iCanvasRef = useRef(null)
  const vRafRef    = useRef(null)
  const iRafRef    = useRef(null)
  const vSizeRef   = useRef({ w: 0, h: 0 })
  const iSizeRef   = useRef({ w: 0, h: 0 })

  // CSV recording
  const [recording, setRecording] = useState(false)
  const [recCount,  setRecCount]  = useState(0)
  const recRef = useRef([])

  const phiDeg = useMemo(() => {
    const pf = Math.min(1, Math.max(0, powerFactor || 0))
    return pf > 0 ? +(Math.acos(pf) * 180 / Math.PI).toFixed(1) : 0
  }, [powerFactor])

  const normV = useMemo(() => adcToNorm(voltageBuffer), [voltageBuffer])
  const normI = useMemo(() => adcToNorm(currentBuffer), [currentBuffer])
  const hasRealV = normV.length >= 10
  const hasRealI = normI.length >= 10

  // CSV accumulate
  useEffect(() => {
    if (!recording || !voltageBuffer || voltageBuffer.length < 2) return
    const ts = new Date().toISOString()
    voltageBuffer.forEach((vv, idx) => {
      recRef.current.push({
        n: recRef.current.length, ts, idx,
        v_V: vv.toFixed(4),
        i_A: currentBuffer && currentBuffer[idx] != null
          ? currentBuffer[idx].toFixed(6) : 'N/A'
      })
    })
    setRecCount(recRef.current.length)
  }, [voltageBuffer, currentBuffer, recording])

  const startRec = () => { recRef.current = []; setRecCount(0); setRecording(true) }
  const stopDownload = () => {
    setRecording(false)
    const rows = ['sample,timestamp,index,voltage_V,current_A',
      ...recRef.current.map(r => `${r.n},${r.ts},${r.idx},${r.v_V},${r.i_A}`)]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href     = url
    link.download = `waveform-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`
    link.click(); URL.revokeObjectURL(url); recRef.current = []
  }

  // ── Draw VOLTAGE canvas ────────────────────────────────────────────────────
  const drawV = useCallback(() => {
    const canvas = vCanvasRef.current; if (!canvas) return
    const { w: W, h: H } = getCanvasSize(canvas); if (W < 10 || H < 10) return
    if (vSizeRef.current.w !== W || vSizeRef.current.h !== H) {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = W * dpr; canvas.height = H * dpr
      canvas.getContext('2d').scale(dpr, dpr)
      vSizeRef.current = { w: W, h: H }
    }
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#050a14'; ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(66,165,245,0.07)'; ctx.lineWidth = 1
    for (let gi = 0; gi <= 10; gi++) {
      ctx.beginPath(); ctx.moveTo(0, H/10*gi); ctx.lineTo(W, H/10*gi); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W/10*gi, 0); ctx.lineTo(W/10*gi, H); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(66,165,245,0.25)'; ctx.lineWidth = 1.2
    ctx.setLineDash([6, 4])
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke()
    ctx.setLineDash([])

    if (!voltage || voltage < 1) {
      ctx.fillStyle = 'rgba(100,181,246,0.5)'
      ctx.font = `bold ${Math.max(13, W*0.022)}px Arial`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('NO VOLTAGE SIGNAL', W/2, H/2)
      vRafRef.current = requestAnimationFrame(drawV); return
    }

    const vPeak  = voltage * Math.SQRT2
    const midY   = H / 2
    const halfH  = H * 0.44

    if (hasRealV) {
      const vScale = Math.min(1, vPeak / V_FULL_SCALE)
      drawSmooth(ctx, normV.map(s => s * vScale), '#42a5f5', W, midY, halfH)
    } else {
      const CYCLES = 3, N = 400
      const vScale = Math.min(1, vPeak / V_FULL_SCALE)
      const vSamples = Array.from({ length: N }, (_, k) =>
        vScale * Math.sin(2 * Math.PI * CYCLES * k / N))
      drawSmooth(ctx, vSamples, '#42a5f5', W, midY, halfH)
    }

    // Info labels
    const fs = Math.max(10, Math.min(13, W * 0.018))
    ctx.font = `bold ${fs}px Arial`; ctx.textBaseline = 'top'
    ctx.fillStyle = '#42a5f5'; ctx.textAlign = 'left'
    ctx.fillText(`V_rms = ${voltage.toFixed(1)} V     V_peak = ${vPeak.toFixed(1)} V     f = ${frequency || 50} Hz`, 8, 6)
    ctx.fillStyle = '#ffb74d'; ctx.textAlign = 'right'
    ctx.fillText(`φ = ${phiDeg}°   PF = ${powerFactor > 0 ? powerFactor.toFixed(3) : '—'}`, W - 6, 6)
    ctx.fillStyle = hasRealV ? 'rgba(76,175,80,0.8)' : 'rgba(255,183,77,0.7)'
    ctx.font = `bold ${Math.max(9, fs-2)}px Arial`; ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(hasRealV ? '● REAL' : '● TRIGGERED', W - 6, H - 6)

    vRafRef.current = requestAnimationFrame(drawV)
  }, [voltage, frequency, powerFactor, phiDeg, hasRealV, normV])

  // ── Draw CURRENT canvas ────────────────────────────────────────────────────
  // AMPLIFIED scale: uses actual peak of the current signal so even tiny
  // currents (0.01A) fill the full canvas height visibly
  const drawI = useCallback(() => {
    const canvas = iCanvasRef.current; if (!canvas) return
    const { w: W, h: H } = getCanvasSize(canvas); if (W < 10 || H < 10) return
    if (iSizeRef.current.w !== W || iSizeRef.current.h !== H) {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = W * dpr; canvas.height = H * dpr
      canvas.getContext('2d').scale(dpr, dpr)
      iSizeRef.current = { w: W, h: H }
    }
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#050a14'; ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(102,187,106,0.07)'; ctx.lineWidth = 1
    for (let gi = 0; gi <= 10; gi++) {
      ctx.beginPath(); ctx.moveTo(0, H/10*gi); ctx.lineTo(W, H/10*gi); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W/10*gi, 0); ctx.lineTo(W/10*gi, H); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(102,187,106,0.25)'; ctx.lineWidth = 1.2
    ctx.setLineDash([6, 4])
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke()
    ctx.setLineDash([])

    if (!current || current < 0.001) {
      ctx.fillStyle = 'rgba(102,187,106,0.5)'
      ctx.font = `bold ${Math.max(13, W*0.022)}px Arial`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('NO CURRENT SIGNAL — check ACS712 +5V & A1', W/2, H/2)
      iRafRef.current = requestAnimationFrame(drawI); return
    }

    const iPeak = current * Math.SQRT2
    const midY  = H / 2
    // Reduced Y scale — waveform occupies ~44% of canvas height
    // Keeps amplitude visually proportional to actual current magnitude
    const halfH = H * 0.22

    if (hasRealI) {
      // normI is already ±1 normalised — always fills the screen
      drawSmooth(ctx, normI, '#66bb6a', W, midY, halfH)
    } else {
      const CYCLES = 3, N = 400
      const iPhi  = Math.acos(Math.min(1, Math.max(-1, powerFactor > 0 ? powerFactor : 1)))
      const iSamples = Array.from({ length: N }, (_, k) =>
        Math.sin(2 * Math.PI * CYCLES * k / N - iPhi))
      drawSmooth(ctx, iSamples, '#66bb6a', W, midY, halfH)
    }

    // Info labels — show REAL amplitude values clearly
    const fs = Math.max(10, Math.min(13, W * 0.018))
    ctx.font = `bold ${fs}px Arial`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
    ctx.fillStyle = '#66bb6a'
    ctx.fillText(`I_rms = ${current.toFixed(4)} A     I_peak = ${iPeak.toFixed(4)} A     ACS712-30A  66 mV/A`, 8, 6)
    // Scale annotation: tells user the actual range displayed
    ctx.fillStyle = 'rgba(102,187,106,0.55)'; ctx.textAlign = 'right'
    ctx.font = `${Math.max(9, fs-2)}px Arial`
    ctx.fillText(`Auto-scale ±${iPeak.toFixed(4)} A (full screen)`, W - 6, 6)
    ctx.fillStyle = hasRealI ? 'rgba(76,175,80,0.8)' : 'rgba(255,183,77,0.7)'
    ctx.font = `bold ${Math.max(9, fs-2)}px Arial`
    ctx.textBaseline = 'bottom'
    ctx.fillText(hasRealI ? '● REAL  amplified scale' : '● TRIGGERED', W - 6, H - 6)

    // Y-axis scale labels on every grid division
    // Each division = iPeak / 5 amps  (10 divisions total, ±5 divisions from centre)
    const divCount = 5          // divisions above and below zero
    const ampsPerDiv = iPeak / divCount
    ctx.font = `${Math.max(8, fs-2)}px 'Courier New',monospace`
    ctx.textAlign = 'right'
    for (let div = -divCount; div <= divCount; div++) {
      const yPos   = midY - (div / divCount) * halfH
      const aValue = ampsPerDiv * div
      // highlight 0A line
      ctx.fillStyle = div === 0
        ? 'rgba(102,187,106,0.85)'
        : 'rgba(102,187,106,0.40)'
      ctx.textBaseline = 'middle'
      // only label every other division to avoid crowding
      if (div % 1 === 0) {
        const label = div === 0 ? '0 A' : `${aValue >= 0 ? '+' : ''}${aValue.toFixed(3)} A`
        ctx.fillText(label, W - 6, yPos)
      }
    }

    // Box behind labels so they are readable over the waveform
    // (drawn before labels — we redraw labels on top)
    // Peak annotation lines
    ctx.strokeStyle = 'rgba(102,187,106,0.18)'
    ctx.lineWidth = 0.7; ctx.setLineDash([3, 5])
    ctx.beginPath(); ctx.moveTo(0, midY - halfH); ctx.lineTo(W - 60, midY - halfH); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, midY + halfH); ctx.lineTo(W - 60, midY + halfH); ctx.stroke()
    ctx.setLineDash([])

    iRafRef.current = requestAnimationFrame(drawI)
  }, [current, powerFactor, hasRealI, normI])

  useEffect(() => {
    vRafRef.current = requestAnimationFrame(drawV)
    return () => { if (vRafRef.current) cancelAnimationFrame(vRafRef.current) }
  }, [drawV])

  useEffect(() => {
    iRafRef.current = requestAnimationFrame(drawI)
    return () => { if (iRafRef.current) cancelAnimationFrame(iRafRef.current) }
  }, [drawI])

  useEffect(() => {
    const roV = new ResizeObserver(() => { vSizeRef.current = { w: 0, h: 0 } })
    const roI = new ResizeObserver(() => { iSizeRef.current = { w: 0, h: 0 } })
    if (vCanvasRef.current?.parentElement) roV.observe(vCanvasRef.current.parentElement)
    if (iCanvasRef.current?.parentElement) roI.observe(iCanvasRef.current.parentElement)
    return () => { roV.disconnect(); roI.disconnect() }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>

      {/* CSV toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {!recording
          ? <button onClick={startRec} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 7,
              background: 'rgba(239,83,80,0.12)', color: '#ef5350',
              border: '1px solid rgba(239,83,80,0.4)', cursor: 'pointer',
              fontFamily: 'Courier New,monospace', fontWeight: 700, fontSize: 12
            }}>
              <span style={{ fontSize: 16 }}>&#9210;</span> Record CSV
            </button>
          : <button onClick={stopDownload} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 7,
              background: 'rgba(76,175,80,0.12)', color: '#4caf50',
              border: '1px solid rgba(76,175,80,0.4)', cursor: 'pointer',
              fontFamily: 'Courier New,monospace', fontWeight: 700, fontSize: 12,
              animation: 'blink 1s step-end infinite'
            }}>
              <span style={{ fontSize: 16 }}>&#9209;</span> Stop &amp; Download ({recCount} pts)
            </button>
        }
        <span style={{ fontFamily: 'Courier New,monospace', fontSize: 11, color: '#546e7a' }}>
          {hasRealV
            ? <span style={{ color: '#4caf50' }}>&#9679; Hardware &mdash; {normV.length} samples/packet</span>
            : <span style={{ color: '#ff9800' }}>&#9679; Simulation mode</span>}
        </span>
      </div>

      {/* VOLTAGE oscilloscope */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative',
                    background: '#050a14', borderRadius: 10,
                    border: '1.5px solid rgba(66,165,245,0.22)', overflow: 'hidden' }}>
        <canvas ref={vCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
        <div style={{ position: 'absolute', bottom: 8, left: 10,
                      display: 'flex', gap: 14, fontSize: 11,
                      fontFamily: 'Courier New,monospace', fontWeight: 600,
                      background: 'rgba(5,10,20,0.75)', padding: '3px 10px', borderRadius: 6 }}>
          <span style={{ color: '#42a5f5' }}>&#8212;&#8212; Voltage</span>
          <span style={{ color: '#ffb74d' }}>&phi; = {phiDeg}&deg;</span>
          {voltage > 1
            ? <span style={{ color: hasRealV ? '#4caf50' : '#ff9800' }}>
                {hasRealV ? '&#9679; Live (hardware)' : '&#9679; Triggered (simulation)'}
              </span>
            : <span style={{ color: '#ef5350' }}>&#9679; Awaiting signal</span>}
        </div>
      </div>

      {/* CURRENT oscilloscope */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative',
                    background: '#050a14', borderRadius: 10,
                    border: '1.5px solid rgba(102,187,106,0.22)', overflow: 'hidden' }}>
        <canvas ref={iCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/>
        <div style={{ position: 'absolute', bottom: 8, left: 10,
                      display: 'flex', gap: 14, fontSize: 11,
                      fontFamily: 'Courier New,monospace', fontWeight: 600,
                      background: 'rgba(5,10,20,0.75)', padding: '3px 10px', borderRadius: 6 }}>
          <span style={{ color: '#66bb6a' }}>&#8212;&#8212; Current (auto-scale amplified)</span>
          {current > 0.001
            ? <span style={{ color: hasRealI ? '#4caf50' : '#ff9800' }}>
                {hasRealI ? '&#9679; Live (hardware)' : '&#9679; Triggered (simulation)'}
              </span>
            : <span style={{ color: '#ef5350' }}>&#9679; No signal</span>}
        </div>
      </div>

      <style>{\`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.6}}\`}</style>
    </div>
  )
}


// ── FFTOscilloscope ───────────────────────────────────────────────────────────
function buildSpectrum(pf, f0) {
  const pfClamped = Math.min(1, Math.max(0.5, pf > 0 ? pf : 0.95))
  const k = (1-pfClamped)/0.3
  const bins = [
    {n:1,freq:f0,   mag:1.00,       isFund:true },
    {n:2,freq:f0*2, mag:0.008,      isFund:false},
    {n:3,freq:f0*3, mag:0.04+k*0.11,isFund:false},
    {n:4,freq:f0*4, mag:0.004,      isFund:false},
    {n:5,freq:f0*5, mag:0.02+k*0.07,isFund:false},
    {n:6,freq:f0*6, mag:0.003,      isFund:false},
    {n:7,freq:f0*7, mag:0.01+k*0.04,isFund:false},
    {n:9,freq:f0*9, mag:0.005+k*0.02,isFund:false},
  ]
  const thd = Math.sqrt(bins.slice(1).reduce((a,b)=>a+b.mag**2,0))*100
  return { bins, thd }
}

export function FFTOscilloscope({ voltage, current, frequency, powerFactor }) {
  const canvasRef = useRef(null)
  const f0 = frequency > 1 ? frequency : 50
  const {bins,thd} = useMemo(()=>buildSpectrum(powerFactor,f0),[powerFactor,f0])
  const quality = thd<3?{label:'EXCELLENT',color:'#26c6da'}:thd<5?{label:'GOOD',color:'#4caf50'}:thd<8?{label:'FAIR',color:'#ff9800'}:{label:'POOR',color:'#f44336'}

  const draw = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    const {w:W,h:H}=getCanvasSize(canvas); if(W<10||H<10) return
    const dpr=window.devicePixelRatio||1; canvas.width=W*dpr; canvas.height=H*dpr
    const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr)
    ctx.fillStyle='#050a14'; ctx.fillRect(0,0,W,H)
    if(!voltage||voltage<1){
      ctx.fillStyle='rgba(100,181,246,0.45)';ctx.font=`bold ${Math.max(13,W*0.022)}px Arial`
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('NO SIGNAL',W/2,H/2);return
    }
    const padL=52,padR=16,padT=55,padB=46,plotW=W-padL-padR,plotH=H-padT-padB,barW=plotW/bins.length
    for(let i=0;i<=4;i++){
      const gy=padT+(plotH/4)*i;ctx.strokeStyle='rgba(66,165,245,0.08)';ctx.lineWidth=1
      ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(padL+plotW,gy);ctx.stroke()
      ctx.fillStyle='#5a6f85';ctx.font='9px Arial';ctx.textAlign='right';ctx.textBaseline='middle'
      ctx.fillText(`${((1-i/4)*100).toFixed(0)}%`,padL-4,gy)
    }
    bins.forEach((bin,idx)=>{
      const barH=bin.mag*plotH,x=padL+idx*barW,y=padT+plotH-barH
      const g=ctx.createLinearGradient(0,y,0,y+barH)
      if(bin.isFund){g.addColorStop(0,'rgba(66,165,245,1)');g.addColorStop(1,'rgba(66,165,245,0.2)')}
      else{const a=0.3+bin.mag*0.7;g.addColorStop(0,`rgba(239,83,80,${a})`);g.addColorStop(1,'rgba(239,83,80,0.1)')}
      ctx.fillStyle=g;ctx.fillRect(x+2,y,Math.max(barW-4,2),barH)
      if(bin.mag>0.03&&barW>14){
        ctx.fillStyle=bin.isFund?'#90caf9':'#ef9a9a';ctx.font=`bold ${Math.min(9,barW*0.35)}px Arial`
        ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(`${(bin.mag*100).toFixed(1)}%`,x+barW/2,y-2)
      }
      ctx.save();ctx.fillStyle=bin.isFund?'#90caf9':'#ef9a9a';ctx.font='bold 8px Arial';ctx.textAlign='center'
      ctx.translate(x+barW/2,padT+plotH+7);ctx.rotate(-Math.PI/6);ctx.fillText(`H${bin.n} ${bin.freq.toFixed(0)}Hz`,0,0);ctx.restore()
    })
    ctx.strokeStyle='rgba(66,165,245,0.3)';ctx.lineWidth=1
    ctx.beginPath();ctx.moveTo(padL,padT);ctx.lineTo(padL,padT+plotH);ctx.lineTo(padL+plotW,padT+plotH);ctx.stroke()
    const ieee5Y=padT+plotH-0.05*plotH;ctx.strokeStyle='rgba(255,152,0,0.75)';ctx.lineWidth=1.2;ctx.setLineDash([5,4])
    ctx.beginPath();ctx.moveTo(padL,ieee5Y);ctx.lineTo(padL+plotW,ieee5Y);ctx.stroke();ctx.setLineDash([])
    ctx.fillStyle='#ffa726';ctx.font='bold 8.5px Arial';ctx.textAlign='left';ctx.textBaseline='bottom'
    ctx.fillText('IEEE 519 — 5% limit',padL+4,ieee5Y-2)
    ctx.save();ctx.translate(13,padT+plotH/2);ctx.rotate(-Math.PI/2)
    ctx.fillStyle='#6a7f96';ctx.font='10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Relative Magnitude',0,0);ctx.restore()
    ctx.textBaseline='top';ctx.textAlign='left';ctx.fillStyle='#8a9bb0';ctx.font='bold 11px Arial'
    ctx.fillText('Harmonic Spectrum — Power Quality',padL,8)
    ctx.fillStyle='#6a7f96';ctx.font='9px Arial'
    ctx.fillText(`V:${voltage!=null?voltage.toFixed(1):'—'}V  I:${current!=null?current.toFixed(3):'—'}A  f\u2080:${f0}Hz  PF:${powerFactor>0?powerFactor.toFixed(3):'—'}`,padL,24)
    ctx.textAlign='right';ctx.textBaseline='top';ctx.fillStyle=quality.color;ctx.font='bold 13px Arial'
    ctx.fillText(`THD: ${thd.toFixed(1)}%`,W-padR,8)
    const bw=76,bh=20,bx=W-padR-bw,by=26
    ctx.fillStyle=quality.color+'22';ctx.fillRect(bx,by,bw,bh);ctx.strokeStyle=quality.color;ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,bh)
    ctx.fillStyle=quality.color;ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(quality.label,bx+bw/2,by+bh/2)
  },[bins,thd,quality,voltage,current,frequency,powerFactor,f0])

  useEffect(()=>{draw()},[draw])
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ro=new ResizeObserver(()=>draw());ro.observe(canvas.parentElement||canvas);return()=>ro.disconnect()
  },[draw])

  return (
    <div className="oscilloscope fft" style={{position:'relative',display:'flex',flexDirection:'column'}}>
      <canvas ref={canvasRef} style={{width:'100%',flex:1,display:'block',minHeight:0}}/>
      <div className="osc-legend">
        <span style={{color:'#42a5f5'}}>■ Fundamental (H1)</span>
        <span style={{color:'#ef5350'}}>■ Harmonics H2–H9</span>
        <span style={{color:'#ffa726'}}>--- IEEE 519 (5%)</span>
        {voltage>1
          ? <span style={{color:quality.color,fontWeight:700}}>THD: {thd.toFixed(1)}% — {quality.label.charAt(0)+quality.label.slice(1).toLowerCase()}</span>
          : <span style={{color:'#6a7f96'}}>Awaiting signal…</span>}
      </div>
      {voltage>1&&(
        <div style={{padding:'10px 14px',margin:'6px 0 0',background:'rgba(66,165,245,0.05)',
          border:'0.5px solid rgba(66,165,245,0.15)',borderRadius:8,fontSize:12,
          color:'rgba(180,210,240,0.85)',lineHeight:1.65}}>
          <span style={{color:'#90caf9',fontWeight:600}}>What this means: </span>
          H3 ({(bins.find(b=>b.n===3)?.mag*100).toFixed(1)}%) and H5 ({(bins.find(b=>b.n===5)?.mag*100).toFixed(1)}%) are odd harmonics typical of switch-mode loads.
          Estimated THD <strong style={{color:quality.color}}>{thd.toFixed(1)}%</strong>
          {thd<5?' — within IEEE 519 ≤5% limit.':thd<8?' — mild distortion; consider harmonic filters.':' — exceeds IEEE 519. Install passive filters.'}
        </div>
      )}
    </div>
  )
}

export default function Oscilloscope({data}){
  const canvasRef=useRef(null)
  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const {w:W,h:H}=getCanvasSize(canvas);if(W<10)return
    const dpr=window.devicePixelRatio||1;canvas.width=W*dpr;canvas.height=H*dpr
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr)
    ctx.fillStyle='#050a14';ctx.fillRect(0,0,W,H)
    if(data&&data.length>1){
      const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1
      ctx.strokeStyle='#42a5f5';ctx.lineWidth=2;ctx.shadowBlur=8;ctx.shadowColor='#42a5f5'
      ctx.beginPath();data.forEach((v,i)=>{const x=(i/(data.length-1))*W,y=H-((v-mn)/rng)*H*0.8-H*0.1;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});ctx.stroke()
    }
  },[data])
  useEffect(()=>{draw()},[draw])
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ro=new ResizeObserver(()=>draw());ro.observe(canvas.parentElement||canvas);return()=>ro.disconnect()
  },[draw])
  return <div className="oscilloscope"><canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}}/></div>
}
