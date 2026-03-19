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

// 출차요청 알림음: 경쾌한 2톤 비프 (띠링~)
export function playExitRequestSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime;

  // 볼륨 (크게)
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

  // 첫 번째 톤 (높은음)
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, now);       // A5
  osc1.frequency.setValueAtTime(1175, now + 0.15); // D6
  osc1.connect(gain);
  osc1.start(now);
  osc1.stop(now + 0.3);

  // 두 번째 톤 (더 높은음)
  const gain2 = ctx.createGain();
  gain2.connect(ctx.destination);
  gain2.gain.setValueAtTime(0.35, now + 0.3);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1175, now + 0.3);  // D6
  osc2.frequency.setValueAtTime(1397, now + 0.45);  // F6
  osc2.connect(gain2);
  osc2.start(now + 0.3);
  osc2.stop(now + 0.6);

  // 세 번째 톤 (마무리)
  const gain3 = ctx.createGain();
  gain3.connect(ctx.destination);
  gain3.gain.setValueAtTime(0.3, now + 0.6);
  gain3.gain.exponentialRampToValueAtTime(0.01, now + 1.4);

  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(1760, now + 0.6);  // A6
  osc3.connect(gain3);
  osc3.start(now + 0.6);
  osc3.stop(now + 1.0);
}
