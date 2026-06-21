import { MousePointer2 } from "lucide-react";

type TriggerTestPanelProps = {
  onTriggerMouseAction: () => void;
};

export function TriggerTestPanel({ onTriggerMouseAction }: TriggerTestPanelProps) {
  return (
    <section>
      <div className="section-title"><MousePointer2 size={17} /> Trigger Test</div>
      <div className="binding-hint">
        Clicking the scene runs the first mouse-bound action. Keyboard triggers match saved asset `triggerValue` fields, such as `KeyD`.
      </div>
      <button className="ghost-button full" type="button" onClick={onTriggerMouseAction}><MousePointer2 size={16} /> Simulate Mouse Trigger</button>
    </section>
  );
}
