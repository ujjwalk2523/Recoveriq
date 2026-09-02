'use client';

import React, { useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

interface CursorCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxMovement?: number;
  highlightColor?: string;
}

export default function CursorCard({
  children,
  className = '',
  maxMovement = 4,
  highlightColor = 'rgba(15, 23, 42, 0.035)',
  ...props
}: CursorCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const springConfig = { stiffness: 260, damping: 22, mass: 0.1 };
  const transX = useSpring(0, springConfig);
  const transY = useSpring(0, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const offsetX = Math.max(-maxMovement, Math.min(maxMovement, (x - centerX) * 0.04));
    const offsetY = Math.max(-maxMovement, Math.min(maxMovement, (y - centerY) * 0.04));

    transX.set(offsetX);
    transY.set(offsetY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    transX.set(0);
    transY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        x: transX,
        y: transY,
      }}
      className={`relative overflow-hidden rounded-2xl border transition-colors duration-200 ${
        isHovered
          ? 'border-slate-300 shadow-md'
          : 'border-slate-200/90 shadow-xs'
      } ${className}`}
      {...(props as any)}
    >
      {/* Subtle internal radial light follow */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${highlightColor}, transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
