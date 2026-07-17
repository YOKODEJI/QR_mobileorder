"use client";

/** 絵文字に依存しない線画アイコン集。currentColorを継承するのでテキスト色と自動で揃う。 */
type IconProps = { size?: number; style?: React.CSSProperties };

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export function GearIcon({ size = 16, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function BellIcon({ size = 16, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function BellSlashIcon({ size = 16, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M6.3 8.5A6 6 0 0 1 18 8c0 3.2.8 4.8 1.4 5.8" />
      <path d="M18.5 17H4c.5-1 2-2.5 2-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function PrinterIcon({ size = 16, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="2" />
      <path d="M6 14h12v7H6z" />
    </svg>
  );
}

export function RefreshIcon({ size = 16, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function WarningIcon({ size = 16, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** 直線だけで構成した幾何学的なチェックマーク（フォントのチェック文字は
 *  丸みや太さが環境依存でぶれるため、注文完了のような強調表示には使わない）。 */
export function CheckIcon({ size = 16, style }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2.5} style={style}>
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}
