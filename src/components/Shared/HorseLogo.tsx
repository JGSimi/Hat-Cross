import horseLogoUrl from '../../assets/horse-logo.svg';

interface HorseLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
  color?: string;
}

export default function HorseLogo({ size = 26, animated = false, className, color }: HorseLogoProps) {
  const maskStyle: React.CSSProperties = {
    width: size,
    height: size,
    maskImage: `url(${horseLogoUrl})`,
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskImage: `url(${horseLogoUrl})`,
    WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    flexShrink: 0,
  };

  if (animated) {
    return (
      <div
        className={className}
        style={{
          ...maskStyle,
          background: 'linear-gradient(270deg, var(--color-accent), var(--color-accent-hover), color-mix(in srgb, var(--color-accent) 60%, white), var(--color-accent-hover), var(--color-accent))',
          backgroundSize: '300% 300%',
          animation: 'horse-gradient-shift 4s ease infinite',
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        ...maskStyle,
        backgroundColor: color || 'currentColor',
      }}
    />
  );
}
