import type { CSSProperties } from "react";
import { Keyboard } from "lucide-react";
import { spriteFrame } from "../../domain/sprites/spriteUtils";
import type { AnimationSprite } from "../../types";

type AvailableSpritesPanelProps = {
  activeSpriteId: string;
  checkerStyle: CSSProperties;
  sprites: AnimationSprite[];
  onSelectSprite: (sprite: AnimationSprite) => void;
};

export function AvailableSpritesPanel({ activeSpriteId, checkerStyle, sprites, onSelectSprite }: AvailableSpritesPanelProps) {
  return (
    <section>
      <div className="section-title"><Keyboard size={17} /> Available Sprites</div>
      <div className="sprite-list compact">
        {sprites.map(sprite => (
          <button key={sprite.id} type="button" className={sprite.id === activeSpriteId ? "sprite-card active" : "sprite-card"} onClick={() => onSelectSprite(sprite)}>
            <div className="mini-preview" style={checkerStyle}><div dangerouslySetInnerHTML={{ __html: spriteFrame(sprite, 0) }} /></div>
            <div><strong>{sprite.characterName}</strong><span>{sprite.frames.length} frames</span></div>
          </button>
        ))}
      </div>
    </section>
  );
}
