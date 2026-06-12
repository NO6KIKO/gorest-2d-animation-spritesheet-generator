import { AnimationSprite } from "./types";

// Helper to generate the Golden Coin 3D Spin Preset (12 frames)
function generateCoinPreset(): string[] {
  const frames: string[] = [];
  const totalFrames = 12;

  for (let i = 0; i < totalFrames; i++) {
    const angle = (i * Math.PI * 2) / totalFrames;
    const cosAngle = Math.cos(angle);
    const absCos = Math.abs(cosAngle);
    
    // Light reflection shifts based on the angle
    const reflectionOffset = 128 + 60 * cosAngle;
    // Core gold colors change depending on front vs back spin
    const strokeColor = cosAngle > 0 ? "#B38F00" : "#806600";
    const coinInnerFill = cosAngle > 0 ? "url(#goldCore)" : "url(#goldCoreDark)";
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
      <defs>
        <radialGradient id="goldCore" cx="45%" cy="45%" r="55%">
          <stop offset="0%" stop-color="#FFEFA6" />
          <stop offset="60%" stop-color="#F5C024" />
          <stop offset="100%" stop-color="#B28407" />
        </radialGradient>
        <radialGradient id="goldCoreDark" cx="45%" cy="45%" r="55%">
          <stop offset="0%" stop-color="#EBC444" />
          <stop offset="70%" stop-color="#B88A14" />
          <stop offset="100%" stop-color="#6E5002" />
        </radialGradient>
        <linearGradient id="reflection" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
          <stop offset="25%" stop-color="#FFFFFF" stop-opacity="0.0" />
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      
      <!-- Coin Shadow on floor -->
      <ellipse cx="128" cy="220" rx="${90 * (0.8 + 0.1 * Math.sin(angle))}" ry="12" fill="#000000" fill-opacity="0.25" />
      
      <!-- Main Coin Body -->
      <g transform="translate(128, 128)">
        <!-- Outer Golden Ring -->
        <ellipse cx="0" cy="0" rx="${100 * absCos}" ry="100" fill="#E6B800" stroke="${strokeColor}" stroke-width="8" />
        
        <!-- Inner Ring -->
        <ellipse cx="0" cy="0" rx="${74 * absCos}" ry="74" fill="${coinInnerFill}" stroke="#FFDF4D" stroke-width="4" />
        
        <!-- Central Coin Symbol (Embossed Star) if visible -->
        ${absCos > 0.15 ? `
        <polygon 
          points="0,-35 10,-10 35,-10 15,10 22,35 0,20 -22,35 -15,10 -35,-10 -10,-10"
          fill="#FFF" 
          fill-opacity="0.85" 
          stroke="#997A00" 
          stroke-width="3"
          transform="scale(${absCos}, 1)" 
        />` : ""}
        
        <!-- Dynamic specular reflection sweep -->
        <ellipse cx="0" cy="0" rx="${84 * absCos}" ry="84" fill="url(#reflection)" opacity="0.3" transform="rotate(${-30 + 15 * Math.sin(angle)})" />
      </g>
    </svg>`;
    
    frames.push(svg);
  }
  return frames;
}

// Helper to generate the Squishy Green Slime Preset (12 frames)
function generateSlimePreset(): string[] {
  const frames: string[] = [];
  const totalFrames = 12;

  for (let i = 0; i < totalFrames; i++) {
    const phase = (i * Math.PI * 2) / totalFrames;
    
    // Physics bouncing squish: stretches high, then squashes short
    const scaleY = 1.0 + 0.2 * Math.sin(phase);
    const scaleX = 1.0 / Math.sqrt(scaleY); // Conserve volume
    
    // Calculate wobble degree for idle breathing swing
    const wobbleAngle = 4 * Math.cos(phase * 2);
    
    // Eyes look slightly left/right as phase moves
    const eyeLookX = 8 * Math.sin(phase);
    // Face bobble offset
    const faceBobY = 15 * (scaleY - 1.0);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
      <defs>
        <radialGradient id="slimeBodyGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#4ADE80" />
          <stop offset="60%" stop-color="#22C55E" />
          <stop offset="100%" stop-color="#15803D" />
        </radialGradient>
        <radialGradient id="highlight" cx="30%" cy="30%" r="40%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
        </radialGradient>
      </defs>
      
      <!-- Slime Shadow with scale sync -->
      <ellipse cx="128" cy="216" rx="${75 * scaleX}" ry="${12 * (2.0 - scaleY)}" fill="#061D09" fill-opacity="0.35" />

      <!-- Wobbling squishy group -->
      <g transform="translate(128, 210) scale(${scaleX}, ${scaleY}) rotate(${wobbleAngle}) translate(-128, -210)">
        
        <!-- Main Body Path: Beautiful curvy droplets -->
        <path d="M 60 210 C 50 140, 70 80, 128 80 C 186 80, 206 140, 196 210 C 196 220, 60 220, 60 210 Z" fill="url(#slimeBodyGrad)" stroke="#14532D" stroke-width="8" />
        
        <!-- Sleek light overlay -->
        <ellipse cx="100" cy="115" rx="20" ry="10" fill="url(#highlight)" transform="rotate(-15, 100, 115)" />
        
        <!-- Liquid bottom shine -->
        <path d="M 75 195 A 50 50 0 0 0 181 195" fill="none" stroke="#86EFAC" stroke-width="4" stroke-linecap="round" />

        <!-- Cute Anime Face (bobbing and looking) -->
        <g transform="translate(${eyeLookX}, ${faceBobY})">
          <!-- Left Eye -->
          <circle cx="105" cy="155" r="9" fill="#0F172A" />
          <circle cx="102" cy="152" r="3" fill="#FFF" />
          
          <!-- Right Eye -->
          <circle cx="151" cy="155" r="9" fill="#0F172A" />
          <circle cx="148" cy="152" r="3" fill="#FFF" />
          
          <!-- Cute cheeks rosy blush -->
          <ellipse cx="91" cy="162" rx="7" ry="4" fill="#F43F5E" fill-opacity="0.5" />
          <ellipse cx="165" cy="162" rx="7" ry="4" fill="#F43F5E" fill-opacity="0.5" />
          
          <!-- Wobbly happy mouth -->
          <path d="M 123 162 Q 128 ${166 + 3 * Math.sin(phase * 2)} 133 162" fill="none" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" />
        </g>
      </g>
    </svg>`;

    frames.push(svg);
  }
  return frames;
}

// Helper to generate the Flying Bat flight cycle (16 frames)
function generateBatPreset(): string[] {
  const frames: string[] = [];
  const totalFrames = 16;

  for (let i = 0; i < totalFrames; i++) {
    const angle = (i * Math.PI * 2) / totalFrames;
    
    // Wing oscillation (-1 to +1)
    const flap = Math.sin(angle);
    
    // Smooth airborne bobbing (swaying up and down, matching flaps)
    const bobY = 12 * Math.cos(angle);
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
      <defs>
        <radialGradient id="batBodyGrad" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#4F46E5" />
          <stop offset="70%" stop-color="#312E81" />
          <stop offset="100%" stop-color="#1E1B4B" />
        </radialGradient>
      </defs>
      
      <!-- Ground Shadow (shrinks when bat is high) -->
      <ellipse cx="128" cy="225" rx="${60 - bobY * 0.8}" ry="8" fill="#000000" fill-opacity="${0.25 - (bobY * 0.008)}" />
      
      <!-- Bat Container bobbed -->
      <g transform="translate(0, ${bobY})">
        
        <!-- Left Wing Wingtips and membrane -->
        <g stroke="#1E1B4B" stroke-width="4.5" stroke-linejoin="round">
          <!-- Back wing layer -->
          <path d="M 108 125 C 80 ${125 + 90 * flap}, 40 ${125 - 60 * flap}, 25 ${125 - 30 * flap} 
                   C 45 ${125 - 10 * flap}, 65 ${125 + 15 * flap}, 85 ${125 + 10} Z" 
                fill="#312E81" />
          <path d="M 108 125 L 25 ${125 - 30 * flap} L 55 ${125 + 15 * flap} L 108 125" fill="#4338CA" />
        </g>

        <!-- Right Wing Wingtips and membrane -->
        <g stroke="#1E1B4B" stroke-width="4.5" stroke-linejoin="round">
          <!-- Back wing layer -->
          <path d="M 148 125 C 176 ${125 + 90 * flap}, 216 ${125 - 60 * flap}, 231 ${125 - 30 * flap} 
                   C 211 ${125 - 10 * flap}, 191 ${125 + 15 * flap}, 171 ${125 + 10} Z" 
                fill="#312E81" />
          <path d="M 148 125 L 231 ${125 - 30 * flap} L 201 ${125 + 15 * flap} L 148 125" fill="#4338CA" />
        </g>

        <!-- Cute Round Body -->
        <circle cx="128" cy="125" r="24" fill="url(#batBodyGrad)" stroke="#1E1B4B" stroke-width="5" />
        
        <!-- Left Bat Ear -->
        <polygon points="108,106 112,85 120,103" fill="#1E1B4B" stroke="#1E1B4B" stroke-width="3" />
        <!-- Right Bat Ear -->
        <polygon points="148,106 144,85 136,103" fill="#1E1B4B" stroke="#1E1B4B" stroke-width="3" />

        <!-- Glowing Vampire Eyes -->
        <circle cx="118" cy="120" r="4.5" fill="#EF4444" />
        <circle cx="116" cy="118" r="1.5" fill="#FFF" />
        
        <circle cx="138" cy="120" r="4.5" fill="#EF4444" />
        <circle cx="136" cy="118" r="1.5" fill="#FFF" />

        <!-- Cute vampire fangs showing depending on bob -->
        <path d="M 124 135 L 126 140 L 128 135 L 130 140 L 132 135" fill="none" stroke="#FFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>`;

    frames.push(svg);
  }
  return frames;
}

// Helper to generate the Fire Tornado / Magic Plasma Preset (12 frames)
function generateFirePreset(): string[] {
  const frames: string[] = [];
  const totalFrames = 12;

  for (let i = 0; i < totalFrames; i++) {
    const angle = (i * Math.PI * 2) / totalFrames;
    
    // Core radius pulses beautifully
    const pulseRad = 32 + 4 * Math.sin(angle * 3);
    const particleSpin = angle; // 1 rotation per loop

    // Programmatically generate dancing fire spurs
    const p1X = 120 + 40 * Math.cos(particleSpin);
    const p1Y = 128 + 25 * Math.sin(particleSpin * 2);
    const p1Size = 14 + 6 * Math.sin(particleSpin);

    const p2X = 136 + 45 * Math.cos(particleSpin + Math.PI);
    const p2Y = 120 + 35 * Math.sin(particleSpin + Math.PI);
    const p2Size = 12 + 5 * Math.cos(particleSpin);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
      <defs>
        <radialGradient id="fireCoreGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="40%" stop-color="#FDE047" />
          <stop offset="75%" stop-color="#EA580C" />
          <stop offset="100%" stop-color="#991B1B" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowingSpur" cx="40%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#FB7185" />
          <stop offset="60%" stop-color="#BE185D" />
          <stop offset="100%" stop-color="#500724" stop-opacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Ambient Floor Glow -->
      <ellipse cx="128" cy="220" rx="90" ry="15" fill="#E11D48" fill-opacity="0.15" filter="url(#glow)" />
      
      <!-- Energy Ring orbits -->
      <ellipse cx="128" cy="128" rx="85" ry="50" fill="none" stroke="#F43F5E" stroke-width="1.5" stroke-opacity="0.3" stroke-dasharray="10 6" transform="rotate(${-15 + i * 10}, 128, 128)" />
      <ellipse cx="128" cy="128" rx="70" ry="40" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-opacity="0.25" stroke-dasharray="15 8" transform="rotate(${30 - i * 15}, 128, 128)" />

      <!-- Energy core inside a group with glowing filter -->
      <g filter="url(#glow)">
        <!-- Rotating flame tails -->
        <path d="M 128 78 C 170 120, ${150 + 20 * Math.sin(angle)}, 170, 128 178 C ${106 - 20 * Math.cos(angle)}, 170, 86, 120, 128 78 Z" fill="url(#fireCoreGrad)" transform="rotate(${i * 30}, 128, 128)" />
        
        <!-- Center hot core -->
        <circle cx="128" cy="128" r="${pulseRad}" fill="url(#fireCoreGrad)" />
        
        <!-- Fire Spur Particle 1 -->
        <circle cx="${p1X}" cy="${p1Y}" r="${p1Size}" fill="url(#glowingSpur)" />
        <!-- Fire Spur Particle 2 -->
        <circle cx="${p2X}" cy="${p2Y}" r="${p2Size}" fill="url(#glowingSpur)" opacity="0.8" />
        
        <!-- Magical Sparks rising -->
        <circle cx="${110 + 10 * Math.sin(angle + 1)}" cy="${100 - (i * 4) % 60}" r="${2 + i % 3}" fill="#FFF" opacity="${0.6 + 0.4 * Math.sin(angle)}" />
        <circle cx="${140 + 8 * Math.cos(angle + 3)}" cy="${110 - ((i + 6) * 4) % 65}" r="${1 + i % 4}" fill="#FFEFA6" opacity="${0.5 + 0.5 * Math.cos(angle)}" />
      </g>
    </svg>`;

    frames.push(svg);
  }
  return frames;
}

export const PRESET_SPRITES: AnimationSprite[] = [
  {
    id: "preset_slime",
    characterName: "Squishy Neon Slime",
    description: "A liquid bouncy slime jump and wobble cycle mimicking organic gelatin squashing.",
    frameCount: 12,
    style: "Vibrant Vector",
    prompt: "A neon green organic squishy slime landing, expanding, and bouncing upward with cute blinking anim.",
    frames: generateSlimePreset(),
    createdTime: new Date().toISOString(),
    isPreset: true
  },
  {
    id: "preset_coin",
    characterName: "Golden Arcade Coin",
    description: "A continuous 3D rotating gold coin with active shininess reflection and shading sweep.",
    frameCount: 12,
    style: "Shiny Vector Art",
    prompt: "An isometric gold coin rotating 360 degrees horizontally on a shiny metallic gradient layer.",
    frames: generateCoinPreset(),
    createdTime: new Date().toISOString(),
    isPreset: true
  },
  {
    id: "preset_bat",
    characterName: "Midnight Twilight Bat",
    description: "A 16-frame wings-flapping flight cycle with smooth harmonic body sway and red eyes.",
    frameCount: 16,
    style: "Clean Vector Profile",
    prompt: "A twilight dark blue vampire bat flying with active wing span flapping and body height bobbing.",
    frames: generateBatPreset(),
    createdTime: new Date().toISOString(),
    isPreset: true
  },
  {
    id: "preset_fire",
    characterName: "Cosmic Plasma Core",
    description: "A rotating magical fireball explosion core containing glowing sparks and heat waves.",
    frameCount: 12,
    style: "Dreamy Magic Vector",
    prompt: "A magic fire or plasma core swirling with floating dust elements, sparks, and rotating thermal emissions.",
    frames: generateFirePreset(),
    createdTime: new Date().toISOString(),
    isPreset: true
  }
];
