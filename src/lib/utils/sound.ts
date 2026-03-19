// 출차요청 알림음 유틸 (Web Audio API)
// 모바일 브라우저는 사용자 제스처 후에만 AudioContext 시작 가능

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

// 첫 터치/클릭 시 AudioContext unlock (모바일 필수)
export function unlockAudio() {
  if (unlocked) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => { unlocked = true; });
  } else {
    unlocked = true;
  }
}

// 차임 헬퍼
function chime(ctx: AudioContext, freq: number, startTime: number, duration: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// 미팍 출차요청 알림음: 더블 차임 (띵—띵!)
export function playExitRequestSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime;

  // 첫 번째 띵
  chime(ctx, 783.99, now, 0.5, 0.3);          // G5
  chime(ctx, 1046.50, now + 0.02, 0.45, 0.2); // C6
  chime(ctx, 1567.98, now + 0.03, 0.4, 0.1);  // G6 하모닉

  // 두 번째 띵! (살짝 높게)
  chime(ctx, 880, now + 0.45, 0.6, 0.35);        // A5
  chime(ctx, 1174.66, now + 0.47, 0.55, 0.22);   // D6
  chime(ctx, 1760, now + 0.48, 0.5, 0.12);       // A6 하모닉
}
