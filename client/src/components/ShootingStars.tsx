import React, { useEffect, useRef } from 'react'

interface ShootingStarsProps {
  className?: string
}

const ShootingStars: React.FC<ShootingStarsProps> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#98D8E8', '#F7DC6F'
    ]

    // Speed parameters
    const SHOOTING_STAR_SPEED = 0.8
    const PROMINENT_STAR_SPEED = 0.6
    const ORB_SPEED = 0.4

    const stars: ShootingStar[] = []
    const orbs: FloatingOrb[] = []
    let specialStar: ShootingStar | null = null
    let prominentStar: ProminentStar | null = null
    let time = 0
    let lastProminentStar = 0

    class ShootingStar {
      x: number
      y: number
      speed: number
      color: string
      opacity: number
      life: number
      maxLife: number
      trailLength: number
      size: number
      isSpecial: boolean
      baseY: number
      amplitude: number
      frequency: number

      constructor(isSpecial = false) {
        this.x = -50
        this.y = Math.random() * (canvas?.height || window.innerHeight)
        this.speed = SHOOTING_STAR_SPEED + Math.random() * 0.4
        this.color = colors[Math.floor(Math.random() * colors.length)]
        this.opacity = 0
        this.life = 0
        this.maxLife = 400 + Math.random() * 200
        this.trailLength = isSpecial ? 120 : 60
        this.size = isSpecial ? 3 : 1.5
        this.isSpecial = isSpecial
        this.baseY = this.y
        this.amplitude = isSpecial ? 40 : 0
        this.frequency = 0.005
      }

      update(): boolean {
        this.life++
        this.x += this.speed
        
        if (this.isSpecial) {
          this.y = this.baseY + Math.sin(this.x * this.frequency) * this.amplitude
        }

        // Fade based on position
        if (this.x < 50) {
          this.opacity = Math.min(1, this.x / 50)
        } else if (this.x > (canvas?.width || window.innerWidth) - 100) {
          this.opacity = Math.max(0, ((canvas?.width || window.innerWidth) + 50 - this.x) / 150)
        } else {
          this.opacity = 1
        }

        return this.x < (canvas?.width || window.innerWidth) + 200
      }

      draw() {
        if (!ctx) return
        
        ctx.save()
        
        // Draw trail
        const gradient = ctx.createLinearGradient(
          this.x - this.trailLength, this.y,
          this.x, this.y
        )
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(0.7, this.color + '80')
        gradient.addColorStop(1, this.color)

        ctx.fillStyle = gradient
        ctx.fillRect(
          this.x - this.trailLength, 
          this.y - this.size/2, 
          this.trailLength, 
          this.size
        )

        // Draw star
        ctx.fillStyle = this.color
        ctx.globalAlpha = this.opacity
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()

        if (this.isSpecial) {
          ctx.shadowColor = this.color
          ctx.shadowBlur = 15
          ctx.beginPath()
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }
    }

    class FloatingOrb {
      x: number
      y: number
      speed: number
      color: string
      opacity: number
      life: number
      maxLife: number
      size: number
      drift: number
      pulse: number

      constructor() {
        this.x = Math.random() * (canvas?.width || window.innerWidth)
        this.y = (canvas?.height || window.innerHeight) + 20
        this.speed = ORB_SPEED + Math.random() * 0.3
        this.color = colors[Math.floor(Math.random() * colors.length)]
        this.opacity = 0
        this.life = 0
        this.maxLife = 600 + Math.random() * 300
        this.size = 2 + Math.random() * 3
        this.drift = (Math.random() - 0.5) * 0.3
        this.pulse = Math.random() * Math.PI * 2
      }

      update(): boolean {
        this.life++
        this.y -= this.speed
        this.x += this.drift
        this.pulse += 0.015

        // Fade in and out
        if (this.life < 50) {
          this.opacity = this.life / 50 * 0.6
        } else if (this.life > this.maxLife - 80) {
          this.opacity = (this.maxLife - this.life) / 80 * 0.6
        } else {
          this.opacity = 0.6 + Math.sin(this.pulse) * 0.2
        }

        return this.y > -20 && this.life < this.maxLife
      }

      draw() {
        if (!ctx) return
        
        ctx.save()
        ctx.globalAlpha = this.opacity
        
        // Glow effect
        ctx.shadowColor = this.color
        ctx.shadowBlur = 10
        
        ctx.fillStyle = this.color
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.restore()
      }
    }

    class ProminentStar {
      x: number
      y: number
      targetX: number
      targetY: number
      speed: number
      color: string
      opacity: number
      life: number
      maxLife: number
      size: number
      trailLength: number
      progress: number

      constructor() {
        this.x = -100
        this.y = (canvas?.height || window.innerHeight) + 50
        this.targetX = (canvas?.width || window.innerWidth) + 100
        this.targetY = -50
        this.speed = PROMINENT_STAR_SPEED
        this.color = '#FFD700'
        this.opacity = 0
        this.life = 0
        this.maxLife = 1000
        this.size = 5
        this.trailLength = 200
        this.progress = 0
      }

      update(): boolean {
        this.life++
        this.progress = this.life / this.maxLife
        
        // Diagonal movement
        this.x = this.x + (this.targetX - this.x) * 0.004
        this.y = this.y + (this.targetY - this.y) * 0.004

        // Fade in and out
        if (this.life < 80) {
          this.opacity = this.life / 80
        } else if (this.life > this.maxLife - 150) {
          this.opacity = (this.maxLife - this.life) / 150
        } else {
          this.opacity = 1
        }

        return this.life < this.maxLife
      }

      draw() {
        if (!ctx) return
        
        ctx.save()
        
        // Calculate trail direction
        const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x)
        const trailEndX = this.x - Math.cos(angle) * this.trailLength
        const trailEndY = this.y - Math.sin(angle) * this.trailLength
        
        // Draw trail
        const gradient = ctx.createLinearGradient(
          trailEndX, trailEndY,
          this.x, this.y
        )
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(0.3, this.color + '40')
        gradient.addColorStop(0.7, this.color + '80')
        gradient.addColorStop(1, this.color)

        ctx.strokeStyle = gradient
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.moveTo(trailEndX, trailEndY)
        ctx.lineTo(this.x, this.y)
        ctx.stroke()

        // Draw bright star
        ctx.globalAlpha = this.opacity
        ctx.shadowColor = this.color
        ctx.shadowBlur = 20
        ctx.fillStyle = this.color
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
        
        // Inner glow
        ctx.shadowBlur = 5
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }
    }

    const createShootingStar = () => {
      if (Math.random() < 0.075) {
        stars.push(new ShootingStar())
      }
    }

    const createSpecialStar = () => {
      if (!specialStar && Math.random() < 0.005) {
        specialStar = new ShootingStar(true)
      }
    }

    const createFloatingOrb = () => {
      if (Math.random() < 0.02) {
        orbs.push(new FloatingOrb())
      }
    }

    const createProminentStar = () => {
      if (!prominentStar && time - lastProminentStar > 900) {
        prominentStar = new ProminentStar()
        lastProminentStar = time
      }
    }

    const animate = () => {
      if (!ctx || !canvas) return
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      time++
      
      createShootingStar()
      createSpecialStar()
      createFloatingOrb()
      createProminentStar()

      // Update and draw regular stars
      for (let i = stars.length - 1; i >= 0; i--) {
        if (!stars[i].update()) {
          stars.splice(i, 1)
        } else {
          stars[i].draw()
        }
      }

      // Update and draw floating orbs
      for (let i = orbs.length - 1; i >= 0; i--) {
        if (!orbs[i].update()) {
          orbs.splice(i, 1)
        } else {
          orbs[i].draw()
        }
      }

      // Update and draw special star
      if (specialStar) {
        if (!specialStar.update()) {
          specialStar = null
        } else {
          specialStar.draw()
        }
      }

      // Update and draw prominent star
      if (prominentStar) {
        if (!prominentStar.update()) {
          prominentStar = null
        } else {
          prominentStar.draw()
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed top-0 left-0 w-full h-full pointer-events-none z-0 ${className}`}
      style={{ background: 'transparent' }}
    />
  )
}

export default ShootingStars
