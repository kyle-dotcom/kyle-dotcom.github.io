const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});



let fps = 0;
let lastFrameTime = Date.now();
let playerSpawnTime = 0;
let hasWon = false;
let killFeed = [];
let safeZone = null; 
let decayZones = [];
let currentZoom = 1;



const WORLD_SIZE = 3000;
const NUM_AI = 15;
const FOOD_COUNT = 225;
const FOOD_RESPAWN_TIME = 3000;




class Blob {
constructor(x, y, radius, color, isAI = false) {
  this.x = x;
  this.y = y;
  this.radius = radius;
  this.color = color;
  this.isAI = isAI;
  this.dx = 0;
  this.dy = 0;
  this.speedBoostEnd = 0;
  this.shieldEnd = 0;
  this.magnetEnd = 0;
  this.trapEnd = 0;
  this.aggressive = false;
  this.nextMoodSwitch = Date.now() + Math.random() * 4000 + 3000;
}

canEat(target) {
    return this.radius * this.radius > target.radius * target.radius * 1.1;
  }

  tryEat(target) {
    if (this.hasShield || target.hasShield) return false;
    if (!this.canEat(target)) return false;
    if (isInSafeZone(this) || isInSafeZone(target)) return false;
  
    const dx = this.x - target.x;
    const dy = this.y - target.y;
    const dist = Math.hypot(dx, dy);
  
    if (dist < this.radius + target.radius) {
      this.radius = Math.sqrt(this.radius * this.radius + target.radius * target.radius);
      return true;
    }
  
    return false;
  }
  
  

get hasShield() {
    return Date.now() < this.shieldEnd;
  }
  


get isTrapped() {
  return Date.now() < this.trapEnd;
}

get speed() {
    const base = Math.max(0.5, 8 / this.radius);
    return Date.now() < this.speedBoostEnd ? base * 1.5 : base;
  }
  
get hasMagnet() {
    return Date.now() < this.magnetEnd;
  }
 

  moveToward(targetX, targetY) {
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.dx = Math.cos(angle) * this.speed;
    this.dy = Math.sin(angle) * this.speed;
  }

  updateMood(blobs) {
    if (Date.now() > this.nextMoodSwitch) {
      const nearby = blobs.filter(b => b !== this && this.canEat(b));
      this.aggressive = nearby.length > 0 && Math.random() < 0.3;
      this.nextMoodSwitch = Date.now() + Math.random() * 4000 + 3000;
    }
  }

  update() {
    this.x += this.dx;
    this.y += this.dy;
    this.x = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.y));
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  
    
    ctx.fillStyle = 'black';
    ctx.font = `${this.radius / 1.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(this.radius * this.radius), this.x, this.y);
  
    
    if (this.name) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.name, this.x, this.y - this.radius - 4);
    }
    if (this.hasShield) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(66, 165, 245, 0.7)'; 
        ctx.lineWidth = 4;
        ctx.shadowColor = '#42a5f5';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }
      if (this.hasMagnet) {
        const pulse = Math.sin(Date.now() / 200) * 2 + 6; 
      
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#66ff66';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.shadowColor = '#66ff66';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      }
      if (this.isTrapped) {
        const pulse = Math.sin(Date.now() / 200) * 2 + 6;
      
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#c77dff';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.shadowColor = '#c77dff';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      }
        
  }
}  




let player;
let enemies;
let foodList = [];
let isGameOver = false;
let particles = [];


function spawnFood(x, y) {
    const roll = Math.random();
    let radius = 2;
    let color = 'white';
  
    if (roll < 0.1) {
      radius = 7;     
      color = '#ff5c5c'; 
    } else if (roll < 0.3) {
      radius = 5;      
      color = '#5caeff'; 
    }
  
    const f = new Blob(x, y, radius, color);
    foodList.push(f);
  
    setTimeout(() => {
      if (!foodList.includes(f)) foodList.push(f);
    }, FOOD_RESPAWN_TIME);
  }
  
function spawnFoodCluster() {
const cx = Math.random() * WORLD_SIZE;
const cy = Math.random() * WORLD_SIZE;
const count = 10 + Math.floor(Math.random() * 10);
  
for (let i = 0; i < count; i++) {
    const offsetX = (Math.random() - 0.5) * 100;
    const offsetY = (Math.random() - 0.5) * 100;
    spawnFood(cx + offsetX, cy + offsetY);
}
}


function spawnSpeedBlob() {
    const blob = new Blob(
      Math.random() * WORLD_SIZE,
      Math.random() * WORLD_SIZE,
      10,
      '#ffd700' 
    );
    blob.isSpeedBlob = true;
    foodList.push(blob);
  }
  
  function addKillFeed(killerName, victimName, killerSize, victimSize) {
    killFeed.push({
      text: `${killerName} (${killerSize}) devoured ${victimName} (${victimSize})`,
      time: Date.now()
    });
  
    if (killFeed.length > 5) {
      killFeed.shift(); 
    }
  }
  
  function spawnShieldBlob() {
    const shield = new Blob(
      Math.random() * WORLD_SIZE,
      Math.random() * WORLD_SIZE,
      15,
      '#42a5f5' 
    );
    shield.isShieldBlob = true;
    foodList.push(shield);
  }
  
  function spawnMagnetBlob() {
    const magnet = new Blob(
      Math.random() * WORLD_SIZE,
      Math.random() * WORLD_SIZE,
      15,
      '#66ff66'
    );
    magnet.isMagnetBlob = true;
    foodList.push(magnet);
  }
  
  function spawnSafeZone() {
    safeZone = {
      x: Math.random() * (WORLD_SIZE - 600) + 300,
      y: Math.random() * (WORLD_SIZE - 600) + 300,
      radius: 250,
      expiresAt: Date.now() + 15000 
    };
  }
  
  function spawnTrapBlob() {
    const trap = new Blob(
      Math.random() * WORLD_SIZE,
      Math.random() * WORLD_SIZE,
      15,
      '#c77dff' 
    );
    trap.isTrapBlob = true;
    foodList.push(trap);
  }
  
  function isInsideZone(blob, zone) {
    const dx = blob.x - zone.x;
    const dy = blob.y - zone.y;
    return Math.hypot(dx, dy) <= zone.radius;
  }
  
  
  function isInSafeZone(blob) {
    if (!safeZone) return false;
    const dx = blob.x - safeZone.x;
    const dy = blob.y - safeZone.y;
    return Math.hypot(dx, dy) <= safeZone.radius;
  }
  
  function spawnDecayZone() {
    const zone = {
      x: Math.random() * (WORLD_SIZE - 600) + 300,
      y: Math.random() * (WORLD_SIZE - 600) + 300,
      radius: 250,
      expiresAt: Date.now() + 15000 
    };
    decayZones.push(zone);
  }
  
  

function populateFood() {
  foodList = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    spawnFood(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE);
  }
}

function maintainFood() {
    const missing = FOOD_COUNT - foodList.length;
    for (let i = 0; i < missing; i++) {
      spawnFood(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE);
    }
}


function spawnSpeedParticles(blob) {
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 1 + 0.5;
    particles.push({
      x: blob.x + Math.cos(angle) * blob.radius,
      y: blob.y + Math.sin(angle) * blob.radius,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 30,
      color: 'gold'
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.life-- > 0);
  for (let p of particles) {
    p.x += p.dx;
    p.y += p.dy;
  }
}

function drawParticles() {
  for (let p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
}

function generateName() {
    const names = [
        
        'Alex', 'Jamie', 'Morgan', 'Taylor', 'Riley', 'Jordan', 'Casey', 'Sam', 'Avery', 'Skyler',
        'Liam', 'Noah', 'Emma', 'Olivia', 'Ethan', 'Mia', 'Zoe', 'Leo', 'Aria', 'Ella',
      
       
        'Shadow', 'Ghost', 'Viper', 'Blaze', 'Frost', 'Venom', 'Clutch', 'Sn1per', 'N1ght', 'Raider',
        'Hex', 'Nova', 'Zerk', 'Dash', 'Zero', 'Loop', 'Pyro', 'Rex', 'Glitch', 'Cr1t',
      
        
        'DarkWolf', 'BlueFox', 'PixelTaco', 'SilentStorm', 'TwitchKid', 'CoffeeLover', 'SleepyJoe',
        'IceCreamMan', 'CyberSam', 'BunnyHop', 'PewZ', 'SnaccPack', 'TryHarder', 'N00bz', 'LagSpikes'
      ];
      
    return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
  }
  



  function respawnAI() {
    const newAI = new Blob(
      Math.random() * WORLD_SIZE,
      Math.random() * WORLD_SIZE,
      10,
      'red',
      true
    );
    newAI.name = generateName(); // ✅ this works
    enemies.push(newAI);
  }
  



  function createGameObjects() {
    player = new Blob(1500, 1500, 10, 'lime');
    player.name = 'You';
    playerSpawnTime = Date.now();

  
    enemies = Array.from({ length: NUM_AI }, () => {
      const ai = new Blob(
        Math.random() * WORLD_SIZE,
        Math.random() * WORLD_SIZE,
        10,
        'red',
        true
      );
      ai.name = generateName();
      return ai;
    });
  
    populateFood();
  }
  
function drawFood() {
  for (let f of foodList) f.draw();
}


  


function playerControl() {
  const angle = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
  player.dx = Math.cos(angle) * player.speed;
  player.dy = Math.sin(angle) * player.speed;
}

function aiLogic() {
    for (let ai of enemies) {
      ai.updateMood([...enemies, player]);
  
      let target = null;
  
      if (ai.aggressive && !isInSafeZone(ai)) {
        const options = [...enemies, player].filter(b =>
          b !== ai &&
          ai.canEat(b) &&
          !isInSafeZone(b) 
        );
  
        let minDist = Infinity;
        for (let other of options) {
          const dist = Math.hypot(other.x - ai.x, other.y - ai.y);
          if (dist < minDist) {
            minDist = dist;
            target = other;
          }
        }
      }
  
      if (target) {
        ai.moveToward(target.x, target.y);
      } else {
        let closestFood = null;
        let minDist = Infinity;
        for (let f of foodList) {
          const d = Math.hypot(f.x - ai.x, f.y - ai.y);
          if (d < minDist) {
            minDist = d;
            closestFood = f;
          }
        }
        if (closestFood) ai.moveToward(closestFood.x, closestFood.y);
      }
    }
  }
  

function update() {
    if (isGameOver || hasWon) return;
  
    playerControl();
    aiLogic();
  
    player.update();
    if (Date.now() < player.speedBoostEnd) {
      spawnSpeedParticles(player);
    }
    
    decayZones.forEach(zone => {
        if (isInsideZone(player, zone)) {
          player.radius *= 0.9985;
        }
      });
      
      enemies.forEach(ai => {
        decayZones.forEach(zone => {
          if (isInsideZone(ai, zone)) {
            ai.radius *= 0.9985;
          }
        });
      });
      
    enemies.forEach(ai => {
      ai.update();
      if (Date.now() < ai.speedBoostEnd) {
        spawnSpeedParticles(ai);
      }
    });
  
    
    if (player.hasMagnet) attractNearbyFood(player);
    enemies.forEach(ai => {
      if (ai.hasMagnet) attractNearbyFood(ai);
    });
  
    
    if (player.isTrapped) {
      player.radius *= 0.9985;
    }
    enemies.forEach(ai => {
      if (ai.isTrapped) {
        ai.radius *= 0.9985;
      }
    });
  
    updateParticles();
  
    foodList = foodList.filter(f => {
      // Speed Blob
      if (f.isSpeedBlob) {
        const distToPlayer = Math.hypot(f.x - player.x, f.y - player.y);
        if (distToPlayer < f.radius + player.radius) {
          player.speedBoostEnd = Date.now() + 10000;
          return false;
        }
  
        for (let ai of enemies) {
          const distToAI = Math.hypot(f.x - ai.x, f.y - ai.y);
          if (distToAI < f.radius + ai.radius) {
            ai.speedBoostEnd = Date.now() + 10000;
            return false;
          }
        }
  
        return true;
      }
  
      
      if (f.isShieldBlob) {
        const distToPlayer = Math.hypot(f.x - player.x, f.y - player.y);
        if (distToPlayer < f.radius + player.radius) {
          player.shieldEnd = Date.now() + 5000;
          return false;
        }
  
        for (let ai of enemies) {
          const distToAI = Math.hypot(f.x - ai.x, f.y - ai.y);
          if (distToAI < f.radius + ai.radius) {
            ai.shieldEnd = Date.now() + 5000;
            return false;
          }
        }
  
        return true;
      }
  
      
      if (f.isMagnetBlob) {
        const distToPlayer = Math.hypot(f.x - player.x, f.y - player.y);
        if (distToPlayer < f.radius + player.radius) {
          player.magnetEnd = Date.now() + 8000;
          return false;
        }
  
        for (let ai of enemies) {
          const distToAI = Math.hypot(f.x - ai.x, f.y - ai.y);
          if (distToAI < f.radius + ai.radius) {
            ai.magnetEnd = Date.now() + 8000;
            return false;
          }
        }
  
        return true;
      }
  
     
      if (f.isTrapBlob) {
        const distToPlayer = Math.hypot(f.x - player.x, f.y - player.y);
        if (distToPlayer < f.radius + player.radius) {
          player.trapEnd = Date.now() + 5000;
          return false;
        }
  
        for (let ai of enemies) {
          const distToAI = Math.hypot(f.x - ai.x, f.y - ai.y);
          if (distToAI < f.radius + ai.radius) {
            ai.trapEnd = Date.now() + 5000;
            return false;
          }
        }
  
        return true;
      }
  
    
      if (player.tryEat(f)) return false;
      for (let ai of enemies) {
        if (ai.tryEat(f)) return false;
      }
      return true;
    });
  
    
    enemies = enemies.filter((ai, i) => {
        for (let other of enemies) {
          if (other !== ai && other.tryEat(ai)) {
            addKillFeed(
              other.name || '???',
              ai.name || '???',
              Math.floor(other.radius * other.radius),
              Math.floor(ai.radius * ai.radius)
            );
            setTimeout(respawnAI, 3000); // 3s respawn
            return false;
          }
        }
        return true;
      });
      
  
   
    enemies = enemies.filter(ai => {
        if (player.tryEat(ai)) {
          addKillFeed(
            player.name,
            ai.name || '???',
            Math.floor(player.radius * player.radius),
            Math.floor(ai.radius * ai.radius)
          );
          setTimeout(respawnAI, 3000); // respawn after 3s
          return false;
        }
        return true;
      });
      
 
    for (let ai of enemies) {
      if (Date.now() - playerSpawnTime > 5000 && ai.tryEat(player)) {
        addKillFeed(
          ai.name || '???',
          player.name,
          Math.floor(ai.radius * ai.radius),
          Math.floor(player.radius * player.radius)
        );
        isGameOver = true;
      }
    }
  
  
    if (enemies.length === 0) {
      hasWon = true;
    }
    if (safeZone && Date.now() > safeZone.expiresAt) {
        safeZone = null;
      }
    decayZones = decayZones.filter(zone => Date.now() < zone.expiresAt);
  
  }
  
  
  
  
  function attractNearbyFood(blob) {
    for (let food of foodList) {
      const dx = blob.x - food.x;
      const dy = blob.y - food.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 500 && dist > 1) {
        const pullStrength = 1.5; 
        food.x += dx / dist * pullStrength;
        food.y += dy / dist * pullStrength;
      }
    }
  }
  
  
  
  

  function drawUI() {
    ctx.fillStyle = 'white';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Size: ${Math.floor(player.radius * player.radius)}`, 20, 30);
  
    

if (Date.now() < player.speedBoostEnd) {
    const timeLeft = (player.speedBoostEnd - Date.now()) / 10000;
    ctx.fillStyle = 'gold';
    ctx.fillRect(20, 40, 100 * timeLeft, 10);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(20, 40, 100, 10);
  
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText('Speed', 125, 48);
  }
  

  if (player.hasShield) {
    const timeLeft = (player.shieldEnd - Date.now()) / 5000;
    ctx.fillStyle = '#42a5f5';
    ctx.fillRect(20, 55, 100 * timeLeft, 10);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(20, 55, 100, 10);
  
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText('Shield', 125, 63);
  }
  

  if (player.hasMagnet) {
    const timeLeft = (player.magnetEnd - Date.now()) / 8000;
    ctx.fillStyle = '#66ff66';
    ctx.fillRect(20, 70, 100 * timeLeft, 10);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(20, 70, 100, 10);
  
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText('Magnet', 125, 78);
  }

    if (player.isTrapped) {
        const timeLeft = (player.trapEnd - Date.now()) / 5000;
        ctx.fillStyle = '#c77dff'; // purple
        ctx.fillRect(20, 85, 100 * timeLeft, 10);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(20, 85, 100, 10);
    
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'white';
        ctx.fillText('Trap', 125, 93);
    }
    if (isInSafeZone(player)) {
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#66ff66';
        ctx.fillText('SAFE ZONE ACTIVE', 20, 110);
      }
      
  
      

    const mapWidth = 200;
    const mapHeight = 200;
    const margin = 20;
    const mapX = canvas.width - mapWidth - margin;
    const mapY = canvas.height - mapHeight - margin;

    ctx.fillStyle = 'white';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${fps}`, mapX, mapY - 10);

  
    
    drawLeaderboard();
  }
  
  function drawKillFeed() {
    const entryHeight = 28;
    const padding = 16;
    const width = 380;
    const height = 6 * entryHeight + padding * 2; 
  
    const x = 20;
    const y = canvas.height - height - 20;
  
    
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();
    ctx.restore();
  
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Kill Feed', x + padding, y + padding);
  
    
    ctx.font = '14px sans-serif';
    for (let i = 0; i < killFeed.length; i++) {
      const entry = killFeed[i];
      ctx.fillStyle = 'white';
      ctx.fillText(entry.text, x + padding, y + padding + (i + 2) * entryHeight - 6);
    }
  }
  
  

  function drawLeaderboard() {
    const all = [...enemies, player];
    all.sort((a, b) => b.radius * b.radius - a.radius * a.radius);
  
    const maxEntries = 10;
    const padding = 16;
    const lineHeight = 24;
    const width = 240;
    const height = (maxEntries + 1) * lineHeight + padding;
  
    const startX = canvas.width - width - 30;
    const startY = 30;
  
    
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
  
    
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.roundRect(startX, startY, width, height, 10);
    ctx.fill();
    ctx.restore();
  
    
    const gradient = ctx.createLinearGradient(startX, startY, startX + width, startY);
    gradient.addColorStop(0, '#4caf50');
    gradient.addColorStop(1, '#2e7d32');
    ctx.fillStyle = gradient;
    ctx.fillRect(startX, startY, width, lineHeight);
  
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Leaderboard', startX + width / 2, startY + lineHeight / 2);
  
    
    ctx.textAlign = 'left';
    ctx.font = '14px sans-serif';
    for (let i = 0; i < Math.min(maxEntries, all.length); i++) {
      const b = all[i];
      const name = b.name || '???';
      const size = Math.floor(b.radius * b.radius);
      const y = startY + lineHeight * (i + 1.5);
  
      ctx.fillStyle = b === player ? '#a5d6a7' : 'white';
      ctx.fillText(`${i + 1}. ${name}`, startX + padding, y);
  
      ctx.textAlign = 'right';
      ctx.fillText(size.toString(), startX + width - padding, y);
      ctx.textAlign = 'left'; 
    }
  }
  
  



function drawDeathScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'red';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('You were eaten!', canvas.width / 2, canvas.height / 2 - 30);

  ctx.font = '24px sans-serif';
  ctx.fillText('Click to Respawn', canvas.width / 2, canvas.height / 2 + 30);
}

canvas.addEventListener('click', () => {
    if (isGameOver || hasWon) {
      createGameObjects();
      isGameOver = false;
      hasWon = false;
    }
  });
  
function drawWinScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    ctx.fillStyle = 'lime';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('You Win!', canvas.width / 2, canvas.height / 2 - 30);
  
    ctx.font = '24px sans-serif';
    ctx.fillText('Click to Play Again', canvas.width / 2, canvas.height / 2 + 30);
  }
  


  function draw() {
    const now = Date.now();
    fps = Math.round(1000 / (now - lastFrameTime));
    lastFrameTime = now;
  
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // Game end screens
    if (isGameOver) {
      drawDeathScreen();
      return;
    }
    if (hasWon) {
      drawWinScreen();
      return;
    }
  
    // 🔍 Smooth zoom based on blob size
    const minZoom = 0.6;
    const maxZoom = 1.2;
    const baseRadius = 10;
    const targetZoom = maxZoom - Math.min(0.6, (player.radius - baseRadius) * 0.015);
    const clampedTargetZoom = Math.max(minZoom, targetZoom);
  
    const zoomSpeed = 0.05;
    currentZoom += (clampedTargetZoom - currentZoom) * zoomSpeed;
  
    // 🌍 World space
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(currentZoom, currentZoom);
    ctx.translate(-player.x, -player.y);
  
    // ✅ Safe Zone
    if (safeZone) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 255, 100, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.4)';
      ctx.lineWidth = 2 + Math.sin(Date.now() / 300) * 1.5;
      ctx.stroke();
      ctx.restore();
    }
  
    // 🔥 Decay Zones
    decayZones.forEach(zone => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 80, 80, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
      ctx.lineWidth = 2 + Math.sin(Date.now() / 200) * 1.5;
      ctx.stroke();
      ctx.restore();
    });
  
    // ⬛ Arena
    ctx.strokeStyle = '#333';
    ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  
    // 🍏 Food and Blobs
    drawFood();
    enemies.forEach(ai => ai.draw());
    player.draw();
    drawParticles();
  
    ctx.restore(); // exit world space
  
    // 🧭 UI
    drawUI();
    drawMiniMap();
    drawKillFeed();
  }
  
  
  
  

function drawMiniMap() {
    const mapWidth = 200;
    const mapHeight = 200;
    const scale = mapWidth / WORLD_SIZE;
    const margin = 20;
  
    const mapX = canvas.width - mapWidth - margin;
    const mapY = canvas.height - mapHeight - margin;
  
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
  
    
    for (let f of foodList) {
      const fx = mapX + f.x * scale;
      const fy = mapY + f.y * scale;
      ctx.fillStyle = f.color;
      ctx.fillRect(fx, fy, 2, 2);
    }
  
    
    for (let ai of enemies) {
      const ax = mapX + ai.x * scale;
      const ay = mapY + ai.y * scale;
      ctx.fillStyle = 'red';
      ctx.fillRect(ax, ay, 3, 3);
    }
  
    
    const px = mapX + player.x * scale;
    const py = mapY + player.y * scale;
    ctx.fillStyle = 'lime';
    ctx.fillRect(px, py, 4, 4);
  
    ctx.strokeStyle = 'white';
    ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);
  }
  
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);

}
setInterval(spawnFoodCluster, 15000 + Math.random() * 10000);
setInterval(spawnSpeedBlob, 12000 + Math.random() * 10000);
setInterval(spawnShieldBlob, 20000 + Math.random() * 10000);
setInterval(spawnMagnetBlob, 25000 + Math.random() * 10000);
setInterval(spawnTrapBlob, 20000 + Math.random() * 10000);
setInterval(spawnSafeZone, 30000 + Math.random() * 15000);
setInterval(spawnDecayZone, 35000 + Math.random() * 15000);



createGameObjects();
loop();

setInterval(maintainFood, 2000);