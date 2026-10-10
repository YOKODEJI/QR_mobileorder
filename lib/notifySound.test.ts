import { describe, it, expect } from "vitest";
import { PARTIALS, STRIKES, ATTACK_SEC } from "./notifySound";

/** scheduleChime と同じ包絡（直線で立ち上がり、指数で消える）で波形を計算する */
function render(sampleRate = 22050, seconds = 3.6): Float64Array {
  const buf = new Float64Array(Math.ceil(sampleRate * seconds));
  for (const [freq, offset, volume] of STRIKES) {
    for (const [ratio, level, decay] of PARTIALS) {
      const peak = level * volume;
      const start = Math.round(offset * sampleRate);
      const n = Math.round((ATTACK_SEC + decay) * sampleRate);
      for (let i = 0; i < n && start + i < buf.length; i++) {
        const t = i / sampleRate;
        const env =
          t < ATTACK_SEC
            ? 0.0001 + (peak - 0.0001) * (t / ATTACK_SEC)
            : peak * Math.pow(0.0001 / peak, (t - ATTACK_SEC) / decay);
        buf[start + i] += env * Math.sin(2 * Math.PI * freq * ratio * t);
      }
    }
  }
  return buf;
}

describe("通知音（厨房）", () => {
  const wave = render();
  const peak = wave.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

  it("音が割れない（波形のピークが 1.0 を超えない）", () => {
    expect(peak).toBeLessThanOrEqual(1);
  });

  it("端末の音量をほぼいっぱいまで使う（ピーク 0.85 以上。以前の音は 0.25）", () => {
    expect(peak).toBeGreaterThanOrEqual(0.85);
  });

  it("すぐ消えない（0.5秒たっても、はっきり聞こえる大きさが残っている）", () => {
    const from = Math.round(0.5 * 22050);
    const tail = wave.slice(from, from + 2205).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(tail).toBeGreaterThan(0.2);
  });
});
