// 厨房の通知音。新しい注文が入ったときに鳴らす。
// 音源ファイルは使わず、その場で合成する（鐘のような「ポン・ポーン」を2回）。
//
// ねらい（2026-10-03 長谷川さん）: 厨房の物音の中でも気づける大きさで、ただし上品でおしとやかな音。
//   ・大きさ: 端末の音量をほぼいっぱいまで使う（波形のピークが約0.95。1.0を超えると音が割れるので、その手前）。
//     以前は 880Hz を1回・ピーク0.25・0.4秒だけで、厨房では埋もれていた。ピークで約+12dB、音のエネルギーで約70倍
//     （下の数値を変えたら、ピークが1.0を超えないか確かめること。倍音の大きさの合計×打の大きさが目安）
//   ・気づきやすさ: 小さなスピーカーでもよく鳴り、耳が敏感な 0.9〜2.6kHz に音を集める。2打を2回くり返す
//   ・上品さ: 角のない正弦波だけを重ね、立ち上がりをわずかに丸め、長く自然に消える余韻にする（ブザーや電子音にしない）
// 実際の音量は端末の「メディアの音量」で決まる。アプリ側ではこれ以上大きくできない。

/** 1打を作る倍音。[基音に対する比, 大きさ, 消えるまでの秒数] */
export const PARTIALS: readonly (readonly [number, number, number])[] = [
  [1, 0.53, 1.8], // 基音
  [1.003, 0.13, 1.8], // わずかにずらした基音。うなりが出て、おりんのような揺らぎになる
  [2, 0.21, 1.4],
  [3, 0.08, 0.8],
  [4.2, 0.045, 0.25], // 打った瞬間の「チン」
];

/** 鳴らす順番。[周波数Hz, 始まるまでの秒数, 大きさ] ラ → 上のミ（完全5度）を2回 */
export const STRIKES: readonly (readonly [number, number, number])[] = [
  [880, 0, 1],
  [1318.51, 0.3, 1],
  [880, 1.2, 0.85],
  [1318.51, 1.5, 0.85],
];

/** 立ち上がりの秒数（0だと「プツッ」という雑音になる） */
export const ATTACK_SEC = 0.008;
/** 鳴り始めから、次の通知音を重ねない時間（立て続けに注文が入っても音が濁らないように） */
const MIN_INTERVAL_MS = 2600;

/** 通知音の音の並びを ctx 上に予約する（鳴らすだけ。試験でも同じものを使えるよう分けてある） */
export function scheduleChime(ctx: BaseAudioContext, out: AudioNode, startAt: number): void {
  for (const [freq, offset, volume] of STRIKES) {
    const t = startAt + offset;
    for (const [ratio, level, decay] of PARTIALS) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level * volume, t + ATTACK_SEC);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ATTACK_SEC + decay);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + ATTACK_SEC + decay + 0.05);
    }
  }
}

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

/** 通知音を鳴らす。ブラウザの決まりで、画面に一度触れるまでは鳴らない（厨房画面の「タップして開始」） */
export function playOrderChime(): void {
  try {
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = audioCtx || (audioCtx = new AC());
    if (ctx.state === "suspended") void ctx.resume();

    const now = performance.now();
    if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
    lastPlayedAt = now;

    // 圧縮などの加工は挟まない（ブラウザごとに効き方が違い、打った瞬間に音が割れることがあるため）。
    // 大きさは上の数値だけで決まるので、どの端末でも同じ波形になる
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    scheduleChime(ctx, master, ctx.currentTime + 0.03);
    // 鳴り終わったら外す
    window.setTimeout(() => master.disconnect(), 4500);
  } catch {
    /* 音が出せない端末でも、画面の表示は続ける */
  }
}
