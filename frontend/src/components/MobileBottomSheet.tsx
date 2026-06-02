import { useRef, useState, useEffect, type ReactNode } from 'react'

type Snap = 'collapsed' | 'mid' | 'full'

const FRACTION: Record<Snap, number> = {
  collapsed: 0.14,
  mid: 0.5,
  full: 0.92,
}

interface Props {
  children: ReactNode
  summary: ReactNode
  snap: Snap
  onSnapChange: (s: Snap) => void
}

export default function MobileBottomSheet({ children, summary, snap, onSnapChange }: Props) {
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800))
  const [dragDelta, setDragDelta] = useState(0)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const heightFor = (s: Snap) => Math.round(FRACTION[s] * vh)
  const currentH = Math.max(80, heightFor(snap) - dragDelta)

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return
    setDragDelta(e.touches[0].clientY - startY.current)
  }
  const onTouchEnd = () => {
    if (startY.current == null) return
    const finalH = heightFor(snap) - dragDelta
    const snaps: { key: Snap; h: number }[] = [
      { key: 'collapsed', h: heightFor('collapsed') },
      { key: 'mid', h: heightFor('mid') },
      { key: 'full', h: heightFor('full') },
    ]
    const closest = snaps.reduce((a, b) => (Math.abs(b.h - finalH) < Math.abs(a.h - finalH) ? b : a))
    startY.current = null
    setDragDelta(0)
    if (closest.key !== snap) onSnapChange(closest.key)
  }

  const dragging = startY.current != null

  return (
    <div
      className="md:hidden fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-pop flex flex-col z-[800] border-t border-ink-200"
      style={{
        height: `${currentH}px`,
        transition: dragging ? 'none' : 'height 200ms ease-out',
      }}
    >
      <div
        className="cursor-grab select-none touch-none flex flex-col items-center pt-2 pb-2 shrink-0 border-b border-ink-100"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => onSnapChange(snap === 'full' ? 'mid' : snap === 'mid' ? 'full' : 'mid')}
      >
        <div className="w-10 h-1.5 bg-ink-300 rounded-full" />
        <div className="mt-1.5 text-[11px] uppercase tracking-wider font-semibold text-ink-500">
          {summary}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  )
}
