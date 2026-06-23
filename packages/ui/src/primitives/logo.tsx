import * as React from "react";

/* Logo — parametrizado por marca. Cada app pasa su asset (`src`) y dimensiones.
   Framework-agnóstico (usa <img>); en Next, el consumidor puede envolverlo con
   next/image si quiere optimización. */
export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  height?: number;
}

export function Logo({ src, alt = "", height = 32, ...props }: LogoProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} height={height} {...props} />;
}
