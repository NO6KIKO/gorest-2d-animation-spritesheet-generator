type ModePickerProps = {
  onOpenGame: () => void;
  onOpenSheetOnly: () => void;
};

const DISCORD_URL = "https://discord.gg/6xjFbau6T";
const WEBSITE_URL = "https://gorest.ai/";

export function ModePicker({ onOpenGame, onOpenSheetOnly }: ModePickerProps) {
  return (
    <main className="mode-picker-page">
      <section className="mode-picker-shell" aria-labelledby="mode-picker-title">
        <header className="mode-picker-brand">
          <img className="mode-picker-logo" src="/brand/gorest-logo-black.png" alt="Gorest" />
          <div className="mode-picker-actions">
            <a className="mode-picker-link" href={WEBSITE_URL} target="_blank" rel="noreferrer">
              Website
            </a>
            <a className="mode-picker-link mode-picker-link-primary" href={DISCORD_URL} target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </header>

        <div className="mode-picker-copy">
          <p className="mode-picker-kicker">Open-source No-UI 2D Game / Animation Generative Platform</p>
          <h1 id="mode-picker-title">We are infinite.</h1>
          <p>
            Turn ideas, references, and spritesheets into game-ready 2D assets.
          </p>
        </div>

        <div className="mode-choice-grid" aria-label="Choose spritesheet workspace mode">
          <button type="button" className="mode-choice-card" onClick={onOpenSheetOnly}>
            <span>Spritesheet Only</span>
          </button>
          <button type="button" className="mode-choice-card" onClick={onOpenGame}>
            <span>Spritesheets in<br />Animation / Game</span>
          </button>
        </div>
      </section>
    </main>
  );
}
