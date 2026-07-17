"use client";

export default function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: "51px",
        height: "31px",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
        padding: 0,
        position: "relative",
        background: on ? "var(--green)" : "rgba(120,120,128,.16)",
        transition: "background .2s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: on ? "22px" : "2px",
          width: "27px",
          height: "27px",
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          transition: "left .2s",
        }}
      />
    </button>
  );
}
