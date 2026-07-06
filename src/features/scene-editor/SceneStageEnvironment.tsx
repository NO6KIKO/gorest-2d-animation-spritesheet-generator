import type { LayerInteractionSettings, SceneLightingSettings, SceneLayer } from "../../types";

type InteractionLightBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SceneInteractionLightEntry = {
  bounds: InteractionLightBounds;
  interaction: LayerInteractionSettings;
  layer: SceneLayer;
};

type SceneStageEnvironmentProps = {
  groundLayer?: SceneLayer;
  interactionLights?: Array<SceneInteractionLightEntry | null>;
  lighting: SceneLightingSettings;
  sceneCameraX: number;
  sceneCameraY: number;
  showLightingOverlay: boolean;
  groundY: number;
  stageScaleX: number;
  stageScaleY: number;
};

function hexToRgb(hex = "#ffffff") {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

export function SceneStageEnvironment({
  groundLayer,
  interactionLights = [],
  lighting,
  sceneCameraX,
  sceneCameraY,
  showLightingOverlay,
  groundY,
  stageScaleX,
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
      {interactionLights.map(entry => {
        if (!entry) return null;
        const { bounds, interaction, layer } = entry;
        const color = hexToRgb(interaction.lightColor || "#f4d38a");
        const intensity = Math.max(0, Math.min(1.4, interaction.lightIntensity ?? 0.65));
        const falloff = Math.max(0.35, Math.min(0.95, interaction.lightFalloff ?? 0.75));
        const softStop = Math.round(falloff * 100);
        const blendMode = interaction.lightBlendMode || "screen";
        const flicker = Math.max(0, Math.min(1, interaction.lightFlicker || 0));
        const bloomOpacity = Math.min(0.46, intensity * 0.34);
        return (
          <div
            key={`light-${layer.id}`}
            className={`scene-interaction-light ${interaction.zoneShape === "rect" ? "rect" : "circle"} ${flicker ? "flicker" : ""}`}
            style={{
              left: (bounds.left - sceneCameraX * (layer.parallax ?? 1)) * stageScaleX,
              top: (bounds.top - sceneCameraY * (layer.parallax ?? 1)) * stageScaleY,
              width: bounds.width * stageScaleX,
              height: bounds.height * stageScaleY,
              zIndex: Math.max(8, Math.min(layer.zIndex - 1, 18)),
              opacity: bloomOpacity,
              mixBlendMode: blendMode,
              ["--light-color" as string]: `${color.r}, ${color.g}, ${color.b}`,
              ["--light-soft-stop" as string]: `${softStop}%`,
              ["--light-flicker-opacity" as string]: `${Math.max(0.22, bloomOpacity - flicker * 0.12)}`,
            }}
          />
        );
      })}
      {groundLayer?.visible && (
        <>
          <div className="ground-band" style={{ top: `${(groundY - sceneCameraY * (groundLayer.parallax ?? 1)) * stageScaleY}px`, backgroundColor: groundLayer.color, opacity: groundLayer.opacity }} />
          <div className="ground-line" style={{ top: `${(groundY - sceneCameraY * (groundLayer.parallax ?? 1)) * stageScaleY}px` }} />
        </>
      )}
    </>
  );
}
