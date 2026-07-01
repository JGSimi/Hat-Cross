import { useId, type CSSProperties } from 'react';

// Logo do Hat (mascote alienígena de chapéu) — vetor oficial exportado do
// Figma ("image 4 [Vectorized]"). Dois paths (cabeça+olhos+bigode e o chapéu)
// + filtro de sombra interna e grão. Usa currentColor para herdar a cor do
// contexto (branco em todas as telas atuais). O id do filtro é único por
// instância (useId) para não colidir quando o logo aparece mais de uma vez.
const HEAD_PATH =
  'M73.3833 239.295C77.4757 238.977 83.23 238.897 87.3217 238.98C124.141 240.017 158.87 256.34 183.185 284.037C193.986 296.247 201.978 308.47 214.117 321.461C261.629 372.309 319.444 377.101 384.743 378.285C411.218 378.766 439.789 378.767 466.618 378.389C532.6 377.456 598.461 381.643 652.859 337.501C680.431 315.127 687.364 296.334 709.404 275.18C734.607 251.139 768.309 238.094 803.111 238.909C825.429 239.401 850.194 246.063 866.184 262.604C875.369 272.105 879.547 283.488 879.265 296.657C878.834 316.812 868.613 335.726 853.932 349.251C827.163 373.91 788.527 386.611 753.339 392.896C745.365 394.32 732.943 396.27 725.203 396.009C732.875 410.779 739.268 425.109 745.197 440.648C788.165 553.26 751.932 682.648 702.891 788.007L702.657 788.508C650.651 899.101 522.711 1091.95 376.062 1019.28C269.08 966.262 192.471 828.425 153.302 720.247C123.136 636.937 105.748 539.828 134.585 453.701C141.917 431.591 148.69 417.439 158.61 396.567C117.877 391.206 68.6907 382.484 37.0573 355.344C-19.6412 306.699 0.22645 247.503 73.3833 239.295ZM408.672 793.151C411.865 744.68 387.335 687.239 355.555 651.053C318.416 608.409 265.762 582.433 209.356 578.928C204.227 578.647 199.099 578.311 193.977 577.919C200.524 704.331 282.853 785.881 408.672 793.151ZM474.69 792.753L488.952 792.175C545.794 788.678 598.879 762.571 636.384 719.667C674.861 676.019 686.343 634.25 690.418 578.215C688.241 578.268 678.568 578.381 677.043 578.765C577.307 587.383 500.232 650.917 479.264 751.26C476.345 765.231 475.629 778.573 474.69 792.753ZM414.443 856.727C391.419 863.092 370.375 889.167 345.52 892.404C329.354 894.52 324.661 881.706 331.458 868.661C336.463 859.059 350.484 866.453 352.587 863.939C351.015 861.283 347.392 860.263 344.606 859.491C320.352 852.769 310.502 885.848 322.043 902.727C331.995 917.291 348.802 925.084 365.686 928.744C391.068 933.449 415.711 933.673 437.826 919.283C439.269 918.337 440.696 917.374 442.108 916.387C450.884 922.47 456.119 925.723 466.498 928.727C491.555 934.569 523.632 931.623 545.941 917.864C555.083 912.221 563.288 904.428 565.949 893.549C569.086 880.719 563.554 862.57 549.292 859.126C545.043 858.097 538.887 858.404 535.016 860.678C533.933 861.333 533.302 862.155 532.606 863.184L533.048 864.122C539.416 865.25 548.359 861.209 553.046 867.756C555.519 870.827 556.161 880.238 554.97 883.59C546.936 906.204 512.652 881.624 501.335 874.387C480.415 861.018 467.217 848.014 442.314 863.01C432.7 857.084 425.938 855.516 414.443 856.727Z';
const HAT_PATH =
  'M507.244 4.32812C518.596 4.57428 525.749 9.63932 532.045 18.7822C551.12 46.4823 573.378 73.7797 591.42 102.041C595.717 108.863 599.641 115.915 603.173 123.165C606.673 130.341 610.159 139.07 612.5 146.73C627.057 194.731 641.042 242.917 655.562 290.934C660.016 305.664 665.678 312.138 653.497 323.37C634.932 340.188 612.626 352.331 588.433 358.79C546.618 370.238 494.559 367.983 451.076 368.14C419.532 368.253 385.985 368.599 354.627 367.283C303.633 364.42 258.543 353.627 222.354 314.959C223.807 304.594 235.867 266.835 239.595 254.278L260.946 182.443C266.867 162.55 274.098 135.468 283.809 117.493C300.709 86.2055 326.002 56.9915 345.693 27.2066C356.997 10.1074 371.729 1.51911 391.824 12.1012C400.394 16.614 406.337 22.7233 416.795 27.4328C427.245 32.1816 438.819 33.8866 450.192 32.3525C480.15 28.5934 486.159 8.0594 507.244 4.32812Z';

const ASPECT = 1039 / 882; // altura / largura

interface HatLogoProps {
  /** Altura em px (a largura é proporcional). */
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function HatLogo({ size = 24, className, style, title }: HatLogoProps) {
  const filterId = `hat-logo-${useId().replace(/:/g, '')}`;
  return (
    <svg
      viewBox="0 0 882 1039"
      width={size / ASPECT}
      height={size}
      fill="none"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g filter={`url(#${filterId})`}>
        <path fill="currentColor" d={HEAD_PATH} />
        <path fill="currentColor" d={HAT_PATH} />
      </g>
      <defs>
        <filter
          id={filterId}
          x="0"
          y="0"
          width="882"
          height="1049"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="10" />
          <feGaussianBlur stdDeviation="10" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0" />
          {/* ponytail: só a sombra interna. O grão (feTurbulence) do Figma é
              dependente de escala — renderizado a ~220px vira chuvisco grosso e
              muda a cada tamanho do logo. Fora até pedirem um grão calibrado. */}
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow" />
        </filter>
      </defs>
    </svg>
  );
}
