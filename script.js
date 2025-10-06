 (e.code==="ArrowUp"||e.code==="KeyW") input.up=false;
    if (e.code==="ArrowDown"||e.code==="KeyS") input.down=false;
    if (e.code==="Space") input.fire=false;
  });

  // Touch stick
  let stickActive=false, stickStart={x:0,y:0};
  let stickVec={x:0,y:0};
  const getCenter = el => {
    const r=el.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2 };
  };
  const moveStick = (x,y) => {
    const base=getCenter(stickBase);
    const dx=x-base.x, dy=y-base.y;
    const len=Math.hypot(dx,dy);
    const max=40;
    const scale = len>max? max/len: 1;
    stick.style.left = `${37 + dx*scale}px`;
    stick.style.top  = `${37 + dy*scale}px`;
    stickVec.x = (dx/max);
    stickVec.y = (dy/max);
    stickVec.x = clamp(stickVec.x, -1, 1);
    stickVec.y = clamp(stickVec.y, -1, 1);
  };
  const resetStick = () => { stick.style.left="37px"; stick.style.top="37px"; stickVec.x=0; stickVec.y=0; };

  // Touch events
  stickBase.addEventListener("pointerdown", e => { stickActive=true; moveStick(e.clientX,e.clientY); stickBase.setPointerCapture(e.pointerId); });
  stickBase.addEventListener("pointermove", e => { if(stickActive) moveStick(e.clientX,e.clientY); });
  stickBase.addEventListener("pointerup",   e => { stickActive=false; resetStick(); });

  fireBtn.addEventListener("pointerdown", ()=> input.fire=true );
  fireBtn.addEventListener("pointerup",   ()=> input.fire=false);

  // ======== Audio ========
  class Sound {
    constructor(){ this.ctx=null; this.enabled=true; this.musicNodes=null; }
    ensure(){ if(!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }
    toggle(){ this.enabled=!this.enabled; if(!this.enabled) this.stopMusic(); }

    blip(freq=520, type="square", dur=0.06, gain=0.04){
      if(!this.enabled) return; this.ensure();
      const now=this.ctx.currentTime;
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=type; o.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now+dur);
      o.connect(g).connect(this.ctx.destination); o.start(now); o.stop(now+dur);
    }
    noise(dur=0.12,gain=0.06){
      if(!this.enabled) return; this.ensure();
      const now=this.ctx.currentTime;
      const buffer=this.ctx.createBuffer(1, this.ctx.sampleRate*dur, this.ctx.sampleRate);
      const data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++) data[i]= (Math.random()*2-1) * (1 - i/data.length);
      const src=this.ctx.createBufferSource(); src.buffer=buffer;
      const g=this.ctx.createGain(); g.gain.value=gain;
      src.connect(g).connect(this.ctx.destination); src.start(now);
    }
    // Tiny looping arpeggio
    playMusic(){
      if(!this.enabled) return; this.ensure(); this.stopMusic();
      const notes=[196, 246.94, 293.66, 329.63]; // G3, B3, D4, E4
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type="triangle"; g.gain.value=0.03; o.connect(g).connect(this.ctx.destination);
      o.start();
      let i=0;
      const step=()=> {
        if(!this.musicNodes) return;
        const t=this.ctx.currentTime;
        o.frequency.setValueAtTime(notes[i%notes.length], t);
        i++;
        this.musicNodes.timer = setTimeout(step, 220);
      };
      this.musicNodes={osc:o, gain:g, timer:null};
      step();
    }
    stopMusic(){
      if(this.musicNodes){
        if(this.musicNodes.timer) clearTimeout(this.musicNodes.timer);
        try{ this.musicNodes.osc.stop(); }catch{}
        this.musicNodes=null;
      }
    }
  }
  const sound = new Sound();

  // ======== Sprite Atlas (procedural) ========
  // We paint into offscreen canvases and reuse as images.
  const SPR = {};
  const makeCanvas = (w,h,draw) => {
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    const x=c.getContext("2d"); draw(x,w,h); return c;
  };
  // Player ship
  SPR.player = makeCanvas(48,48,(g,w,h)=>{
    g.translate(w/2,h/2);
    g.fillStyle="#a3ffb8"; g.beginPath();
    g.moveTo(0,-18); g.lineTo(16,16); g.lineTo(-16,16); g.closePath(); g.fill();
    g.fillStyle="#6ad1ff"; g.beginPath(); g.arc(0,-6,5,0,Math.PI*2); g.fill();
    g.fillStyle="rgba(106,209,255,0.6)"; g.fillRect(-3,14,6,10);
  });
  // Enemy drone
  SPR.drone = makeCanvas(40,32,(g,w,h)=>{
    g.translate(w/2,h/2);
    g.fillStyle="#6ad1ff"; g.beginPath(); g.ellipse(0,0,18,12,0,0,Math.PI*2); g.fill();
    g.fillStyle="#ffd86a"; g.beginPath(); g.arc(0,-2,4,0,Math.PI*2); g.fill();
  });
  // Enemy zigzag
  SPR.zigzag = makeCanvas(40,32,(g,w,h)=>{
    g.translate(w/2,h/2);
    g.fillStyle="#ff9c6a"; g.beginPath(); g.moveTo(-18,8); g.lineTo(0,-10); g.lineTo(18,8); g.closePath(); g.fill();
    g.fillStyle="#fff"; g.fillRect(-3,-2,6,4);
  });
  // Tank enemy
  SPR.tank = makeCanvas(48,36,(g,w,h)=>{
    g.translate(w/2,h/2);
    g.fillStyle="#ff6a6a"; g.fillRect(-20,-10,40,20);
    g.fillStyle="#222"; g.fillRect(-12,-4,24,8);
    g.fillStyle="#ffd86a"; g.fillRect(-3,-16,6,6);
  });
  // Boss
  SPR.boss = makeCanvas(160,90,(g,w,h)=>{
    g.translate(w/2,h/2);
    g.fillStyle="#b08cff"; g.fillRect(-70,-24,140,48);
    g.fillStyle="#fff"; g.fillRect(-18,-8,36,16);
    g.fillStyle="#ff6a6a"; g.fillRect(-8,-4,16,8);
    g.fillStyle="#6ad1ff"; g.fillRect(-80,-6,16,12);
    g.fillRect(64,-6,16,12);
  });
  // Bullet
  SPR.bullet = makeCanvas(6,14,(g,w,h)=>{
    g.fillStyle="#a3ffb8"; g.fillRect(1,0,4,14);
  });
  SPR.enemyBullet = makeCanvas(6,14,(g,w,h)=>{
    g.fillStyle="#ff6a6a"; g.fillRect(1,0,4,14);
  });
  // Powerups
  SPR.puRapid = makeCanvas(24,24,(g,w,h)=>{
    g.translate(12,12); g.fillStyle="#ffd86a"; g.beginPath();
    g.moveTo(-10,0); g.lineTo(0,-10); g.lineTo(10,0); g.lineTo(0,10); g.closePath(); g.fill();
  });
  SPR.puShield = makeCanvas(24,24,(g,w,h)=>{
    g.translate(12,12); g.fillStyle="#a3ffb8"; g.beginPath();
    g.arc(0,0,10,Math.PI*0.2,Math.PI*0.8); g.lineTo(0,10); g.closePath(); g.fill();
  });
  SPR.puLife = makeCanvas(24,24,(g,w,h)=>{
    g.translate(12,12); g.fillStyle="#ff9c6a"; g.beginPath();
    g.moveTo(0,8); g.bezierCurveTo(18,-6, -6,-10, 0,4); g.bezierCurveTo(6,-10, -18,-6, 0,8); g.fill();
  });
  // Explosion particle
  SPR.spark = makeCanvas(3,3,(g)=>{ g.fillStyle="#fff"; g.fillRect(0,0,3,3); });

  // ======== Entities ========
  class Particle {
    constructor(x,y,vx,vy,life,col){ Object.assign(this,{x,y,vx,vy,life,max:life,col}); }
    update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.life-=dt; }
    draw(){ const a=Math.max(0, this.life/this.max); ctx.globalAlpha=a; ctx.drawImage(SPR.spark,this.x,this.y); ctx.globalAlpha=1; }
    get alive(){ return this.life>0; }
  }

  class Bullet {
    constructor(x,y,vy=-680, enemy=false){ Object.assign(this,{x,y,vy,enemy,r:3,dead:false}); }
    update(dt){ this.y += this.vy*dt; if(this.y<-20||this.y>H+20) this.dead=true; }
    draw(){ ctx.drawImage(this.enemy?SPR.enemyBullet:SPR.bullet, this.x-3, this.y-7); }
  }

  const T = { DRONE:0, ZIGZAG:1, TANK:2, BOSS:3 };

  class Enemy {
    constructor(x,y,type=T.DRONE, level=1){
      Object.assign(this,{x,y,type});
      this.sprite = [SPR.drone, SPR.zigzag, SPR.tank, SPR.boss][type];
      this.r = type===T.BOSS ? 60 : (type===T.TANK?22:16);
      this.hp = type===T.BOSS ? 200+level*30 : (type===T.TANK ? 12+level*2 : 3+Math.floor(level/2));
      this.dead=false; this.t=0; this.cool=1.2;
      this.speed = (type===T.ZIGZAG?70:40) + level*6;
    }
    update(dt, level, bulletsArr){
      this.t += dt;
      if(this.type===T.DRONE) this.y += (this.speed)*dt;
      if(this.type===T.ZIGZAG){ this.y += this.speed*dt; this.x += Math.sin(this.t*4)*120*dt; }
      if(this.type===T.TANK)  this.y += this.speed*0.6*dt;
      if(this.type===T.BOSS){ this.y = 90; this.x = clamp( W/2 + Math.sin(this.t*0.8)*W*0.28 , 90, W-90 ); }

      // Shooting
      this.cool -= dt;
      if(this.cool<=0){
        if(this.type===T.BOSS){
          bulletsArr.push(new Bullet(this.x-30, this.y+46, 280, true));
          bulletsArr.push(new Bullet(this.x,     this.y+46, 320, true));
          bulletsArr.push(new Bullet(this.x+30, this.y+46, 280, true));
          this.cool = 0.4;
        } else if(this.type!==T.ZIGZAG) {
          bulletsArr.push(new Bullet(this.x, this.y+18, 260, true));
          this.cool = 1.1 - Math.min(0.7, level*0.05);
        } else {
          this.cool = 0.9;
        }
      }

      if(this.y>H+40) this.dead=true;
    }
    draw(){ const s=this.sprite; ctx.drawImage(s, this.x - s.width/2, this.y - s.height/2); }
    hit(d=1){ this.hp-=d; if(this.hp<=0) this.dead=true; }
  }

  class PowerUp {
    constructor(x,y,kind){ Object.assign(this,{x,y,kind}); this.t=0; this.dead=false; this.r=10; }
    update(dt){ this.t+=dt; this.y+=70*dt; if(this.y>H+24) this.dead=true; }
    draw(){
      const s = this.kind==="Rapid" ? SPR.puRapid : this.kind==="Shield" ? SPR.puShield : SPR.puLife;
      ctx.drawImage(s, this.x-12, this.y-12);
    }
  }

  class Player {
    constructor(){
      this.x=W/2; this.y=H-70; this.vx=0; this.vy=0; this.r=16;
      this.cool=0; this.rapid=0; this.shield=0; this.invuln=0; this.lives=3;
      this.puffs=[];
    }
    reset(){ this.x=W/2; this.y=H-70; this.vx=this.vy=0; this.invuln=1.2; }
    update(dt, bulletsArr){
      // Keyboard + touch
      const ax = (input.right?1:0)-(input.left?1:0) + stickVec.x;
      const ay = (input.down?1:0)-(input.up?1:0)  + stickVec.y;
      const accel=540;
      this.vx += clamp(ax,-1,1) * accel*dt;
      this.vy += clamp(ay,-1,1) * accel*dt;
      // Drag
      this.vx *= 0.86; this.vy *= 0.86;
      this.x += this.vx*dt; this.y += this.vy*dt;
      this.x = clamp(this.x, 22, W-22);
      this.y = clamp(this.y, 22, H-22);

      // Thrust puffs
      if(Math.abs(this.vx)+Math.abs(this.vy)>20){
        this.puffs.push(new Particle(this.x+rnd(-3,3), this.y+20, rnd(-40,40), rnd(100,160), rnd(0.2,0.5), "#6ad1ff"));
      }
      this.puffs = this.puffs.filter(p=>p.alive); this.puffs.forEach(p=>p.update(dt));

      // Fire
      this.cool -= dt;
      const interval = this.rapid>0 ? 0.09 : 0.22;
      if((input.fire) && this.cool<=0){
        this.cool = interval;
        bulletsArr.push( new Bullet(this.x, this.y-18, this.rapid>0? -760:-640, false) );
        sound.blip(this.rapid>0?760:560,"square",0.04,0.04);
      }

      if(this.rapid>0) this.rapid-=dt;
      if(this.shield>0) this.shield-=dt;
      if(this.invuln>0) this.invuln-=dt;
    }
    draw(){
      if(this.invuln>0 && Math.floor(this.invuln*16)%2===0) ctx.globalAlpha=0.4;
      ctx.drawImage(SPR.player, this.x-24, this.y-24);
      if(this.shield>0){ ctx.strokeStyle="rgba(163,255,184,.8)"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(this.x,this.y,22,0,Math.PI*2); ctx.stroke(); }
      ctx.globalAlpha=1;
      this.puffs.forEach(p=>p.draw());
    }
  }

  // ======== Game ========
  const state = {
    running:false, paused:false, gameOver:false,
    level:1, score:0, powerText:"—",
    bullets:[], eBullets:[], enemies:[], powerups:[], parts:[], stars:[],
    spawnT:0, powerT:6, boss:null, last:0
  };

  // Stars
  class Star{
    constructor(d){ this.x=rnd(0,W); this.y=rnd(0,H); this.d=d; this.speed=10+d*35; this.size=0.7+d*1.4; }
    update(dt){ this.y+=this.speed*dt; if(this.y>H){ this.y=-2; this.x=rnd(0,W);} }
    draw(){ ctx.fillStyle="#9fb2ff"; ctx.fillRect(this.x,this.y,this.size,this.size); }
  }

  const player = new Player();

  // UI helpers
  const showOverlay = (t,m,btn="Start") => { ovTitle.textContent=t; ovMsg.textContent=m; ovBtn.textContent=btn; overlay.classList.remove("hidden"); };
  const hideOverlay = () => overlay.classList.add("hidden");
  const updateHUD = () => {
    elScore.textContent = Math.floor(state.score);
    elLives.textContent = player.lives;
    elLevel.textContent = state.level;
    elPower.textContent = player.shield>0 ? "Shield" : (player.rapid>0 ? "Rapid" : "—");
    if (state.score>highScore){ highScore=Math.floor(state.score); elHigh.textContent=highScore; localStorage.setItem(HS_KEY, String(highScore)); }
  };

  // Game flow
  const start = () => {
    if(state.gameOver) reset();
    state.running=true; state.paused=false; player.reset(); hideOverlay();
    sound.playMusic();
  };
  const reset = () => {
    Object.assign(state,{ running:false, paused:false, gameOver:false, level:1, score:0, powerText:"—",
      bullets:[], eBullets:[], enemies:[], powerups:[], parts:[], spawnT:0, powerT:6, boss:null
    });
    player.lives=3; player.invuln=0;
  };
  const gameOver = () => {
    state.running=false; state.paused=false; state.gameOver=true;
    sound.stopMusic();
    showOverlay("Game Over", `Final score: ${Math.floor(state.score)}  —  High: ${highScore}`, "Play Again");
  };

  // Spawning
  const spawnEnemy = () => {
    const r=Math.random(); let type=T.DRONE;
    if(state.level>2 && r>0.6) type=T.ZIGZAG;
    if(state.level>5 && r>0.82) type=T.TANK;
    state.enemies.push(new Enemy(rnd(36,W-36), -30, type, state.level));
  };
  const spawnPower = () => {
    const kind = Math.random()<0.5 ? "Rapid" : (Math.random()<0.5 ? "Shield":"Life");
    state.powerups.push(new PowerUp(rnd(40,W-40), -12, kind));
  };

  // Collision (circle-circle approximations)
  const collide = (a,b) => {
    const dx=a.x-b.x, dy=a.y-b.y, rr=(a.r||10)+(b.r||10); return dx*dx+dy*dy<=rr*rr;
  };

  // Buttons
  btnStart.onclick = start;
  btnRestart.onclick = ()=>{ reset(); start(); };
  btnPause.onclick = ()=>{ if(!state.running) return; state.paused=!state.paused; if(state.paused) showOverlay("Paused","Press Resume to continue","Resume"); else hideOverlay(); };
  btnMute.onclick = ()=>{ sound.toggle(); btnMute.textContent = sound.enabled?"Mute":"Unmute"; };

  ovBtn.onclick = ()=>{ if(!state.running) start(); };

  // Initial stars
  state.stars=[...Array.from({length:70},()=>new Star(0.3)), ...Array.from({length:45},()=>new Star(0.7)), ...Array.from({length:25},()=>new Star(1.0))];

  // Main loop
  const loop = (t) => {
    if(!state.last) state.last=t; let dt=(t-state.last)/1000; state.last=t; dt=Math.min(dt,0.033);

    if(input.pause){ btnPause.click(); input.pause=false; }
    if(input.mute){ btnMute.click(); input.mute=false; }

    if(state.running && !state.paused && !state.gameOver){
      // Update
      player.update(dt, state.bullets);
      state.bullets.forEach(b=>b.update(dt));
      state.eBullets.forEach(b=>b.update(dt));
      state.enemies.forEach(e=>e.update(dt, state.level, state.eBullets));
      state.powerups.forEach(p=>p.update(dt));
      state.parts.forEach(p=>p.update(dt));
      state.stars.forEach(s=>s.update(dt));

      // Spawns
      state.spawnT -= dt; if(state.spawnT<=0){ state.spawnT = Math.max(0.28, 1.1 - state.level*0.06); spawnEnemy(); }
      state.powerT -= dt; if(state.powerT<=0){ state.powerT=rnd(8,14); spawnPower(); }

      // Boss on milestones
      if(!state.boss && state.level>0 && Math.floor(state.score/300) >= state.level){
        state.boss = new Enemy(W/2, 90, T.BOSS, state.level);
        state.enemies.push(state.boss);
        state.level++;
      }

      // Collisions: bullets vs enemies
      for(const e of state.enemies){
        for(const b of state.bullets){
          if(!b.dead && !e.dead && collide({x:e.x,y:e.y,r:e.r},{x:b.x,y:b.y,r:4})){
            b.dead=true; e.hit(); state.score += (e.type===T.BOSS? 1: 10);
            state.parts.push(new Particle(e.x,e.y, rnd(-120,120), rnd(-60,60), rnd(0.25,0.6), "#ffd86a"));
            sound.blip(240,"sawtooth",0.05,0.05);
          }
        }
      }

      // Player vs powerups
      for(const p of state.powerups){
        if(!p.dead && collide({x:player.x,y:player.y,r:18},{x:p.x,y:p.y,r:12})){
          p.dead=true; if(p.kind==="Rapid") player.rapid=Math.max(player.rapid,8);
          if(p.kind==="Shield") player.shield=Math.max(player.shield,8);
          if(p.kind==="Life") player.lives=Math.min(5, player.lives+1);
          sound.blip(980,"triangle",0.08,0.06);
        }
      }

      // Enemy bullets vs player
      for(const eb of state.eBullets){
        if(!eb.dead && collide({x:player.x,y:player.y,r:16},{x:eb.x,y:eb.y,r:5})){
          eb.dead=true;
          if(player.shield>0 || player.invuln>0){
            state.parts.push(new Particle(eb.x,eb.y, rnd(-140,140), rnd(-140,140), 0.2, "#6ad1ff"));
            sound.blip(420,"sawtooth",0.04,0.04);
          } else {
            player.lives--; player.invuln=1.2; sound.noise(0.12,0.08);
            state.parts.push(new Particle(player.x,player.y, rnd(-160,160), rnd(-80,80), 0.5, "#ff6a6a"));
            if(player.lives<=0) gameOver();
          }
        }
      }

      // Enemies vs player
      for(const e of state.enemies){
        if(!e.dead && collide({x:player.x,y:player.y,r:16},{x:e.x,y:e.y,r:e.r})){
          e.dead=true; state.parts.push(new Particle(e.x,e.y, rnd(-160,160), rnd(-80,80), 0.5, "#ff9c6a"));
          if(player.shield>0 || player.invuln>0){
            state.score += 5; sound.blip(360,"sawtooth",0.05,0.05);
          } else {
            player.lives--; player.invuln=1.2; sound.noise(0.12,0.08);
            if(player.lives<=0) gameOver();
          }
        }
      }

      // Level pacing bonus
      if(state.boss && state.boss.dead){ state.boss=null; state.score+=300; sound.blip(660,"triangle",0.12,0.06); }

      // Cleanup
      state.enemies = state.enemies.filter(e=>!e.dead);
      state.bullets = state.bullets.filter(b=>!b.dead);
      state.eBullets = state.eBullets.filter(b=>!b.dead);
      state.parts   = state.parts.filter(p=>p.alive);
      state.powerups= state.powerups.filter(p=>!p.dead);

      updateHUD();
    }

    // Draw
    ctx.clearRect(0,0,W,H);
    // Nebula glow
    const grd=ctx.createRadialGradient(W/2,H/2,60, W/2,H/2,640);
    grd.addColorStop(0,"rgba(30,42,84,.06)"); grd.addColorStop(1,"transparent");
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);

    state.stars.forEach(s=>s.draw());
    player.draw();
    state.bullets.forEach(b=>b.draw());
    state.eBullets.forEach(b=>b.draw());
    state.enemies.forEach(e=>e.draw());
    state.powerups.forEach(p=>p.draw());
    state.parts.forEach(p=>p.draw());

    requestAnimationFrame(loop);
  };

  // Boot
  showOverlay("Space Shooter", "Move: WASD/Arrows or left stick • Fire: Space or FIRE button • P: Pause • M: Mute");
  requestAnimationFrame(loop);
})();
