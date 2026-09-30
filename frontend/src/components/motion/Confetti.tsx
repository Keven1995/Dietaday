import { motion } from 'motion/react'
import { MOTION_DURATION } from '../../constants/motion'
import { createConfettiPieces, type ConfettiVariant } from '../../lib/confetti'

export default function Confetti({ variant }: { variant: ConfettiVariant }) {
  const pieces = createConfettiPieces(variant)
  return <div className={`confetti confetti-${variant}`} aria-hidden="true">{pieces.map((piece, index) => <motion.i
    key={index}
    className={`confetti-piece${piece.ribbon ? ' is-ribbon' : ''}`}
    style={{ left: piece.left, width: piece.width, height: piece.height, background: piece.color }}
    initial={{ opacity: 0, y: -12, rotate: 0, scale: 0.7 }}
    animate={{ opacity: [0, 1, 0], y: [0, piece.y], x: piece.x, rotate: piece.rotate, scale: [0.7, 1, 0.85] }}
    transition={{ duration: MOTION_DURATION.celebration / 1000, delay: piece.delay, ease: 'easeOut' }}
  />)}</div>
}
