import { motion } from 'motion/react'
import { MOTION_DURATION } from '../../constants/motion'

const PIECES = [
  { left: '5%', color: '#ef8a63', rotate: 70, x: -35, delay: 0, width: 7, height: 13 },
  { left: '13%', color: '#f4c95d', rotate: 140, x: 24, delay: 0.04, width: 6, height: 10 },
  { left: '21%', color: '#7eb39a', rotate: 210, x: -18, delay: 0.08, width: 8, height: 12 },
  { left: '30%', color: '#ef8a63', rotate: 270, x: 35, delay: 0.02, width: 5, height: 14 },
  { left: '39%', color: '#f4c95d', rotate: 330, x: -25, delay: 0.1, width: 8, height: 9 },
  { left: '48%', color: '#7eb39a', rotate: 80, x: 18, delay: 0.05, width: 6, height: 13 },
  { left: '57%', color: '#ef8a63', rotate: 160, x: -30, delay: 0.12, width: 7, height: 10 },
  { left: '66%', color: '#f4c95d', rotate: 250, x: 28, delay: 0.03, width: 5, height: 12 },
  { left: '75%', color: '#7eb39a', rotate: 320, x: -20, delay: 0.09, width: 8, height: 11 },
  { left: '84%', color: '#ef8a63', rotate: 100, x: 32, delay: 0.06, width: 6, height: 14 },
  { left: '92%', color: '#f4c95d', rotate: 200, x: -24, delay: 0.14, width: 7, height: 9 },
] as const

export default function Confetti() {
  return <div className="confetti" aria-hidden="true">{PIECES.map((piece, index) => <motion.i
    key={index}
    className="confetti-piece"
    style={{ left: piece.left, width: piece.width, height: piece.height, background: piece.color }}
    initial={{ opacity: 0, y: -12, rotate: 0 }}
    animate={{ opacity: [0, 1, 0], y: [0, 60 + index * 5], x: piece.x, rotate: piece.rotate }}
    transition={{ duration: MOTION_DURATION.celebration / 1000, delay: piece.delay, ease: 'easeOut' }}
  />)}</div>
}
