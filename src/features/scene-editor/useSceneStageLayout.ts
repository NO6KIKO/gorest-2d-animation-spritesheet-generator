import { useEffect, useRef, useState } from "react";

type SceneStageLayoutParams = {
  inspectorWidth: number;
  layerWidth: number;
  tab: string;
};

export function useSceneStageLayout({ inspectorWidth, layerWidth, tab }: SceneStageLayoutParams) {
  const stageShellRef = useRef<HTMLDivElement | null>(null);
  const sceneGlobalControlsRef = useRef<HTMLDivElement | null>(null);
  const [stageShellSize, setStageShellSize] = useState({ width: 0, height: 0 });
  const [sceneControlsHeight, setSceneControlsHeight] = useState(0);

  useEffect(() => {
    const element = stageShellRef.current;
    const controls = sceneGlobalControlsRef.current;
    if (!element) return;
    const updateStageShellSize = () => {
      setStageShellSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
      setSceneControlsHeight(controls?.offsetHeight || 0);
    };
    updateStageShellSize();
    const observer = new ResizeObserver(updateStageShellSize);
    observer.observe(element);
    if (controls) observer.observe(controls);
    window.addEventListener("resize", updateStageShellSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStageShellSize);
    };
  }, [inspectorWidth, layerWidth, tab]);

  return {
    sceneControlsHeight,
    sceneGlobalControlsRef,
    stageShellRef,
    stageShellSize,
  };
}
