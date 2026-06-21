type ModePickerProps = {
  onOpenGame: () => void;
  onOpenSheetOnly: () => void;
};

export function ModePicker({ onOpenGame, onOpenSheetOnly }: ModePickerProps) {
  return (
    <main className="mode-picker-page">
      <div className="mode-choice-grid" aria-label="Choose spritesheet workspace mode">
        <button type="button" className="mode-choice-card" onClick={onOpenSheetOnly}>
          <span>Spritesheet Only</span>
        </button>
        <button type="button" className="mode-choice-card" onClick={onOpenGame}>
          <span>Spritesheets in<br />Animation / Game</span>
        </button>
      </div>
    </main>
  );
}
