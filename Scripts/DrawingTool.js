(() => {
  if (document.getElementById('__draw_overlay_container__')) {
    console.warn('Overlay already running.');
    return;
  }

  // ---------- Helpers ----------
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function hsvToRgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r=0,g=0,b=0;
    if (0 <= h && h < 60)      { r=c; g=x; b=0; }
    else if (60 <= h && h <120){ r=x; g=c; b=0; }
    else if (120<= h && h <180){ r=0; g=c; b=x; }
    else if (180<= h && h <240){ r=0; g=x; b=c; }
    else if (240<= h && h <300){ r=x; g=0; b=c; }
    else                       { r=c; g=0; b=x; }
    return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
  }
  function rgbToHex(r,g,b){
    return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  // ---------- Container & Shadow ----------
  const container = document.createElement('div');
  container.id = '__draw_overlay_container__';
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    pointerEvents: 'none'
  });
  document.documentElement.appendChild(container);
  const shadowHost = document.createElement('div');
  container.appendChild(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'open' });

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .ui, .toggle { pointer-events: auto; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
    .toggle {
      position: fixed; top: 12px; right: 12px;
      width: 40px; height: 40px; border-radius: 10px;
      background: #111; color: #fff; border: 1px solid #444;
      display: grid; place-items: center; cursor: pointer; user-select: none;
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
    }
    .panel {
      position: fixed; top: 60px; right: 12px; width: 280px;
      background: #1b1b1b; color: #eee; border: 1px solid #333; border-radius: 12px;
      padding: 12px; display: none; gap: 10px;
      box-shadow: 0 16px 40px rgba(0,0,0,.35);
    }
    .row { display: grid; gap: 8px; }
    .label { font-size: 12px; color: #bbb; }
    .slider { width: 100%; }
    .tools { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn {
      background: #2a2a2a; border: 1px solid #444; color: #eee;
      padding: 6px 10px; border-radius: 8px; cursor: pointer;
    }
    .btn.active { outline: 2px solid #6aa3ff; }
    .btn.danger { background: #3a1111; border-color: #772222; color: #ffb3b3; }
    .pickerRow { display: grid; grid-template-columns: 1fr 16px; gap: 8px; align-items: center; }
    .sv { width: 100%; height: 150px; border-radius: 8px; border: 1px solid #444; cursor: crosshair; position: relative; }
    .sv .knob {
      position: absolute; width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.5); transform: translate(-6px,-6px);
      pointer-events: none;
    }
    .hue { width: 16px; height: 150px; border-radius: 8px; border: 1px solid #444; cursor: ns-resize; position: relative; }
    .hue .bar { position: absolute; inset: 0; border-radius: 8px;
      background: linear-gradient(180deg,
        #f00 0%, #ff0 16.66%, #0f0 33.33%, #0ff 50%, #00f 66.66%, #f0f 83.33%, #f00 100%); }
    .hue .knob { position: absolute; left: -2px; right: -2px; height: 4px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.5); transform: translateY(-2px); }
    .swatch { height: 28px; border-radius: 6px; border: 1px solid #444; }
    .tip { font-size: 11px; color: #888; }
  `;
  shadow.appendChild(style);

  // ---------- Canvas ----------
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh',
    cursor: 'crosshair'
  });
  canvas.className = 'ui';
  canvas.id = '__draw_canvas__';
  canvas.style.pointerEvents = 'auto';
  shadow.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  function resizeCanvas(){
    dpr = window.devicePixelRatio || 1;
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    canvas.width = w; canvas.height = h;
    canvas.style.width = '100vw'; canvas.style.height = '100vh';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }
  resizeCanvas();
  const onResize = () => { const img = ctx.getImageData(0,0,canvas.width,canvas.height); resizeCanvas(); ctx.putImageData(img,0,0); };
  window.addEventListener('resize', onResize);

  // ---------- UI ----------
  const toggle = document.createElement('div');
  toggle.className = 'toggle ui';
  toggle.textContent = 'v';
  shadow.appendChild(toggle);

  const panel = document.createElement('div');
  panel.className = 'panel ui';
  shadow.appendChild(panel);

  // Color picker
  const pickerRow = document.createElement('div');
  pickerRow.className = 'pickerRow';
  const sv = document.createElement('div'); sv.className = 'sv';
  const svKnob = document.createElement('div'); svKnob.className = 'knob'; sv.appendChild(svKnob);
  const hue = document.createElement('div'); hue.className = 'hue';
  const hueBar = document.createElement('div'); hueBar.className = 'bar'; hue.appendChild(hueBar);
  const hueKnob = document.createElement('div'); hueKnob.className = 'knob'; hue.appendChild(hueKnob);
  pickerRow.appendChild(sv); pickerRow.appendChild(hue);

  const swatch = document.createElement('div'); swatch.className = 'swatch';

  const penRow = document.createElement('div'); penRow.className = 'row';
  const penLabel = document.createElement('div'); penLabel.className = 'label'; penLabel.textContent = 'Pen Size';
  const penSlider = document.createElement('input'); penSlider.type='range'; penSlider.min='1'; penSlider.max='80'; penSlider.value='8'; penSlider.className='slider';
  penRow.appendChild(penLabel); penRow.appendChild(penSlider);

  const toolsRow = document.createElement('div'); toolsRow.className = 'tools';
  const mkBtn = (txt) => { const b=document.createElement('button'); b.className='btn'; b.textContent=txt; return b; }
  const drawBtn = mkBtn('Draw');
  const eraseBtn = mkBtn('Eraser');
  const fillBtn = mkBtn('Fill');
  drawBtn.classList.add('active');
  toolsRow.append(drawBtn, eraseBtn, fillBtn);

  const tip = document.createElement('div'); tip.className='tip'; tip.textContent = 'Hold mouse to draw • Click to fill • Red X removes app';
  const kill = document.createElement('button'); kill.className='btn danger'; kill.textContent='✕ Remove';

  panel.append(pickerRow, swatch, penRow, toolsRow, tip, kill);

  // ---------- State ----------
  let hueDeg = 0;
  let sat = 1;
  let val = 1;
  let tool = 'draw';
  let isDown = false;
  let lastX = 0, lastY = 0;

  function updateSVBackground() {
    const [r,g,b] = hsvToRgb(hueDeg, 1, 1);
    sv.style.background = `
      linear-gradient(0deg, #000, rgba(0,0,0,0)),
      linear-gradient(90deg, #fff, rgb(${r},${g},${b}))
    `;
  }
  function updateHueUI(){
    hueKnob.style.top = `${(hueDeg/360) * hue.clientHeight}px`;
    updateSVBackground();
    updateSwatch();
  }
  function updateSVUI(){
    const x = sat * sv.clientWidth;
    const y = (1 - val) * sv.clientHeight;
    svKnob.style.left = `${x}px`;
    svKnob.style.top = `${y}px`;
  }
  function updateSwatch(){
    const [r,g,b] = hsvToRgb(hueDeg, sat, val);
    swatch.style.background = rgbToHex(r,g,b);
  }
  function currentColor(){
    const [r,g,b] = hsvToRgb(hueDeg, sat, val);
    return { r, g, b, hex: rgbToHex(r,g,b) };
  }

  const defer = () => requestAnimationFrame(() => { updateHueUI(); updateSVUI(); });
  defer();

  // ---------- Picker Events ----------
  function svEvent(e){
    const rect = sv.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    sat = x;
    val = 1 - y;
    updateSVUI();
    updateSwatch();
  }
  function hueEvent(e){
    const rect = hue.getBoundingClientRect();
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    hueDeg = clamp(360 * y, 0, 359.999); // fixed mapping
    updateHueUI();
  }
  let svDragging=false, hueDragging=false;
  sv.addEventListener('mousedown', e => { svDragging=true; svEvent(e); e.preventDefault(); });
  hue.addEventListener('mousedown', e => { hueDragging=true; hueEvent(e); e.preventDefault(); });
  shadow.addEventListener('mousemove', e => {
    if (svDragging) svEvent(e);
    if (hueDragging) hueEvent(e);
  });
  window.addEventListener('mouseup', () => { svDragging=false; hueDragging=false; });

  // ---------- Tool Buttons ----------
  function setTool(t){
    tool = t;
    [drawBtn, eraseBtn, fillBtn].forEach(b=>b.classList.remove('active'));
    ({draw:drawBtn, eraser:eraseBtn, fill:fillBtn}[t]||drawBtn).classList.add('active');
    canvas.style.cursor = (t==='fill') ? 'cell' : 'crosshair';
  }
  drawBtn.addEventListener('click', () => setTool('draw'));
  eraseBtn.addEventListener('click', () => setTool('eraser'));
  fillBtn.addEventListener('click', () => setTool('fill'));

  // ---------- Toggle Panel ----------
  let open = false;
  function updatePanel(){ panel.style.display = open ? 'grid' : 'none'; }
  toggle.addEventListener('click', (e) => { open = !open; updatePanel(); e.stopPropagation(); });
  updatePanel();

  // ---------- Drawing ----------
  function toCanvasXY(ev){
    const rect = canvas.getBoundingClientRect();
    return { x: (ev.clientX - rect.left) * dpr, y: (ev.clientY - rect.top) * dpr };
  }

  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    const {x,y} = toCanvasXY(ev);
    if (tool === 'fill') {
      floodFill(Math.round(x), Math.round(y), currentColor());
      return;
    }
    isDown = true;
    lastX = x; lastY = y;
    const size = parseInt(penSlider.value,10) * dpr;
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentColor().hex;
    }
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(lastX,lastY);
    ctx.lineTo(x,y);
    ctx.stroke();
  });

  canvas.addEventListener('mousemove', (ev) => {
    if (!isDown) return;
    const {x,y} = toCanvasXY(ev);
    ctx.lineTo(x,y);
    ctx.stroke();
    lastX = x; lastY = y;
  });

  window.addEventListener('mouseup', () => {
    if (isDown) { isDown = false; ctx.closePath(); }
  }, true);

  // ---------- Flood Fill ----------
  function floodFill(sx, sy, color) {
    const w = canvas.width, h = canvas.height;
    if (sx<0||sy<0||sx>=w||sy>=h) return;
    const img = ctx.getImageData(0,0,w,h);
    const data = img.data;
    const idx = (x,y)=> (y*w + x)*4;
    const target = {
      r: data[idx(sx,sy)], g: data[idx(sx,sy)+1], b: data[idx(sx,sy)+2], a: data[idx(sx,sy)+3]
    };
    const match = (i)=> data[i]===target.r && data[i+1]===target.g && data[i+2]===target.b && data[i+3]===target.a;
    const newRGBA = { r: color.r, g: color.g, b: color.b, a: 255 };
    if (target.r===newRGBA.r && target.g===newRGBA.g && target.b===newRGBA.b && target.a===newRGBA.a) return;

    const q = [];
    q.push([sx,sy]);
    let qh=0;
    while(qh<q.length){
      const [x,y]=q[qh++];
      let lx=x; while(lx>=0 && match(idx(lx,y))) lx--; lx++;
      let rx=x; while(rx<w && match(idx(rx,y))) rx++; rx--;
      for(let i=lx;i<=rx;i++){
        const di = idx(i,y);
        data[di]=newRGBA.r; data[di+1]=newRGBA.g; data[di+2]=newRGBA.b; data[di+3]=newRGBA.a;
        if (y>0 && match(idx(i,y-1))) q.push([i,y-1]);
        if (y<h-1 && match(idx(i,y+1))) q.push([i,y+1]);
      }
    }
    ctx.putImageData(img,0,0);
  }

  // ---------- Kill / Remove ----------
  function removeAll(){
    window.removeEventListener('resize', onResize);
    container.remove();
  }
  kill.addEventListener('click', () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    removeAll();
  });
})();
