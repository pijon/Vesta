import React, { useMemo } from 'react';

interface RecipeIllustrationProps {
  name: string;
  ingredients?: string[]; 
  type?: string;
  className?: string;
}

export const RecipeIllustration: React.FC<RecipeIllustrationProps> = ({ name, type = 'main meal', className = '' }) => {
  // Deterministic seed
  const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const getTheme = () => {
      const t = (type || 'main meal').toLowerCase();
      if (t.includes('breakfast')) {
          // Warm/Sunrise
          return { bg: '#FFF7ED', primary: '#FDBA74', secondary: '#FED7AA', accent: '#F97316' }; 
      } else if (t.includes('snack')) {
          // Pink/Playful
          return { bg: '#FDF2F8', primary: '#F472B6', secondary: '#FBCFE8', accent: '#DB2777' };
      } else if (t.includes('main') || t.includes('dinner') || t.includes('lunch')) {
          // Indigo/Calm (used for Main Meal)
          return { bg: '#EEF2FF', primary: '#818CF8', secondary: '#C7D2FE', accent: '#4F46E5' };
      } else if (t.includes('light')) {
           // Teal/Fresh
           return { bg: '#F0FDFA', primary: '#2DD4BF', secondary: '#99F6E4', accent: '#0D9488' };
      } else {
          // Green/Natural
          return { bg: '#F0FDF4', primary: '#4ADE80', secondary: '#BBF7D0', accent: '#16A34A' };
      }
  };

  const theme = getTheme();
  
  // Generate geometric composition
  const shapes = useMemo(() => {
    const shapeCount = 3 + Math.floor(random(1) * 3); // 3 to 5 shapes
    return Array.from({ length: shapeCount }).map((_, i) => {
        const shapeType = Math.floor(random(i) * 3); // 0: Circle, 1: Rect, 2: Arc
        const x = 10 + random(i + 1) * 80;
        const y = 10 + random(i + 2) * 80;
        const size = 20 + random(i + 3) * 40;
        const color = random(i + 4) > 0.5 ? theme.primary : theme.secondary;
        const rotation = random(i + 5) * 360;
        
        return { shapeType, x, y, size, color, rotation };
    });
  }, [name, theme]);

  return (
    <div className={`overflow-hidden relative ${className}`} style={{ backgroundColor: theme.bg }}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
         <defs>
            <filter id="grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch"/>
                <feColorMatrix type="saturate" values="0" />
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.1" /> 
                </feComponentTransfer>
            </filter>
         </defs>

         {/* Abstract Geometric Shapes */}
         {shapes.map((s, i) => (
             <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.rotation})`}>
                 {s.shapeType === 0 && (
                     <circle r={s.size / 2} fill={s.color} />
                 )}
                 {s.shapeType === 1 && (
                     <rect x={-s.size/2} y={-s.size/2} width={s.size} height={s.size} rx={s.size/4} fill={s.color} />
                 )}
                 {s.shapeType === 2 && (
                    <path d={`M -${s.size/2} 0 A ${s.size/2} ${s.size/2} 0 0 1 ${s.size/2} 0`} fill={s.color} />
                 )}
             </g>
         ))}

         {/* Center Icon/Letter based on Type */}
         <g transform="translate(50 50)">
             <circle r="18" fill="white" fillOpacity="0.9" />
             <text 
                x="0" 
                y="0" 
                dominantBaseline="central" 
                textAnchor="middle" 
                fill={theme.accent} 
                fontSize="16" 
                fontFamily="serif" 
                fontWeight="bold"
             >
                {name.charAt(0).toUpperCase()}
             </text>
         </g>

         {/* Grain Texture Overlay */}
         <rect width="100%" height="100%" filter="url(#grain)" opacity="0.4" style={{ mixBlendMode: 'multiply' }}/>
      </svg>
    </div>
  );
};