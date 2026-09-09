type RadarLogoProps = {
  compact?: boolean;
  className?: string;
};

export function RadarLogo({ compact = false, className = "" }: RadarLogoProps) {
  if (compact) {
    return (
      <div className={`radar-mark ${className}`} aria-label="RADAR">
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <path d="M10 17h28c11 0 19 6 19 16 0 9-7 14-16 15l19 15H43L26 49H10V37h29c4 0 6-2 6-5s-2-5-6-5H10V17Z" fill="currentColor" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`radar-wordmark ${className}`} aria-label="RADAR">
      <svg viewBox="0 0 690 118" role="img" aria-hidden="true">
        <g fill="currentColor">
          <path d="M16 25h82c24 0 39 13 39 34 0 18-12 29-31 32l38 28h-31L76 91H16V72h82c11 0 18-5 18-14 0-8-7-14-18-14H16V25Z" />
          <path d="M185 119h-24l58-94c4-7 10-11 17-11s13 4 17 11l58 94h-25l-50-80-51 80Z" />
          <path d="M334 25h74c38 0 62 19 62 47 0 29-24 47-62 47h-74V25Zm23 20v54h51c24 0 39-10 39-27 0-16-15-27-39-27h-51Z" />
          <path d="M508 119h-24l58-94c4-7 10-11 17-11s13 4 17 11l58 94h-25l-50-80-51 80Z" />
          <path d="M646 25h82c24 0 39 13 39 34 0 18-12 29-31 32l38 28h-31l-37-28h-60V72h82c11 0 18-5 18-14 0-8-7-14-18-14h-82V25Z" transform="translate(-84 0)" />
        </g>
      </svg>
    </div>
  );
}
