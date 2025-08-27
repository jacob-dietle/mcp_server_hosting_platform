'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface RotatingTextProps {
  items: string[]
  interval?: number
  className?: string
  containerClassName?: string
}

export function RotatingText({
  items,
  interval = 3000,
  className,
  containerClassName,
}: RotatingTextProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length)
        setIsAnimating(false)
      }, 500) // Animation duration
    }, interval)

    return () => clearInterval(timer)
  }, [items.length, interval])

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center bg-card rounded-md border h-8 overflow-hidden align-bottom',
        containerClassName
      )}
    >
      <span
        className={cn(
          'transition-transform duration-500 ease-in-out',
          isAnimating ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100',
          className
        )}
        key={currentIndex}
      >
        {items[currentIndex]}
      </span>
    </div>
  )
} 
