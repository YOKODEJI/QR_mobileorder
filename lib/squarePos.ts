"use client";

// Square Point of Sale API（モバイルWeb版）のディープリンク生成・戻り値解析。
// この方式はSandboxでの動作確認をサポートしないAPIのため、実機・本番の
// Square POSアプリ・本番トークンでの確認が前提（Square公式ドキュメントに明記）。
// 参考: https://developer.squareup.com/docs/pos-api/web-technical-reference

export type SquarePosPlatform = "ios" | "android" | "unsupported";

export function detectSquarePosPlatform(): SquarePosPlatform {
  if (typeof navigator === "undefined") return "unsupported";

  // Client Hints(Chromium系)。UA文字列と違い「デスクトップ表示」設定の影響を受けにくく、
  // 大画面Androidタブレットの誤判定(後述)に対する最も信頼できる一次情報。
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData?.platform === "Android") return "android";

  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13以降のSafariは既定で「Macintosh」を名乗るデスクトップ版UAを送るため、
  // UA文字列だけでは実機のMacと区別できない。実際のMacはタッチ非対応
  // (maxTouchPoints=0)なので、タッチ対応のMacintosh名乗りはiPadとみなす。
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/.test(ua)) return "android";
  // 大画面Androidタブレット(Xiaomi Pad 7等)のブラウザは、既定で「Android」を含まない
  // デスクトップ相当のUA(Linux系)を送ることがある。タッチ対応のLinux系UAはAndroidとみなす。
  if (/Linux/.test(ua) && navigator.maxTouchPoints > 1) return "android";
  return "unsupported";
}

const TENDER_TYPES_IOS = ["CREDIT_CARD", "CASH", "PAYPAY", "OTHER"];
const TENDER_TYPES_ANDROID = [
  "com.squareup.pos.TENDER_CARD",
  "com.squareup.pos.TENDER_CASH",
  "com.squareup.pos.TENDER_PAYPAY",
  "com.squareup.pos.TENDER_OTHER",
];

/** Square POSアプリを開く決済リクエストのURLを組み立てる。
 *  amountYen: 円の整数（JPYは0桁通貨のためそのままamountに使う＝100円なら100）。
 *  state: 戻ってきたときに突き合わせるための相関トークン（このアプリ側で発行したもの）。 */
export function buildSquarePosUrl(params: {
  platform: SquarePosPlatform;
  applicationId: string;
  locationId: string | null;
  amountYen: number;
  callbackUrl: string;
  state: string;
  note: string;
}): string | null {
  const { platform, applicationId, locationId, amountYen, callbackUrl, state, note } = params;

  if (platform === "ios") {
    const data = {
      amount_money: { amount: amountYen, currency_code: "JPY" },
      callback_url: callbackUrl,
      client_id: applicationId,
      version: "1.3",
      notes: note,
      state,
      ...(locationId ? { location_id: locationId } : {}),
      options: {
        supported_tender_types: TENDER_TYPES_IOS,
        auto_return: true,
      },
    };
    return `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(data))}`;
  }

  if (platform === "android") {
    const parts = [
      "intent:#Intent",
      "action=com.squareup.pos.action.CHARGE",
      "package=com.squareup",
      `S.browser_fallback_url=${encodeURIComponent(callbackUrl)}`,
      `S.com.squareup.pos.WEB_CALLBACK_URI=${encodeURIComponent(callbackUrl)}`,
      `S.com.squareup.pos.CLIENT_ID=${applicationId}`,
      "S.com.squareup.pos.API_VERSION=v2.0",
      `i.com.squareup.pos.TOTAL_AMOUNT=${amountYen}`,
      "S.com.squareup.pos.CURRENCY_CODE=JPY",
      `S.com.squareup.pos.TENDER_TYPES=${TENDER_TYPES_ANDROID.join(",")}`,
      `S.com.squareup.pos.NOTE=${encodeURIComponent(note)}`,
      `S.com.squareup.pos.REQUEST_METADATA=${encodeURIComponent(state)}`,
      ...(locationId ? [`S.com.squareup.pos.LOCATION_ID=${locationId}`] : []),
      "end",
    ];
    return parts.join(";");
  }

  return null; // PC等、Square POSアプリが存在しない環境
}

export type SquarePosResult =
  | { status: "ok"; transactionId: string | null; state: string | null }
  | { status: "canceled"; state: string | null }
  | { status: "error"; errorCode: string | null; state: string | null }
  | { status: "unknown" };

/** Square POSアプリから戻ってきたコールバックURLのクエリを解析する。
 *  iOS/Androidでパラメータ名の形が違うため両対応。 */
export function parseSquarePosCallback(search: string): SquarePosResult {
  const p = new URLSearchParams(search);

  // iOS: status=ok|error, transaction_id, state, error_code
  // Android: com.squareup.pos.SERVER_TRANSACTION_ID / .ERROR_CODE / .REQUEST_METADATA(=state)
  const iosStatus = p.get("status");
  const iosTxId = p.get("transaction_id");
  const iosErrorCode = p.get("error_code");
  const iosState = p.get("state");

  const androidTxId = p.get("com.squareup.pos.SERVER_TRANSACTION_ID");
  const androidErrorCode = p.get("com.squareup.pos.ERROR_CODE");
  const androidState = p.get("com.squareup.pos.REQUEST_METADATA");

  const state = iosState ?? androidState ?? null;
  const errorCode = iosErrorCode ?? androidErrorCode ?? null;
  const transactionId = iosTxId ?? androidTxId ?? null;

  if (errorCode) {
    if (errorCode === "payment_canceled" || errorCode === "TRANSACTION_CANCELED") {
      return { status: "canceled", state };
    }
    return { status: "error", errorCode, state };
  }
  if (iosStatus === "ok" || transactionId) {
    return { status: "ok", transactionId, state };
  }
  if (!iosStatus && !androidTxId && !androidErrorCode && !iosTxId) {
    return { status: "unknown" };
  }
  return { status: "error", errorCode: null, state };
}
