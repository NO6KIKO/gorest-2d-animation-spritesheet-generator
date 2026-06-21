import type { ChangeEvent } from "react";
import { CheckCircle2, Plus, Upload } from "lucide-react";
import type { ActionTriggerType, AssetRole } from "../../types";

type SpritesheetImporterPanelProps = {
  actionName: string;
  assetName: string;
  columns: number;
  fileName: string;
  frameCount: number;
  frameHeight: number;
  frameWidth: number;
  gameState: string;
  importLoop: boolean;
  role: AssetRole;
  roleLabels: Record<AssetRole, string>;
  sheetSize: [number, number] | null;
  tagsText: string;
  triggerLabels: Record<ActionTriggerType, string>;
  triggerType: ActionTriggerType;
  triggerValue: string;
  onActionNameChange: (value: string) => void;
  onAssetNameChange: (value: string) => void;
  onColumnsChange: (value: number) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFrameCountChange: (value: number) => void;
  onFrameHeightChange: (value: number) => void;
  onFrameWidthChange: (value: number) => void;
  onGameStateChange: (value: string) => void;
  onInferFrameSize: () => void;
  onLoopChange: (value: boolean) => void;
  onRoleChange: (value: AssetRole) => void;
  onSave: () => void;
  onSaveAndInsert: () => void;
  onTagsTextChange: (value: string) => void;
  onTriggerTypeChange: (value: ActionTriggerType) => void;
  onTriggerValueChange: (value: string) => void;
};

export function SpritesheetImporterPanel({
  actionName,
  assetName,
  columns,
  fileName,
  frameCount,
  frameHeight,
  frameWidth,
  gameState,
  importLoop,
  role,
  roleLabels,
  sheetSize,
  tagsText,
  triggerLabels,
  triggerType,
  triggerValue,
  onActionNameChange,
  onAssetNameChange,
  onColumnsChange,
  onFileChange,
  onFrameCountChange,
  onFrameHeightChange,
  onFrameWidthChange,
  onGameStateChange,
  onInferFrameSize,
  onLoopChange,
  onRoleChange,
  onSave,
  onSaveAndInsert,
  onTagsTextChange,
  onTriggerTypeChange,
  onTriggerValueChange,
}: SpritesheetImporterPanelProps) {
  return (
    <section>
      <div className="section-title"><Upload size={17} /> Import Spritesheet Animation</div>
      <div className="binding-hint">
        Add any complete spritesheet as a scene animation. Use Auto + Loop for ambient effects, or save mouse, keyboard, and state trigger metadata for later gameplay wiring.
      </div>

      <label>Spritesheet Image</label>
      <input type="file" accept="image/png,image/webp,image/jpeg" onChange={onFileChange} />
      {sheetSize && (
        <div className="import-summary">
          {fileName || "Uploaded image"} / {sheetSize[0]} x {sheetSize[1]}px
        </div>
      )}

      <label>Asset Name</label>
      <input value={assetName} onChange={event => onAssetNameChange(event.target.value)} />

      <label>Action / Clip Name</label>
      <input
        value={actionName}
        onChange={event => onActionNameChange(event.target.value)}
        placeholder="Example: steam_loop / door_open"
      />

      <div className="two-col">
        <div>
          <label>Frame Count</label>
          <input type="number" min="1" value={frameCount} onChange={event => onFrameCountChange(Math.max(1, Number(event.target.value)))} />
        </div>
        <div>
          <label>Columns</label>
          <input type="number" min="1" value={columns} onChange={event => onColumnsChange(Math.max(1, Number(event.target.value)))} />
        </div>
      </div>

      <div className="two-col">
        <div>
          <label>Frame Width</label>
          <input type="number" min="1" value={frameWidth} onChange={event => onFrameWidthChange(Math.max(1, Number(event.target.value)))} />
        </div>
        <div>
          <label>Frame Height</label>
          <input type="number" min="1" value={frameHeight} onChange={event => onFrameHeightChange(Math.max(1, Number(event.target.value)))} />
        </div>
      </div>
      <button className="ghost-button full" type="button" onClick={onInferFrameSize}>Infer Frame Size from Sheet</button>

      <div className="two-col">
        <div>
          <label>Asset Role</label>
          <select value={role} onChange={event => onRoleChange(event.target.value as AssetRole)}>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label>Trigger Type</label>
          <select value={triggerType} onChange={event => onTriggerTypeChange(event.target.value as ActionTriggerType)}>
            {Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <label>Trigger Value</label>
      <input value={triggerValue} onChange={event => onTriggerValueChange(event.target.value)} placeholder="auto / click / KeyF / state key" />

      <label>Game State</label>
      <input value={gameState} onChange={event => onGameStateChange(event.target.value)} />

      <label>Tags</label>
      <input value={tagsText} onChange={event => onTagsTextChange(event.target.value)} />

      <label className="checkbox-line">
        <input type="checkbox" checked={importLoop} onChange={event => onLoopChange(event.target.checked)} />
        Loop this animation
      </label>

      <div className="button-row">
        <button className="ghost-button" type="button" onClick={onSave}><CheckCircle2 size={16} /> Save</button>
        <button className="primary-button" type="button" onClick={onSaveAndInsert}><Plus size={16} /> Save & Insert</button>
      </div>
    </section>
  );
}
