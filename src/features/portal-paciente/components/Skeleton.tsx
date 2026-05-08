/**
 * Skeleton
 * Loading state placeholder — dark-first animated skeleton
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`bg-white/5 rounded-lg animate-pulse ${className}`} />
);
