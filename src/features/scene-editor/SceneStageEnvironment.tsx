import type { SceneLightingSettings, SceneLayer } from "../../types";

type SceneStageEnvironmentProps = {
  groundLayer?: SceneLayer;
  lighting: SceneLightingSettings;
  showLightingOverlay: boolean;
  groundY: number;
  stageScaleY: number;
};

export function SceneStageEnvironment({
  groundLayer,
  lighting,
  showLightingOverlay,
  groundY,
  stageScaleY,
}: SceneStageEnvironmentProps) {
  return (
    <>
      {showLightingOverlay && (
        <>
          <div
            className="scene-lighting-overlay"
            style={{
              opacity: lighting.ambience,
              filter: `saturate(${lighting.glow}) brightness(${lighting.brightness})`,
            }}
          />
          <div className="scene-vignette-overlay" style={{ opacity: lighting.vignette }} />
        </>
      )}
      {groundLayer?.visible && (
        <>
          <div className="ground-band" style={{ top: `${groundY * stageScaleY}px`, backgroundColor: groundLayer.color, opacity: groundLayer.opacity }} />
          <div className="ground-line" style={{ top: `${groundY * stageScaleY}px` }} />
        </>
      )}
    </>
  );
}
