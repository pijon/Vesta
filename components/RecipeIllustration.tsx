import React, { useMemo } from 'react';

interface RecipeIllustrationProps {
  name: string;
  ingredients?: string[];
  type?: string;
  className?: string;
}

export const RecipeIllustration: React.FC<RecipeIllustrationProps> = ({ name, ingredients = [], type = 'lunch', className = '' }) => {
  // Deterministic random based on name hash
  const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  // Generate abstract shapes based on ingredients
  const shapes = useMemo(() => {
    // If no ingredients, generate some placeholders
    const items = ingredients.length > 0 ? ingredients : ['Item 1', 'Item 2', 'Item 3'];
    
    // Limit shapes to avoid clutter, but ensure enough density for empty plates
    const count = Math.min(items.length + 3, 12);

    return Array.from({ length: count }).map((_, i) => {
       const r = random(i);
       const r2 = random(i + 100);
       const r3 = random(i + 200);
       const r4 = random(i + 300);
       
       // Muted, organic ingredient colors
       const colors = [
           '#84CC16', // Lime
           '#22C55E', // Green
           '#EF4444', // Red
           '#F97316', // Orange
           '#EAB308', // Yellow
           '#14B8A6', // Teal
           '#F472B6', // Pink
           '#A8A29E', // Mushroom/Gray
           '#FEF3C7'  // Cream/Cheese
       ];
       const color = colors[Math.floor(r * colors.length)];
       
       // Position in circle (polar coordinates) distributed somewhat evenly
       // Use golden angle for organic distribution
       const angle = i * 2.39996 + (r2 * 0.5); 
       const dist = Math.sqrt(r3) * 35; // Radius 35
       
       const cx = 50 + Math.cos(angle) * dist;
       const cy = 50 + Math.sin(angle) * dist;
       
       // Size variation
       const size = 3 + r4 * 8;
       
       // Shape type (Circle, Rounded Rect, Triangle approximation)
       const shapeType = Math.floor(r2 * 3);

       return { cx, cy, size, color, shapeType, id: i, rotation: r * 360 };
    });
  }, [name, ingredients]);
  
  // Background color based on meal type (Muted, appetizing backgrounds)
  const getBgColor = () => {
      switch(type.toLowerCase()) {
          case 'breakfast': return '#FEF3C7'; // Warm Yellow
          case 'dinner': return '#E0E7FF'; // Cool Indigo
          case 'snack': return '#FCE7F3'; // Soft Pink
          default: return '#D4E0D1'; // Sage Green (Lunch)
      }
  };

  return (
    <div className={`overflow-hidden relative ${className}`} style={{ backgroundColor: getBgColor() }}>
       <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          {/* Subtle Texture/Pattern background */}
          <pattern id={`pattern-${seed}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
             <circle cx="2" cy="2" r="1" fill="rgba(0,0,0,0.03)" />
          </pattern>
          <rect width="100" height="100" fill={`url(#pattern-${seed})`} />

          {/* Plate Shadow */}
          <circle cx="50" cy="52" r="42" fill="rgba(0,0,0,0.1)" />
          
          {/* Main Plate */}
          <circle cx="50" cy="50" r="40" fill="#FFFFFF" />
          <circle cx="50" cy="50" r="36" fill="#F9FAFB" />
          
          {/* Ingredients */}
          {shapes.map(s => {
              if (s.shapeType === 0) {
                 return <circle key={s.id} cx={s.cx} cy={s.cy} r={s.size} fill={s.color} />;
              } else if (s.shapeType === 1) {
                 return (
                    <rect 
                        key={s.id} 
                        x={s.cx - s.size} 
                        y={s.cy - s.size} 
                        width={s.size*2} 
                        height={s.size*2} 
                        rx={s.size/2} 
                        fill={s.color} 
                        transform={`rotate(${s.rotation} ${s.cx} ${s.cy})`}
                    />
                 );
              } else {
                 // Triangle/Wedge
                 const p1 = `${s.cx},${s.cy - s.size}`;
                 const p2 = `${s.cx + s.size},${s.cy + s.size}`;
                 const p3 = `${s.cx - s.size},${s.cy + s.size}`;
                 return (
                    <polygon 
                        key={s.id} 
                        points={`${p1} ${p2} ${p3}`} 
                        fill={s.color} 
                        transform={`rotate(${s.rotation} ${s.cx} ${s.cy})`}
                    />
                 );
              }
          })}
          
          {/* Light Glare for depth */}
          <ellipse cx="50" cy="50" rx="38" ry="38" fill="url(#glare)" opacity="0.1" />
          <defs>
             <linearGradient id="glare" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="50%" stopColor="white" stopOpacity="0" />
             </linearGradient>
          </defs>
       </svg>
    </div>
  );
};
