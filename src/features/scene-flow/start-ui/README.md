# Start UI Editor

This folder owns the Start UI editor inside the scene-flow feature.

- `index.ts` is the public boundary used by the parent scene-flow panel.
- `useStartUiEditor.ts` is the feature controller that composes normalized draft state and focused hooks.
- `useStartUiArtworkActions.ts`, `useStartUiLayerInteraction.ts`, and `useStartUiEffectsPreview.ts` separately own artwork workflows, canvas input, and transient effect preview state.
- `StartUiWorkbench.tsx` composes the toolbar and stage; the `StartUiCanvas*` and `StartUiEffectOverlays.tsx` files own focused rendering responsibilities.
- `StartUiInspector.tsx` composes Screen, Layer, Effects, Menu, and Runtime sections. Shared form controls and patch contracts live in `StartUiInspectorControls.tsx` and `startUiInspectorTypes.ts`.
- `StartUiEffectsInspector.tsx` owns persisted effect settings, `StartUiEffectGroups.tsx` groups their controls, and `startUiEffectsModel.ts` maps settings to preview values.
- `startUiLayerModel.ts` builds layer data and default layouts.
- `startUiEditorModel.ts` contains editor geometry, selection, drag, and layer patch helpers.
- `startUiArtworkProcessing.ts` turns source artwork into generated background and layer images.
- `startUiRegionDetection.ts` contains the image-analysis heuristics used by auto split.
- `startUiAssetNaming.ts`, `startUiEditorMessages.ts`, `startUiEditorOptions.ts`, `startUiLayerStyles.ts`, and `startUiPresentation.ts` keep small UI and asset helpers out of the core model.
