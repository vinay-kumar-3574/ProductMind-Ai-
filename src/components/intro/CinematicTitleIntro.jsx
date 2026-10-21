import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useApp } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import { Sparkles, ArrowRight } from 'lucide-react'

export function CinematicTitleIntro({ onComplete }) {
  const { setIntroSeen } = useApp()
  const { reducedMotion } = useTheme()
  const canvasRef = useRef(null)
  const [stage, setStage] = useState(0) // 0: init, 1: product mind, 2: AI, 3: subtitle, 4: transition out

  // Handle Skip
  const handleSkip = () => {
    setIntroSeen(true)
    if (onComplete) onComplete()
  }

  // Animation timeline progression
  useEffect(() => {
    if (reducedMotion) {
      handleSkip()
      return
    }

    const t1 = setTimeout(() => setStage(1), 300)   // Reveal "Product Mind"
    const t2 = setTimeout(() => setStage(2), 1600)  // Reveal "AI"
    const t3 = setTimeout(() => setStage(3), 2600)  // Reveal "Product Intelligence Workspace"
    const t4 = setTimeout(() => {
      setStage(4) // Fade out
      setTimeout(handleSkip, 700)
    }, 4600)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [reducedMotion])

  // Canvas Neural Network Nodes & Particles
  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animationFrameId
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Node particles
    const nodeCount = 45
    const nodes = []
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        radius: Math.random() * 2.5 + 1.5,
        color: i % 3 === 0 ? 'rgba(139, 92, 246, 0.7)' : i % 3 === 1 ? 'rgba(14, 165, 233, 0.7)' : 'rgba(99, 102, 241, 0.7)',
      })
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // Draw connections
      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.25
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }

      // Update and draw nodes
      nodes.forEach(node => {
        node.x += node.vx
        node.y += node.vy

        if (node.x < 0 || node.x > width) node.vx *= -1
        if (node.y < 0 || node.y > height) node.vy *= -1

        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = node.color
        ctx.shadowColor = 'rgba(139, 92, 246, 0.5)'
        ctx.shadowBlur = 10
        ctx.fill()
      })

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [reducedMotion])

  const titleWords = 'Product Mind'.split('')

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: stage === 4 ? 0 : 1, scale: stage === 4 ? 1.05 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy-950 overflow-hidden select-none"
      >
        {/* Background Neural Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none opacity-60" />

        {/* Ambient Gradient Glow Orbs */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-brand-600/20 blur-[120px] -top-20 -left-20 pointer-events-none animate-pulse-slow" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-electric-500/20 blur-[130px] -bottom-20 -right-20 pointer-events-none animate-pulse-slow" />

        {/* Center Title Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : -10 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-950/80 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6 shadow-glow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-electric-400 animate-spin-slow" />
            <span>Next-Generation SaaS Intelligence</span>
          </motion.div>

          {/* Title Reveal */}
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight flex items-center justify-center flex-wrap gap-x-4 mb-4">
            {/* "Product Mind" letters */}
            <span className="flex">
              {titleWords.map((char, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }}
                  animate={{
                    opacity: stage >= 1 ? 1 : 0,
                    y: stage >= 1 ? 0 : 25,
                    filter: stage >= 1 ? 'blur(0px)' : 'blur(8px)',
                  }}
                  transition={{
                    duration: 0.4,
                    delay: stage >= 1 ? index * 0.05 : 0,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300 inline-block"
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>
              ))}
            </span>

            {/* "AI" reveal second */}
            <motion.span
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{
                opacity: stage >= 2 ? 1 : 0,
                scale: stage >= 2 ? 1 : 0.8,
                y: stage >= 2 ? 0 : 20,
              }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-brand-400 to-electric-400 drop-shadow-[0_0_35px_rgba(139,92,246,0.6)] font-black"
            >
              AI
            </motion.span>
          </h1>

          {/* Exact Subtitle: Product Intelligence Workspace */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{
              opacity: stage >= 3 ? 1 : 0,
              y: stage >= 3 ? 0 : 15,
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-lg sm:text-2xl font-medium tracking-wide text-slate-300 max-w-2xl"
          >
            Product Intelligence Workspace
          </motion.p>
        </div>

        {/* Skip Intro Button */}
        <div className="absolute bottom-8 right-8 z-20">
          <button
            onClick={handleSkip}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold backdrop-blur-md transition-all shadow-lg hover:shadow-glow-sm cursor-pointer"
          >
            <span>Skip Intro</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
