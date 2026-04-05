import { useId } from 'react';

interface HorseLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
  color?: string;
}

export default function HorseLogo({ size = 26, animated = false, className, color }: HorseLogoProps) {
  const uid = useId();
  const gradientId = `horse-grad-${uid}`;
  const fillColor = animated ? `url(#${gradientId})` : (color || 'currentColor');

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {animated && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1">
              <animate attributeName="stop-color" values="#6366F1;#EC4899;#14B8A6;#F59E0B;#6366F1" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#EC4899">
              <animate attributeName="stop-color" values="#EC4899;#14B8A6;#F59E0B;#6366F1;#EC4899" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#14B8A6">
              <animate attributeName="stop-color" values="#14B8A6;#F59E0B;#6366F1;#EC4899;#14B8A6" dur="4s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>
      )}
      <g fill="none" stroke={fillColor} strokeLinecap="round" strokeLinejoin="round">
        {/* Horse head — elongated wedge profile facing right-down */}
        <path strokeWidth="11" d="
          M 210,190
          C 225,180 250,175 270,178
          C 295,182 320,192 342,210
          C 360,225 375,248 388,275
          C 396,292 402,312 400,330
          C 398,342 392,352 384,360
          C 376,368 368,378 358,388
          C 350,395 340,400 328,398
          C 316,396 302,388 288,380
          C 272,372 256,368 240,370
          C 228,372 218,368 210,358
          C 200,344 192,325 186,305
          C 180,282 178,258 184,236
          C 188,218 196,202 210,190
          Z
        "/>

        {/* Muzzle — nostril */}
        <ellipse cx="392" cy="340" rx="6" ry="7" strokeWidth="6" fill={fillColor} opacity="0.5"/>
        {/* Nostril detail */}
        <path strokeWidth="4" d="M 386,355 C 392,350 396,342 398,334"/>

        {/* Mouth line */}
        <path strokeWidth="5" d="M 362,392 C 370,385 378,375 384,365"/>

        {/* Eye */}
        <ellipse cx="285" cy="232" rx="6" ry="8" strokeWidth="2" fill={fillColor}/>

        {/* === COWBOY HAT === */}
        {/* Hat brim */}
        <path strokeWidth="10" d="
          M 110,188
          C 130,168 175,155 230,152
          C 285,150 335,158 365,175
        "/>
        <path strokeWidth="10" d="
          M 118,198
          C 142,206 185,210 230,210
          C 278,210 322,205 355,195
        "/>
        {/* Brim fill */}
        <path strokeWidth="0" fill={fillColor} opacity="0.08" d="
          M 110,188 C 130,168 175,155 230,152 C 285,150 335,158 365,175
          L 355,195 C 322,205 278,210 230,210 C 185,210 142,206 118,198 Z
        "/>

        {/* Hat crown */}
        <path strokeWidth="10" d="
          M 158,192
          C 162,155 180,120 215,105
          C 242,94 270,98 292,110
          C 316,125 332,150 338,182
        "/>
        {/* Crown top crease */}
        <path strokeWidth="6" d="M 192,128 C 210,112 242,105 268,112 C 292,118 312,135 322,152"/>

        {/* Bullet band */}
        <rect x="188" y="158" width="9" height="20" rx="2.5" strokeWidth="4" fill={fillColor} opacity="0.25"/>
        <rect x="206" y="156" width="9" height="20" rx="2.5" strokeWidth="4" fill={fillColor} opacity="0.25"/>
        <rect x="224" y="155" width="9" height="20" rx="2.5" strokeWidth="4" fill={fillColor} opacity="0.25"/>
        <rect x="242" y="155" width="9" height="20" rx="2.5" strokeWidth="4" fill={fillColor} opacity="0.25"/>
        <rect x="260" y="156" width="9" height="20" rx="2.5" strokeWidth="4" fill={fillColor} opacity="0.25"/>
        <rect x="278" y="158" width="9" height="20" rx="2.5" strokeWidth="4" fill={fillColor} opacity="0.25"/>

        {/* === EARS === */}
        <path strokeWidth="9" d="
          M 325,170
          C 332,145 342,125 345,132
          C 348,142 340,165 330,178
        "/>
        <path strokeWidth="7" d="
          M 140,180
          C 135,162 132,145 137,140
          C 143,136 146,152 144,172
        "/>

        {/* === GLASSES === */}
        <circle cx="260" cy="228" r="26" strokeWidth="7"/>
        <circle cx="325" cy="260" r="24" strokeWidth="7"/>
        <path strokeWidth="5" d="M 285,232 C 292,238 298,242 305,248"/>
        <path strokeWidth="4" d="M 234,224 C 222,218 210,214 200,210"/>
        {/* Right lens crosshair */}
        <line x1="308" y1="260" x2="342" y2="260" strokeWidth="3" opacity="0.4"/>
        <line x1="325" y1="243" x2="325" y2="277" strokeWidth="3" opacity="0.4"/>
        <circle cx="325" cy="260" r="12" strokeWidth="2.5" opacity="0.35"/>

        {/* === MANE === */}
        <path strokeWidth="10" d="M 148,190 C 128,215 105,255 92,295 C 82,330 86,360 100,388"/>
        <path strokeWidth="8" d="M 155,198 C 135,225 112,268 102,308 C 94,340 98,370 112,395"/>
        <path strokeWidth="7" d="M 162,206 C 142,235 120,278 112,318 C 106,348 110,375 124,398"/>
        <path strokeWidth="9" d="M 138,185 C 115,208 90,248 78,290 C 70,325 75,358 90,385"/>
        <path strokeWidth="6" d="M 150,195 C 130,222 108,262 96,305 C 88,338 94,365 108,390"/>
        {/* Hair tips */}
        <path strokeWidth="5" d="M 100,388 C 96,400 100,412 108,418"/>
        <path strokeWidth="5" d="M 112,395 C 108,408 112,420 120,425"/>
        <path strokeWidth="4" d="M 124,398 C 120,410 124,422 132,428"/>
        <path strokeWidth="4" d="M 90,385 C 84,398 88,410 96,416"/>
        <path strokeWidth="4" d="M 108,390 C 104,402 108,414 116,420"/>

        {/* === EARRING === */}
        <circle cx="208" cy="332" r="7" strokeWidth="5"/>
        <circle cx="208" cy="345" r="5" strokeWidth="3.5"/>

        {/* === CIGAR === */}
        <path strokeWidth="11" strokeLinecap="round" d="M 365,392 L 415,370"/>
        <path strokeWidth="7" d="M 415,370 L 435,360" opacity="0.65"/>
        <circle cx="435" cy="360" r="4" strokeWidth="2.5" fill={fillColor} opacity="0.35"/>

        {/* === SMOKE === */}
        <path strokeWidth="4.5" opacity="0.45" d="
          M 432,356
          C 438,340 432,322 440,306
          C 446,292 440,276 446,260
        "/>
        <path strokeWidth="3.5" opacity="0.3" d="
          M 436,358
          C 444,345 440,328 446,315
          C 452,302 446,286 452,272
        "/>
        <path strokeWidth="2.5" opacity="0.2" d="
          M 440,354
          C 446,338 442,322 448,306
        "/>

        {/* Face contour details */}
        <path strokeWidth="3.5" opacity="0.35" d="M 370,318 C 376,308 380,296 382,285"/>
        <path strokeWidth="3" opacity="0.25" d="M 362,332 C 368,322 374,312 378,300"/>
        {/* Jaw line */}
        <path strokeWidth="4" d="M 310,395 C 295,398 278,392 265,385"/>
      </g>
    </svg>
  );
}
