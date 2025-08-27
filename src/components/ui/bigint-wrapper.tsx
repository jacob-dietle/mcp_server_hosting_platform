'use client';

import React from 'react';

/**
 * SafeBigInt - A utility component to safely handle BigInt values in React components
 * 
 * This wrapper handles the React type incompatibility with BigInt by converting
 * BigInt values to strings when used in React contexts (like keys or displayed values).
 * 
 * Usage examples:
 * <SafeBigInt value={123456789123456789123n} />
 * <div key={<SafeBigInt value={123n} keyOnly />} />
 */
interface SafeBigIntProps {
  value: bigint | number;
  keyOnly?: boolean;
  className?: string;
}

export const SafeBigInt: React.FC<SafeBigIntProps> = ({ 
  value, 
  keyOnly = false,
  className
}) => {
  // Handle both BigInt and regular numbers
  const stringValue = value.toString();
  
  // When used for keys only, return a string that can be used as a key
  if (keyOnly) {
    return stringValue;
  }
  
  // Otherwise render the value
  return <span className={className}>{stringValue}</span>;
};

/**
 * withSafeBigInt - A higher-order component to work with components that need to accept BigInt values
 * 
 * Usage example:
 * const SafeComponent = withSafeBigInt(UnsafeComponent);
 * <SafeComponent bigIntValue={123456789123456789123n} />
 */
export function withSafeBigInt<
  P extends { [key: string]: unknown }
>(Component: React.ComponentType<P>) {
  return function WrappedComponent(props: P) {
    // Create a new props object with all BigInt values converted to strings
    const safeProps = Object.entries(props).reduce(
      (acc, [key, value]) => {
        // If value is BigInt, convert to string
        if (typeof value === 'bigint') {
          // Type assertion for dynamic property assignment
          (acc as Record<string, unknown>)[key] = value.toString();
        } else {
          // Type assertion for dynamic property assignment
          (acc as Record<string, unknown>)[key] = value;
        }
        return acc;
      },
      {} as P
    );
    
    return <Component {...safeProps} />;
  };
}

/**
 * Utility function to safely use BigInt values as React keys
 */
export function safeBigIntKey(value: bigint | number): string {
  return value.toString();
} 
