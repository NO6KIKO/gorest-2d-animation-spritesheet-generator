import { HelpCircle, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import "./community-help.css";

const DISCORD_URL = "https://discord.gg/rBS93CV6N";

export function CommunityHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="community-help-button"
        aria-label="Open community help"
        onClick={() => setIsOpen(true)}
      >
        <HelpCircle size={24} />
      </button>

      {isOpen && (
        <div className="community-help-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="community-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-help-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="community-help-close"
              aria-label="Close community help"
              onClick={() => setIsOpen(false)}
            >
              <X size={18} />
            </button>

            <img className="community-help-logo" src="/brand/gorest-logo-black.png" alt="Gorest" />

            <div className="community-help-copy">
              <p>Help & Feedback</p>
              <h2 id="community-help-title">Not sure how to use it?</h2>
              <span>Tell us what feels confusing or hard to use. We will answer as soon as we can and keep improving the tool.</span>
            </div>

            <a className="community-help-discord" href={DISCORD_URL} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Join Discord
            </a>
          </section>
        </div>
      )}
    </>
  );
}
