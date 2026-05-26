import type { SVGProps } from 'react'

const base = {
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function MapPin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export function Compass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5.5-5.5 2 2-5.5 5.5-2Z" />
    </svg>
  )
}

export function Search(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  )
}

export function Sparkle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  )
}

export function Utensils(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3v7a3 3 0 0 0 3 3v8" />
      <path d="M9 3v7a3 3 0 0 1-3 3" />
      <path d="M14 3c-1.5 1.5-2 4-2 6s.5 4 2 4v8" />
      <path d="M19 3v18" />
    </svg>
  )
}

export function Clock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function Star(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} fill="currentColor" stroke="none" viewBox="0 0 24 24" {...props}>
      <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z" />
    </svg>
  )
}

export function ChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function ChevronUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  )
}

export function X(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m6 6 12 12M6 18 18 6" />
    </svg>
  )
}

export function Filter(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z" />
    </svg>
  )
}

export function Sliders(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  )
}

export function Phone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 5c0 9 7 16 16 16l1-4-5-2-2 2c-3-1-5-3-6-6l2-2-2-5-4 1Z" />
    </svg>
  )
}

export function Globe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18" />
    </svg>
  )
}

export function Flame(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} fill="currentColor" stroke="none" viewBox="0 0 24 24" {...props}>
      <path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-1 .5-2 1-3 0 1.5 1 2 1.5 2-.5-2 0-5 1.5-8Zm-1 13c1 .5 3 .5 4-.5.5 2-1 4-3 4s-3-2-2.5-3.5c.5.5 1 .5 1.5 0Z" />
    </svg>
  )
}

export function Refresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.5M20 4v6h-6" />
    </svg>
  )
}

export function Burger(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} fill="currentColor" stroke="none" viewBox="0 0 24 24" {...props}>
      <path d="M3 8c0-1 .9-2 2-2h14c1.1 0 2 .9 2 2v1H3V8Z" />
      <path d="M4 10h16c1 0 1.5.5 1.5 1.5s-.5 1.5-1.5 1.5H4c-1 0-1.5-.5-1.5-1.5S3 10 4 10Z" />
      <circle cx="7" cy="11.5" r="1" fill="white" />
      <circle cx="12" cy="11.5" r="1" fill="white" />
      <circle cx="17" cy="11.5" r="1" fill="white" />
      <path d="M3 13h18c1 0 1.5.5 1.5 1.5-.5 2-1 3-2 3.5H3.5c-1-.5-1.5-1.5-2-3.5C1.5 13.5 2 13 3 13Z" />
      <path d="M3 17c0-1 .9-2 2-2h14c1.1 0 2 .9 2 2v1H3v-1Z" />
    </svg>
  )
}
