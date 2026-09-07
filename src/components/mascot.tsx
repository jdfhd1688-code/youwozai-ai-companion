import React from "react";

type MascotProps = {
  size?: number;
  mood?: "normal" | "listening" | "happy" | "comforting" | "speaking" | "smile" | "listen" | "calm";
  className?: string;
};

export default function Mascot({ size = 150, mood = "smile", className = "" }: MascotProps) {
  const isSpeaking = mood === "speaking";
  const normalized =
    mood === "normal" ? "smile" : mood === "listening" || mood === "speaking" ? "listen" : mood === "comforting" ? "calm" : mood;
  const eyeY = normalized === "listen" ? 84 : 83;
  const eyeOpen = normalized === "calm" ? 0.25 : 1;
  const mouth = isSpeaking
    ? "M 100 114 Q 110 123 120 114 Q 110 132 100 114"
    : normalized === "happy"
      ? "M 95 113 Q 110 127 125 113"
      : "M 98 114 Q 110 126 122 114";
  return (
    <svg
      className={`${className} ${isSpeaking ? "mascot-speaking" : ""}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 220 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="小在"
    >
      <circle cx="110" cy="128" r="62" fill="#DDAF7A" />
      <rect x="37" y="98" width="146" height="72" rx="36" fill="#DDAF7A" />
      <path d="M38 126 C23 117 28 94 44 93 C31 99 33 120 38 126Z" fill="#E3BD8D" />
      <path d="M182 126 C197 117 192 94 176 93 C189 99 187 120 182 126Z" fill="#E3BD8D" />
      <ellipse cx="110" cy="127" rx="72" ry="61" fill="#E2B984" />
      <ellipse cx="110" cy="137" rx="67" ry="52" fill="#EFCEA4" />
      <path d="M71 101 Q83 77 98 89" stroke="#B97F4A" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M149 101 Q137 77 122 89" stroke="#B97F4A" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M105 51 L110 29 L115 51" fill="#C9A14E" transform="rotate(0 110 40)" />
      <path d="M110 26 C115 22 129 24 129 34 C129 43 116 46 110 46 C104 46 91 43 91 34 C91 24 105 22 110 26Z" fill="#84A97A" />
      <circle cx="91" cy="84" r="7" fill="#4B3D33" />
      <circle cx="129" cy="84" r="7" fill="#4B3D33" />
      <circle cx="94" cy="82" r="2" fill="#FFF" />
      <circle cx="132" cy="82" r="2" fill="#FFF" />
      <ellipse cx="110" cy="105" rx="15" ry="11" fill="#A9663E" />
      <ellipse cx="110" cy="104" rx="6" ry="4" fill="#6F3D28" />
      <path className="mascot-mouth" d={mouth} stroke="#7E4A2F" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <circle cx="100" cy="151" r="7" fill="#EBAF95" opacity="0.9" />
      <circle cx="121" cy="152" r="6" fill="#EBAF95" opacity="0.7" />
      <path d="M159 143 C168 139 177 144 178 152 C179 159 169 164 161 160" fill="#D9A1C0" />
      <path d="M163 153 C173 163 181 156 180 149 C178 139 168 140 164 146" fill="#C97D9E" opacity="0.7" />
      <rect x="78" y="168" width="64" height="16" rx="8" fill="#B98A57" opacity="0.75" />
    </svg>
  );
}
