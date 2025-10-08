(() => {
  const W = 960, H = 600;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const elScore = document.getElementById("score");
  const elHigh = document.getElementById("high");
  const elLives = document.getElementById("lives");
  const elLevel = document.getElementById("level");
  const elPower = document.getElementById("power");

  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnMute = document.getElementById("btnMute");
  const btnRestart = document.getElementById("btnRestart");

  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ovTitle");
  const ovMsg = document.getElementById("ovMsg");
  const ovBtn = document.getElementById("ovBtn");

  const stickBase = document.getElementById("stickBase");
  const stick = document.getElementById("stick");
  const fireBtn = document.getElementById("fireBtn");

  const HS_KEY = "spaceShooterHighScore";
  let highScore = Number(localStorage.getItem(HS_KEY) || 0);
  elHigh.textContent = highScore;

  // ======== INPUT ========
  const input = { left:false, right:false, up:false, down:false, fire:false, pause:false, mute:false };

  document.addEventListener("keydown", e => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
    if (e.code === "ArrowUp" || e.code === "KeyW") input.up = true;
    if (e.code === "ArrowDown" || e.code === "KeyS") input.down = true;
    if (e.code === "Space") input.fire = true;
    if (e.code === "KeyP") input.pause = true;
    if (e.code === "KeyM") input.mute = true;
  });

  document.addEventListener("keyup", e => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
    if (e.code === "ArrowUp" || e.code === "KeyW") input.up = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") input.down = false;
    if (e.code === "Space") input.fire = false;
  });

  // ✅ everything else from your code here (stick controls, Sound class, SPR, Player, Enemy, etc.)

  // End of file
  showOverlay(
    "Space Shooter",
    "Move: WASD/Arrows or left stick • Fire: Space or FIRE button • P: Pause • M: Mute"
  );
  requestAnimationFrame(loop);
})();
