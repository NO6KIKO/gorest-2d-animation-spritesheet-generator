import type { CSSProperties } from "react";
import { CheckCircle2, Film, Plus } from "lucide-react";
import { spriteFrame } from "../../domain/sprites/spriteUtils";
import type { ActionBinding, ActionTriggerType, AnimationSprite, AssetRole } from "../../types";

type CurrentActionPanelProps = {
  activeFrame: number;
  activeSprite: AnimationSprite;
  binding: ActionBinding;
  checkerStyle: CSSProperties;
  frameHeight: number;
  frameWidth: number;
  role: AssetRole;
  roleLabels: Record<AssetRole, string>;
  tagsText: string;
  triggerLabels: Record<ActionTriggerType, string>;
  onBindingChange: (binding: ActionBinding) => void;
  onInsertActiveSprite: () => void;
  onRoleChange: (role: AssetRole) => void;
  onSaveAsset: () => void;
  onTagsTextChange: (value: string) => void;
};

export function CurrentActionPanel({
  activeFrame,
  activeSprite,
  binding,
  checkerStyle,
  frameHeight,
  frameWidth,
  role,
  roleLabels,
  tagsText,
  triggerLabels,
  onBindingChange,
  onInsertActiveSprite,
  onRoleChange,
  onSaveAsset,
  onTagsTextChange,
}: CurrentActionPanelProps) {
  return (
    <section>
      <div className="section-title"><Film size={17} /> Current Action</div>
      <div className="asset-preview-card">
        <div className="mini-preview large" style={checkerStyle}>
          <div dangerouslySetInnerHTML={{ __html: spriteFrame(activeSprite, activeFrame) }} />
        </div>
        <strong>{activeSprite.characterName}</strong>
        <span>{activeSprite.frames.length} frames / {frameWidth} x {frameHeight}</span>
      </div>

      <label>Action Name</label>
      <input value={binding.actionName} onChange={event => onBindingChange({ ...binding, actionName: event.target.value })} />

      <div className="two-col">
        <div>
          <label>Asset Role</label>
          <select value={role} onChange={event => onRoleChange(event.target.value as AssetRole)}>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label>Trigger Type</label>
          <select value={binding.triggerType} onChange={event => onBindingChange({ ...binding, triggerType: event.target.value as ActionTriggerType })}>
            {Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <label>Trigger Value</label>
      <input value={binding.triggerValue} onChange={event => onBindingChange({ ...binding, triggerValue: event.target.value })} placeholder="Example: KeyD / click / player.walk" />

      <label>Game State</label>
      <input value={binding.gameState} onChange={event => onBindingChange({ ...binding, gameState: event.target.value })} />

      <label>Tags</label>
      <input value={tagsText} onChange={event => onTagsTextChange(event.target.value)} />

      <button className="primary-button full" type="button" onClick={onSaveAsset}><CheckCircle2 size={16} /> Save as Confirmed Asset</button>
      <button className="ghost-button full" type="button" onClick={onInsertActiveSprite}><Plus size={16} /> Insert Current Action into Scene</button>
    </section>
  );
}
