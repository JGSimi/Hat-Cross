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
          background: 'linear-gradient(270deg, #6366F1, #EC4899, #14B8A6, #F59E0B, #6366F1)',
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
