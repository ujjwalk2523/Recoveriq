'use client';

import React, { useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  maxDistance?: number;
}

export default function MagneticButton({
  children,
  className = '',
  maxDistance = 6,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const springConfig = { stiffness: 250, damping: 18, mass: 0.1 };
  const x = useSpring(0, springConfig);
  const y = useSpring(0, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;

    // Constrain to maxDistance
    const boundedX = Math.max(-maxDistance, Math.min(maxDistance, distanceX * 0.25));
    const boundedY = Math.max(-maxDistance, Math.min(maxDistance, distanceY * 0.25));

    x.set(boundedX);
    y.set(boundedY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      className="inline-block"
    >
      <button className={className} {...props}>
        {children}
      </button>
    </motion.div>
  );
}
