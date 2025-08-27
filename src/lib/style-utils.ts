/**
 * Reusable style utility constants for consistent styling across the application
 * Using Tactical Intelligence color palette
 */

// Container classes for consistent layout
export const containerClasses = "container mx-auto px-4 sm:px-6 lg:px-8"

// Spacing system
export const spacingSystem = {
  xs: 'space-y-2',  // 8px
  sm: 'space-y-3',  // 12px
  md: 'space-y-4',  // 16px
  lg: 'space-y-6',  // 24px
  xl: 'space-y-8',  // 32px
  '2xl': 'space-y-12', // 48px
}

// Section spacing classes - optimized for better visual rhythm
export const sectionClasses = {
  default: "py-8 md:py-12", // Reduced from py-12 md:py-20
  compact: "py-6 md:py-8",
  hero: "pt-4 pb-8 lg:pt-6 lg:pb-12", // Reduced top/bottom padding
}

// Heading typography classes
export const headingClasses = {
  h1: "text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl",
  h2: "text-3xl font-bold tracking-tight sm:text-4xl",
  h3: "text-2xl font-bold",
  h4: "text-xl font-bold",
  subtitle: "text-lg text-muted-foreground"
}

// Card styles for consistent UI components
export const cardClasses = {
  default: "rounded-lg border bg-card p-6 shadow-sm",
  interactive: "rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50",
  highlighted: "rounded-lg border-2 border-primary bg-card p-6 shadow-md",
  surface: "rounded-lg bg-card border border-border p-6 shadow-sm",
  accent: "rounded-lg bg-accent/10 border border-accent/20 p-6 shadow-sm",
  status: {
    success: "rounded-lg bg-success/10 border border-success/20 p-6 shadow-sm",
    warning: "rounded-lg bg-warning/10 border border-warning/20 p-6 shadow-sm",
    error: "rounded-lg bg-destructive/10 border border-destructive/20 p-6 shadow-sm",
    info: "rounded-lg bg-info/10 border border-info/20 p-6 shadow-sm"
  }
}

// Button variants matching our design system
export const buttonClasses = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90", 
  outline: "border border-input bg-background hover:bg-accent/10 hover:text-accent-foreground",
  'outline-primary': "border border-primary bg-transparent text-primary hover:bg-primary/10",
  'outline-secondary': "border border-secondary bg-transparent text-secondary hover:bg-secondary/10",
  ghost: "hover:bg-accent/10 hover:text-accent-foreground",
  terminal: "bg-terminal-green text-dark-text hover:bg-terminal-green/90",
  success: "bg-success text-white hover:bg-success/90",
  warning: "bg-warning text-white hover:bg-warning/90",
  info: "bg-info text-white hover:bg-info/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
}

// Gradient backgrounds
export const gradientClasses = {
  primary: "bg-gradient-to-r from-primary-orange to-bright-orange",
  accent: "bg-gradient-to-r from-terminal-green to-terminal-green/80",
  dark: "bg-gradient-to-r from-dark-bg to-dark-surface"
}

// Status alert components
export const alertClasses = {
  success: "bg-success/10 text-success-green border border-success/20",
  warning: "bg-warning/10 text-warning-amber border border-warning/20",
  error: "bg-destructive/10 text-error-red border border-destructive/20",
  info: "bg-info/10 text-info-blue border border-info/20"
} 
