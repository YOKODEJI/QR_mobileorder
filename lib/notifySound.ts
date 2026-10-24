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
//
// iPad・iPhone で鳴らすための手当て（2026-10-17・10-24。iPadで鳴らない件）:
//   ・画面に触れた操作の中で音声を開放する（unlockAudio）。通知は通信で届く＝触れていない場面なので、先に開放しておかないと鳴らない
//   ・鳴らすのは <audio>（合成した音を一度だけ WAV に書き出して使う）。Web Audio の音は、iPad の「消音モード」や
//     消音スイッチで消されるが、<audio> は動画と同じ扱いで消されない。<audio> が使えないときだけ Web Audio で鳴らす
//   ・あわせて、対応している iPad（iPadOS 16.4〜）では音声の種類を「再生」にして、Web Audio も消音モードで消されないようにする

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
/** WAV に書き出すときの長さと標本化周波数（いちばん長い余韻が消えるまで） */
const CHIME_SEC = 3.5;
const SAMPLE_RATE = 44100;

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

/** 16bit・モノラルの WAV に書き出す（<audio> で鳴らすため） */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true); // fmt の長さ
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // モノラル
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // 1秒あたりのバイト数
  v.setUint16(32, 2, true); // 1標本のバイト数
  v.setUint16(34, 16, true); // 16bit
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

type Win = Window & {
  webkitAudioContext?: typeof AudioContext;
  webkitOfflineAudioContext?: typeof OfflineAudioContext;
};

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;
/** 通知音を鳴らす <audio>。画面に触れた操作の中で一度鳴らしたものは、あとから触れずに鳴らせる */
let player: HTMLAudioElement | null = null;
let playerUnlocked = false;
/** 合成した通知音（WAV）と、開放用の無音（WAV） */
let chimeUrl: string | null = null;
let chimeRendering: Promise<void> | null = null;
let silentUrl: string | null = null;

function getCtx(): AudioContext {
  const w = window as Win;
  const AC = window.AudioContext || w.webkitAudioContext!;
  return audioCtx || (audioCtx = new AC());
}

/** iPadOS 16.4〜: 音声の種類を「再生」にする（消音モードでも Web Audio を消さない）。未対応の端末では何もしない */
function preferPlaybackSession(): void {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch {
    /* ignore */
  }
}

/** 通知音を WAV に書き出しておく（1回だけ。音は出さずに裏で作る）。画面を開いたときに呼んでおくと、
 *  最初のタップの確認音から <audio> で鳴らせる */
export function prepareChime(): Promise<void> {
  if (chimeUrl) return Promise.resolve();
  if (chimeRendering) return chimeRendering;
  chimeRendering = (async () => {
    const w = window as Win;
    const OAC = window.OfflineAudioContext || w.webkitOfflineAudioContext;
    if (!OAC) return;
    const off = new OAC(1, Math.ceil(SAMPLE_RATE * CHIME_SEC), SAMPLE_RATE);
    scheduleChime(off, off.destination, 0.01);
    const rendered = await off.startRendering();
    chimeUrl = URL.createObjectURL(new Blob([encodeWav(rendered.getChannelData(0), SAMPLE_RATE)], { type: "audio/wav" }));
  })().catch(() => {
    chimeRendering = null; // 作れなかったときは Web Audio で鳴らす
  });
  return chimeRendering;
}

function getSilentUrl(): string {
  if (!silentUrl) {
    silentUrl = URL.createObjectURL(new Blob([encodeWav(new Float32Array(2205), 22050)], { type: "audio/wav" }));
  }
  return silentUrl;
}

/** 画面に触れた操作（タップ）の中で呼ぶ。iPad（Safari・ホーム画面アプリ）は、タップ以外の場面で音声を始められない
 *  （通知は通信で届くのでタップの外）。ここで <audio> と Web Audio の両方を開放しておく。
 *  画面を隠す・ロックしたあとに止まった音声の再開にも使う（何度呼んでもよい） */
export function unlockAudio(): void {
  preferPlaybackSession();
  void prepareChime();
  try {
    const ctx = getCtx();
    if (ctx.state !== "running") void ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* 音が出せない端末でも、画面の表示は続ける */
  }
  try {
    if (!player) player = new Audio();
    if (!playerUnlocked) {
      // 無音を1回流して、この <audio> を「触れずに鳴らしてよい」状態にする
      player.src = getSilentUrl();
      const p = player.play();
      playerUnlocked = true;
      // 直後に通知音へ差し替えたときの「中断」は失敗ではない。断られたときだけ開放できていない扱いにする
      p?.catch((e: unknown) => {
        if ((e as { name?: string })?.name === "NotAllowedError") playerUnlocked = false;
      });
    }
  } catch {
    playerUnlocked = false;
  }
}

/** Web Audio で鳴らす（<audio> が使えないとき） */
function playWithWebAudio(): void {
  try {
    const ctx = getCtx();
    if (ctx.state !== "running") void ctx.resume(); // iOSは "interrupted" になることがある
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

/** 通知音を鳴らす。ブラウザの決まりで、画面に一度触れるまでは鳴らない（厨房画面の「タップして開始」） */
export function playOrderChime(): void {
  const now = performance.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
  lastPlayedAt = now;

  if (player && playerUnlocked && chimeUrl) {
    try {
      if (player.src !== chimeUrl) player.src = chimeUrl;
      player.currentTime = 0;
      const p = player.play();
      if (p) {
        p.catch((e: unknown) => {
          if ((e as { name?: string })?.name !== "NotAllowedError") return;
          // 開放が切れていた（画面を隠した等）。Web Audio で鳴らし、次に触れたとき開放し直す
          playerUnlocked = false;
          playWithWebAudio();
        });
      }
      return;
    } catch {
      playerUnlocked = false;
    }
  }
  playWithWebAudio();
}
