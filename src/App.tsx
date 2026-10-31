import React, { Suspense, useCallback, useEffect, useRef, useState, useReducer } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import type {
  AsciiRegion,
  CanvasCompositionMode,
  GlyphFamily,
  Recipe,
  StudioState,
} from './engine/types';
import { DEFAULT_BASE_CANVAS } from './engine/types';
import type { LayoutPresetId } from './engine/recipes';
import {
  BUILTIN_RECIPES,
  createLayoutPreset,
  generateRandomRegions,
} from './engine/recipes';
import type { SamplePhoto } from './engine/samplePhotos';
import { SAMPLE_PHOTOS } from './engine/samplePhotos';
import { renderStudioFrame } from './engine/renderer';
import { normalizeStudioState } from './engine/studioState';
import { waitForRenderFonts } from './engine/renderFonts';
import { createEditorHistory, editorHistoryReducer } from './engine/editorHistory';
import { ParameterHistoryProvider } from './components/ParameterHistoryContext';
import { ExportPreview } from './components/ExportPreview';
import type { ExportSnapshot } from './components/ExportPreview';
import { getSupportedVideoFormats, getVideoDimensions, VIDEO_QUALITIES, WEBP_QUALITIES } from './engine/exportSettings';
import type { VideoQuality, VideoSize } from './engine/exportSettings';
import { CanvasStage } from './components/CanvasStage';
import type { MotionPanel } from './components/MotionDock';
import { LayerPanel } from './components/LayerPanel';
import { CanvasViewTools } from './components/CanvasViewTools';
import { createStudioLayer } from './engine/layers';
import { HomeView } from './components/HomeView';
import { RecipesView } from './components/RecipesView';
import { FaqView } from './components/FaqView';
import './components/studio.css';
import './components/editor-shell.css';
import './components/controls/controls.css';
import { StudioButtonLabel } from './components/StudioButtonLabel';
import { StudioSelect } from './components/controls/StudioSelect';
import { ToastContainer, type ToastItem } from './components/Toast';
import {
  Upload,
  Undo2,
  Redo2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Download,
  Terminal,
  Video,
  Home,
  Sliders,
  Waves,
  Layers,
  Sparkles,
  HelpCircle,
  ArrowRight,
  X,
} from 'lucide-react';

const CUSTOM_RECIPES_STORAGE_KEY = 'sgnl_studio_custom_recipes_v3';
const MotionDock = React.lazy(() => import('./components/MotionDock').then(module => ({ default: module.MotionDock })));
const InspectorDock = React.lazy(() => import('./components/InspectorDock').then((module) => ({ default: module.InspectorDock })));

function ControlsLoading() {
  return <div className="controls-loading" role="status">Loading controls…</div>;
}

export type AppSection = 'home' | 'editor' | 'recipes' | 'faq';

type StudioWorkspace = 'image' | 'animate';
const CLIP_DURATION = 3;

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>('home');
  const [mobilePanel, setMobilePanel] = useState<'layers' | 'properties' | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [propertyScope, setPropertyScope] = useState<'selected' | 'whole'>('selected');
  const [motionOpen, setMotionOpen] = useState(false);
  const [motionPanel, setMotionPanel] = useState<MotionPanel>('playback');
  const [appearanceFocus, setAppearanceFocus] = useState<{ section: string; id: number }>({section: '', id: 0});
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string>(
    SAMPLE_PHOTOS[0].id
  );

  const [editing, dispatchHistory] = useReducer(editorHistoryReducer, undefined, () =>
    createEditorHistory(normalizeStudioState(BUILTIN_RECIPES[0].state)));
  const liveState = editing.document;
  const history = editing.snapshots;
  const historyIndex = editing.index;
  const liveStateRef = useRef(liveState);
  liveStateRef.current = liveState;
  const [workspace, setWorkspace] = useState<StudioWorkspace>('image');
  const [soloRegionId, setSoloRegionId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    BUILTIN_RECIPES[0].state.regions[0]?.id ?? null
  );
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(
    BUILTIN_RECIPES[0].id
  );
  const [lockLayoutOnRecipe, setLockLayoutOnRecipe] = useState<boolean>(false);

  // Custom user recipes stored in localStorage
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_RECIPES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Recipe[];
      return parsed.map((r) => ({
        ...r,
        state: normalizeStudioState(r.state),
      }));
    } catch {
      return [];
    }
  });

  // Transport & Signal Animation Clock
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [time, setTime] = useState<number>(0);
  // Match CanvasStage's 1280px preview limit, including portrait images.
  const previewScale = image
    ? Math.round(image.naturalWidth * Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight))) / 1000
    : undefined;
  const [showOriginalOnly, setShowOriginalOnly] = useState<boolean>(false);
  const [splitCompareActive, setSplitCompareActive] = useState<boolean>(false);

  // Export Settings
  const [exportFormat, setExportFormat] = useState<'png' | 'webp'>('png');
  const [exportScale, setExportScale] = useState<1 | 2>(1);
  const [webpQuality, setWebpQuality] = useState<number>(0.9);
  const [exportTab, setExportTab] = useState<'photo' | 'video'>('photo');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportSnapshot, setExportSnapshot] = useState<ExportSnapshot | null>(null);
  const [videoSize, setVideoSize] = useState<VideoSize>(1080);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('balanced');
  const [videoFormats] = useState(() => typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function'
    ? [] : getSupportedVideoFormats((mime) => MediaRecorder.isTypeSupported(mime)));
  const [videoMimeType, setVideoMimeType] = useState(() => videoFormats[0]?.mimeType ?? '');
  const selectedVideoFormat = videoFormats.find((format) => format.mimeType === videoMimeType);
  const videoDimensions = image ? getVideoDimensions(image.naturalWidth, image.naturalHeight, videoSize) : null;
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const cancelVideoRef = useRef<(() => void) | null>(null);
  // Notification Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const duration = toast.duration ?? 4000;
    const item: ToastItem = { ...toast, id };
    setToasts((prev) => [...prev, item]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      setIsDesktop(desktop.matches);
      if (desktop.matches) setMobilePanel(null);
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setMobilePanel(null);
    setIsExportDialogOpen(false);
  }, [activeSection]);

  // Load photo from URL or procedural sample canvas
  const loadPhotoFromUrl = useCallback((url: string, onLoaded?: () => void) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      onLoaded?.();
    };
    img.onerror = () => addToast({type: 'error', title: 'Could not open photo', message: 'Choose a valid JPEG, PNG or WebP image.'});
    img.src = url;
  }, [addToast]);

  const loadSamplePhoto = useCallback(
    (sample: SamplePhoto) => {
      if (sample.createCanvas) {
        const sampleCanvas = sample.createCanvas();
        loadPhotoFromUrl(sampleCanvas.toDataURL('image/jpeg', 0.94));
      } else {
        loadPhotoFromUrl(sample.sourceUrl);
      }
    },
    [loadPhotoFromUrl]
  );

  useEffect(() => {
    loadSamplePhoto(SAMPLE_PHOTOS[0]);
  }, [loadSamplePhoto]);

  const commitState = useCallback((nextState: StudioState, recordHistory = true) => {
    dispatchHistory({type: 'update', document: nextState, record: recordHistory});
  }, []);
  const handleUndo = useCallback(() => dispatchHistory({type:'undo'}), []);
  const handleRedo = useCallback(() => dispatchHistory({type:'redo'}), []);
  const parameterHistory = React.useMemo(() => ({
    begin: () => dispatchHistory({type:'begin'}),
    commit: () => dispatchHistory({type:'commit'}),
    cancel: () => dispatchHistory({type:'cancel'}),
  }), []);
  const openMotion = useCallback(() => {
    setMotionOpen(true);
    setWorkspace('animate');
    if (!isDesktop) setMobilePanel('properties');
  }, [isDesktop]);
  const selectLayer = useCallback((id: string | null) => {
    setSelectedRegionId(id);
    setPropertyScope('selected');
    setMotionOpen(false);
    setAppearanceFocus(previous => ({...previous, section: ''}));
  }, []);
  const focusAppearance = useCallback((section: string, reveal = true) => {
    setPropertyScope('whole');
    setAppearanceFocus(previous => ({section, id: previous.id + 1}));
    if (reveal) {
      setMotionOpen(false);
      if (!isDesktop) setMobilePanel('properties');
    }
  }, [isDesktop]);
  const handleInspectorStateUpdate = useCallback((patch: Partial<StudioState>, record = true) => {
    commitState({...liveStateRef.current, ...patch}, record);
  }, [commitState]);

  useEffect(() => {
    if (selectedRegionId && !liveState.regions.some(r => r.id === selectedRegionId)) setSelectedRegionId(liveState.baseCanvas?.mode === 'full' ? null : liveState.regions.at(-1)?.id ?? null);
    if (soloRegionId && !liveState.regions.some(r => r.id === soloRegionId)) setSoloRegionId(null);
  }, [liveState.regions, selectedRegionId, soloRegionId]);

  // Playback belongs to Animate. Hidden/offscreen sessions never accrue wall time.
  useEffect(() => {
    if (activeSection !== 'editor' || workspace !== 'animate' || liveState.animation?.enabled === false) setIsPlaying(false);
  }, [activeSection, workspace, liveState.animation?.enabled]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setIsPlaying(false); };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pauseForReducedMotion = () => { if (reducedMotion.matches) setIsPlaying(false); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    reducedMotion.addEventListener('change', pauseForReducedMotion);
    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      reducedMotion.removeEventListener('change', pauseForReducedMotion);
    };
  }, []);
  useEffect(() => {
    if (!isPlaying || workspace !== 'animate' || activeSection !== 'editor' || document.hidden) return;
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      setTime(prev => (prev + dt) % CLIP_DURATION);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, workspace, activeSection]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (e.defaultPrevented || target?.isContentEditable || target?.closest(
        'input, textarea, select, output, [data-parameter-control], [role="tablist"], [role="listbox"], [role="menu"], [role="slider"], [role="switch"], [role="spinbutton"], [role="combobox"]'
      )) return;
      const dialog = target?.closest('[role="dialog"]');
      if (dialog && !dialog.classList.contains('studio-panel-dialog')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      if (activeSection !== 'editor') return;
      if (e.key.toLowerCase() === 'k' && workspace === 'animate' && !e.repeat && liveState.animation?.enabled !== false && (!target?.closest('button, a') || target.closest('.motion-dock'))) {
        e.preventDefault(); setIsPlaying(p => !p); return;
      }
      if (target?.closest('button, a')) return;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && workspace === 'animate' && target?.closest('.signal-transport')) {
        e.preventDefault(); setIsPlaying(false);
        setTime(t => Math.max(0, Math.min(CLIP_DURATION, t + (e.key === 'ArrowRight' ? 1 : -1) / 30)));
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedRegionId && propertyScope === 'selected' && target?.closest('.studio-stage')) {
        e.preventDefault();
        commitState({...liveStateRef.current, regions: liveStateRef.current.regions.filter(r => r.id !== selectedRegionId)}, true);
        setSelectedRegionId(null); return;
      }
      if (e.key === '\\') setShowOriginalOnly(true);
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === '\\') setShowOriginalOnly(false); };
    const clearOriginal = () => setShowOriginalOnly(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearOriginal);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearOriginal);
    };
  }, [handleUndo, handleRedo, selectedRegionId, commitState, activeSection, workspace, liveState.animation?.enabled, propertyScope]);

  const handleFileUpload = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      addToast({
        type: 'error',
        title: 'Invalid File',
        message: 'Please select a valid JPEG, PNG, or WebP image.',
      });
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: 'File Too Large',
        message: 'Images larger than 30MB may cause browser memory instability.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadPhotoFromUrl(reader.result, () => {
          setActiveSampleId('custom');
          setActiveSection('editor');
          addToast({type: 'success', title: 'Photo loaded', message: `${file.name} ready in studio`});
        });
      }
    };
    reader.onerror = () => {
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: 'Could not read image file.',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleApplyRecipe = (recipe: Recipe) => {
    setActiveRecipeId(recipe.id);
    const rState = normalizeStudioState(recipe.state);
    setIsPlaying(false);
    setTime(0);
    setSoloRegionId(null);
    const hasMotion = rState.crt.motionMode !== 'off' || rState.tracking.autoRoll ||
      ['ripple','wave','swirl'].includes(rState.grading.warpMode ?? 'off') ||
      rState.glitch.enabled || (rState.crt.filmGrain ?? 0) > 0 || (rState.crt.dustSpec ?? 0) > 0;
    setWorkspace(hasMotion ? 'animate' : 'image');
    setMotionOpen(hasMotion);
    setPropertyScope('selected');
    if (lockLayoutOnRecipe && liveState.regions.length > 0) {
      const templateRegion = rState.regions[0];
      const fallbackBase = rState.baseCanvas ?? DEFAULT_BASE_CANVAS;
      const styledRegions = liveState.regions.map((r, idx) => {
        const refRgn =
          rState.regions[idx % Math.max(1, rState.regions.length)] ??
          templateRegion;
        const source = refRgn ?? fallbackBase;
        const {cellSize,glyphFamily,color,customColorHex,secondaryColorHex,paletteModified,
          knockoutOpacity,contrast,substrateMode,invert,customChars,wordmarkText,fontFamily,
          tileGap,tileRoundness,printAngle,printWeight,printRoughness,printRegistration} = source;
        return {...r,cellSize,glyphFamily,color,customColorHex,secondaryColorHex,paletteModified,
          knockoutOpacity,contrast,substrateMode,invert,customChars,wordmarkText,fontFamily,
          tileGap,tileRoundness,printAngle,printWeight,printRoughness,printRegistration,hudFrame:false};
      });
      commitState(
        {
          ...rState,
          baseCanvas: {
            ...(rState.baseCanvas ?? DEFAULT_BASE_CANVAS),
            mode: liveState.baseCanvas?.mode ?? 'blocks',
          },
          regions: styledRegions,
        },
        true
      );
    } else {
      commitState(rState, true);
      setSelectedRegionId(rState.baseCanvas.mode === 'full' ? null : rState.regions[0]?.id ?? null);
    }
  };

  const handleRandomizeBlocks = () => {
    const nextSeed = Math.floor(Math.random() * 99999);
    const regions = generateRandomRegions(nextSeed, 4);
    const currentBase = liveState.baseCanvas ?? DEFAULT_BASE_CANVAS;
    commitState(
      {
        ...liveState,
        baseCanvas: {
          ...currentBase,
          mode: currentBase.mode === 'full' ? 'blocks' : currentBase.mode,
        },
        randomSeed: nextSeed,
        regions,
      },
      true
    );
    setSelectedRegionId(regions[0]?.id ?? null);
    setActiveRecipeId(null);
  };

  const handleApplyLayoutPreset = (preset: LayoutPresetId) => {
    if (preset === 'full-frame') {
      setSelectedRegionId(null);
      setSoloRegionId(null);
      commitState(
        {
          ...liveState,
          baseCanvas: {
            ...(liveState.baseCanvas ?? DEFAULT_BASE_CANVAS),
            mode: 'full',
          },
        },
        true
      );
      setActiveRecipeId(null);
      return;
    }

    const regions = createLayoutPreset(preset);
    const currentBase = liveState.baseCanvas ?? DEFAULT_BASE_CANVAS;
    commitState(
      {
        ...liveState,
        baseCanvas: {
          ...currentBase,
          mode: currentBase.mode === 'full' ? 'blocks' : currentBase.mode,
        },
        regions,
      },
      true
    );
    setSelectedRegionId(regions[0]?.id ?? null);
    setActiveRecipeId(null);
  };

  const handleSaveCustomRecipe = (name: string, tagline: string) => {
    const newRecipe: Recipe = {
      id: `custom-${Date.now()}`,
      name,
      tagline,
      category: 'Custom',
      badgeColor: '#39FF14',
      state: liveState,
      isCustom: true,
    };
    const updated = [newRecipe, ...customRecipes];
    setCustomRecipes(updated);
    setActiveRecipeId(newRecipe.id);
    try {
      localStorage.setItem(CUSTOM_RECIPES_STORAGE_KEY, JSON.stringify(updated));
      addToast({
        type: 'success',
        title: 'Recipe Saved',
        message: `"${name}" added to custom library`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Storage Full',
        message: 'Could not persist recipe in localStorage quota.',
      });
    }
  };

  const handleDeleteCustomRecipe = (id: string) => {
    const toDelete = customRecipes.find((r) => r.id === id);
    if (!toDelete) return;

    const updated = customRecipes.filter((r) => r.id !== id);
    setCustomRecipes(updated);
    try {
      localStorage.setItem(CUSTOM_RECIPES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    addToast({
      type: 'info',
      title: 'Recipe Deleted',
      message: `"${toDelete.name}" was removed`,
      action: {
        label: 'Undo',
        onClick: () => {
          setCustomRecipes((prev) => {
            const restored = [toDelete, ...prev];
            try {
              localStorage.setItem(
                CUSTOM_RECIPES_STORAGE_KEY,
                JSON.stringify(restored)
              );
            } catch {
              // Ignore
            }
            return restored;
          });
          addToast({
            type: 'success',
            title: 'Restored',
            message: `"${toDelete.name}" restored to library`,
            duration: 2500,
          });
        },
      },
      duration: 6000,
    });
  };

  const handleExportRecipeJson = () => {
    try {
      const payload = JSON.stringify(
        {
          name: 'SGNL Studio Recipe',
          exportedAt: new Date().toISOString(),
          state: liveState,
        },
        null,
        2
      );
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sgnl-recipe-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({
        type: 'success',
        title: 'JSON Exported',
        message: 'Recipe configuration downloaded.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Could not generate recipe JSON.',
      });
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    // Leave the URL alive while the browser starts its download.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const openExport = (captureFrame = false) => {
    setIsPlaying(false);
    const video = exportTab === 'video' && !captureFrame;
    setExportTab(video ? 'video' : 'photo');
    setExportSnapshot({state:structuredClone(liveState), intent:video || captureFrame ? 'animate' : 'image', time:captureFrame ? time : 0});
    setIsExportDialogOpen(true);
  };
  const selectExportTab = (next: 'photo' | 'video') => {
    setExportTab(next);
    setExportSnapshot(previous => previous && ({...previous,
      intent:next === 'video' ? 'animate' : 'image',
      time:0,
    }));
  };

  const handleExportImage = async () => {
    if (!image || !exportSnapshot || isExporting || isRecordingVideo) return;
    setIsExporting(true);
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = image.naturalWidth * exportScale;
      exportCanvas.height = image.naturalHeight * exportScale;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not obtain a 2D rendering context.');
      await waitForRenderFonts(exportSnapshot.state);
      renderStudioFrame(ctx, image, exportSnapshot.state, {
        time:exportSnapshot.time, intent:exportSnapshot.intent, scale: exportCanvas.width / 1000, showOriginalOnly: false,
        animationEnabled:exportSnapshot.state.animation?.enabled, playbackSpeed:exportSnapshot.state.animation?.playbackSpeed ?? 1,
      });
      const mime = exportFormat === 'webp' ? 'image/webp' : 'image/png';
      const blob = await new Promise<Blob>((resolve, reject) => exportCanvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('Could not encode this photo. Try a smaller size.')),
        mime,
        exportFormat === 'webp' ? webpQuality : undefined,
      ));
      // Canvas encoders can fall back to PNG. Match the downloaded extension to the actual file.
      const extension = blob.type === 'image/webp' ? 'webp' : 'png';
      downloadBlob(blob, `sgnl-${exportSnapshot.intent === 'animate' ? 'frame' : 'image'}-${Date.now()}.${extension}`);
      addToast({
        type: 'success', title: 'Photo exported',
        message: `Saved ${extension.toUpperCase()} · ${exportCanvas.width} × ${exportCanvas.height} px.`,
      });
    } catch (error) {
      addToast({type: 'error', title: 'Photo export failed', message: error instanceof Error ? error.message : 'Could not export this photo.'});
    } finally {
      setIsExporting(false);
    }
  };

  // Real-time browser capture: target 3 seconds at up to 30fps, subject to render/encode speed.
  const handleExportVideoLoop = async () => {
    if (!image || !exportSnapshot || isRecordingVideo || isExporting) return;
    if (!selectedVideoFormat) {
      addToast({type: 'error', title: 'Video unsupported', message: 'This browser cannot record WebM or MP4. You can still export a photo.'});
      return;
    }
    setIsRecordingVideo(true);
    setIsPlaying(false);
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let failed = false;
    let cancelled = false;
    let rejectRecording: ((error: Error) => void) | undefined;
    let encoderDeadline: ReturnType<typeof setTimeout> | undefined;
    cancelVideoRef.current = () => {
      cancelled = true; failed = true;
      rejectRecording?.(new Error('Video recording cancelled.'));
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stream?.getTracks().forEach(track => track.stop());
    };
    try {
      const recCanvas = document.createElement('canvas');
      const dimensions = getVideoDimensions(image.naturalWidth, image.naturalHeight, videoSize);
      recCanvas.width = dimensions.width;
      recCanvas.height = dimensions.height;
      const ctx = recCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not obtain a 2D rendering context.');
      await waitForRenderFonts(exportSnapshot.state);
      if (cancelled) throw new Error('Video recording cancelled.');
      const renderFrame = (elapsed: number) => renderStudioFrame(ctx, image, exportSnapshot.state, {
        time: elapsed / 1000, intent:'animate', scale: recCanvas.width / 1000, showOriginalOnly: false,
        animationEnabled:exportSnapshot.state.animation?.enabled, playbackSpeed:exportSnapshot.state.animation?.playbackSpeed ?? 1,
      });
      renderFrame(0);
      stream = recCanvas.captureStream(30);
      recorder = new MediaRecorder(stream, {
        mimeType: selectedVideoFormat.mimeType,
        videoBitsPerSecond: VIDEO_QUALITIES.find((quality) => quality.id === videoQuality)!.bitsPerSecond,
      });
      const chunks: BlobPart[] = [];
      const recordingFinished = new Promise<Blob>((resolve, reject) => {
        rejectRecording = reject;
        encoderDeadline = setTimeout(() => { failed = true; reject(new Error('Video encoding took too long. Try a smaller size or another format.')); }, 12000);
        recorder!.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
        recorder!.onstop = () => {
          if (failed) return;
          const result = new Blob(chunks, {type: recorder!.mimeType || selectedVideoFormat.mimeType});
          if (!result.size) reject(new Error('The browser produced an empty video. Try a smaller size.'));
          else resolve(result);
        };
        recorder!.onerror = () => {
          failed = true;
          reject(new Error('The browser could not encode this video. Try a smaller size or another format.'));
        };
      });
      // Attach a handler immediately so asynchronous encoder errors cannot become unhandled rejections.
      void recordingFinished.catch(() => {});
      recorder.start();
      const start = performance.now();
      while (!failed && recorder.state === 'recording') {
        const elapsed = performance.now() - start;
        if (elapsed >= 3000) break;
        if (document.hidden) throw new Error('Keep this tab visible while recording. Please try again.');
        renderFrame(elapsed);
        // Charge render time to the frame budget, avoiding 90 slow renders extending a 3s clip.
        const frameDue = (Math.floor(elapsed / (1000 / 30)) + 1) * (1000 / 30);
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, frameDue - (performance.now() - start))));
      }
      if (recorder.state !== 'inactive') recorder.stop();
      const blob = await recordingFinished;
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `sgnl-clip-${Date.now()}.${extension}`);
      addToast({type: 'success', title: 'Video clip exported', message: `Saved ${extension.toUpperCase()} · ${dimensions.width} × ${dimensions.height} px · no audio.`});
    } catch (error) {
      failed = true;
      addToast({type: cancelled ? 'info' : 'error', title: cancelled ? 'Recording cancelled' : 'Video export failed', message: error instanceof Error ? error.message : 'Could not record this video.'});
    } finally {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stream?.getTracks().forEach((track) => track.stop());
      if (encoderDeadline) clearTimeout(encoderDeadline);
      cancelVideoRef.current = null;
      setIsRecordingVideo(false);
      setIsPlaying(false);
    }
  };

  const handleOpenEditorWithMode = (mode: CanvasCompositionMode) => {
    commitState(
      {
        ...liveState,
        baseCanvas: {
          ...(liveState.baseCanvas ?? DEFAULT_BASE_CANVAS),
          mode,
        },
      },
      true
    );
    setSelectedRegionId(null);
    setIsPlaying(false);
    setWorkspace('image');
    setMotionOpen(false);
    setPropertyScope('selected');
    setActiveSection('editor');
  };

  const handleOpenEditorWithStyle = (glyphFamily: GlyphFamily) => {
    commitState(
      {
        ...liveState,
        baseCanvas: {
          ...(liveState.baseCanvas ?? DEFAULT_BASE_CANVAS),
          mode: 'full',
          glyphFamily,
          paletteModified: false,
          color: glyphFamily === 'risograph-print' ? 'risograph' : glyphFamily === 'dither-atkinson' || glyphFamily === 'engraving' ? 'macintosh' : glyphFamily === 'voxel' ? 'sampled' : 'green',
        },
      },
      true
    );
    setSelectedRegionId(null);
    setIsPlaying(false);
    setWorkspace('image');
    setMotionOpen(false);
    setPropertyScope('selected');
    setActiveSection('editor');
  };

  const allRecipes = [...customRecipes, ...BUILTIN_RECIPES];

  const addLayer = () => {
    const current = liveStateRef.current;
    const layer = createStudioLayer(current, selectedRegionId);
    const base = {...DEFAULT_BASE_CANVAS, ...current.baseCanvas};
    handleInspectorStateUpdate({baseCanvas: {...base, mode: base.mode === 'full' ? 'hybrid' : base.mode}, regions: [...current.regions, layer]});
    selectLayer(layer.id);
    if (!isDesktop) setMobilePanel('properties');
  };
  const handleMotionStateUpdate = (patch: Partial<StudioState>, record = true) => {
    setWorkspace('animate');
    handleInspectorStateUpdate(patch, record);
  };
  const layerPanelProps = {
    state: liveState, image, selectedRegionId, soloRegionId, onUpdateState: handleInspectorStateUpdate,
    onSoloChange: setSoloRegionId, onAddRegion: addLayer, compositionSelected: propertyScope === 'whole',
    onSelectRegion: (id: string | null, revealProperties = true) => {selectLayer(id); if (!isDesktop && revealProperties) setMobilePanel('properties');},
    onSelectComposition: () => {setMotionOpen(false); setPropertyScope('whole'); setAppearanceFocus(previous => ({...previous, section: ''})); if (!isDesktop) setMobilePanel('properties');},
  };
  const appearanceControls = <Suspense fallback={<ControlsLoading />}>
    <InspectorDock state={liveState} selectedRegionId={selectedRegionId} previewScale={previewScale}
      scope={propertyScope} focusRequest={appearanceFocus} onSelectRegion={selectLayer} onSoloChange={setSoloRegionId}
      onUpdateState={handleInspectorStateUpdate}
      onUpdateRegions={regions => handleInspectorStateUpdate({regions})}
      onRandomizeBlocks={handleRandomizeBlocks} onApplyLayoutPreset={handleApplyLayoutPreset}/>
  </Suspense>;
  const transport = <div className="signal-transport studio-docked-transport" aria-label="Animation preview" tabIndex={0}>
    <div className="studio-animation-transport">
      <button type="button" onClick={() => setIsPlaying(playing => !playing)} aria-pressed={isPlaying}
        disabled={liveState.animation?.enabled === false} aria-label={isPlaying ? 'Pause animation' : 'Play animation'}>
        {isPlaying ? <Pause size={16}/> : <Play size={16}/>}<span><StudioButtonLabel>{isPlaying ? 'Pause' : 'Play'}</StudioButtonLabel></span>
      </button>
      <button type="button" onClick={() => {setIsPlaying(false);setTime(t => Math.max(0,t-1/30));}} aria-label="Previous frame"><SkipBack size={16}/></button>
      <button type="button" onClick={() => {setIsPlaying(false);setTime(t => Math.min(CLIP_DURATION,t+1/30));}} aria-label="Next frame"><SkipForward size={16}/></button>
      <input type="range" min={0} max={CLIP_DURATION} step={1/30} value={time}
        onChange={e => {setIsPlaying(false);setTime(Number(e.target.value));}}
        aria-label="Animation preview time" aria-valuetext={`${time.toFixed(2)} seconds of 3 seconds`} />
      <output aria-label="Current animation frame">{time.toFixed(2)} / 3.00 s</output>
      <button type="button" className="studio-capture-frame" aria-label="Capture frame" onClick={() => openExport(true)}><Download size={16}/><span><StudioButtonLabel>Capture frame</StudioButtonLabel></span></button>
    </div>
  </div>;

  const propertiesWorkspace = <div className="studio-properties-workspace">
    <div className="studio-property-tabs" role="group" aria-label="Properties view">
      <button type="button" aria-pressed={!motionOpen} aria-controls="studio-appearance-view" onClick={() => setMotionOpen(false)}><Sliders size={17}/><span><StudioButtonLabel>Appearance</StudioButtonLabel></span></button>
      <button type="button" aria-pressed={motionOpen} aria-controls="studio-motion-dock" onClick={openMotion}><Waves size={17}/><span><StudioButtonLabel>Motion</StudioButtonLabel></span></button>
    </div>
    <div className="studio-properties-view">
      {motionOpen ? <Suspense fallback={<ControlsLoading />}>
        <MotionDock state={liveState} panel={motionPanel} onPanelChange={setMotionPanel} onUpdateState={handleMotionStateUpdate} onFocusAppearance={focusAppearance}>{transport}</MotionDock>
      </Suspense> : <div id="studio-appearance-view" className="studio-appearance-view">{appearanceControls}</div>}
    </div>
  </div>;

  return (
    <div className={`app-shell flex w-full flex-col overflow-hidden bg-[#030406] text-[#f4f4f6] ${activeSection === 'editor' ? 'studio-ui' : ''}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose a photo"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />
      {/* ==================== TOP NAVIGATION & STUDIO INSTRUMENT BAR ==================== */}
      <header className={`sgnl-header ${activeSection === 'editor' ? 'is-editor' : ''}`}>
        {/* Left: Brand + Top-Level Section Navigation */}
        <div className="brand-navigation">
          <button
            type="button"
            onClick={() => setActiveSection('home')}
            aria-label="SGNL Home"
            className="brand-home group flex items-center gap-2 text-left shrink-0"
          >
            <img className="brand-mark" src="/brand/sgnl-ascii-moth-44.png" srcSet="/brand/sgnl-ascii-moth-88.png 2x, /brand/sgnl-ascii-moth-132.png 3x" width="44" height="44" alt="" aria-hidden="true" />
            <div className="brand-wordmark">
              <span className="font-display text-sm font-extrabold tracking-wider text-white">
                SGNL
              </span>
              <span className="font-mono text-sm text-zinc-500 uppercase">
                // studio
              </span>
            </div>
          </button>

          <div className="hidden sm:block h-4 w-px bg-white/10 shrink-0" />

          {/* Main Section Switcher: Home | Studio | Recipes | Manual */}
          <nav
            className="main-navigation"
            aria-label="Main Navigation"
          >
            {(
              [
                { id: 'home', label: 'Home', icon: Home },
                { id: 'editor', label: 'Studio', icon: Sliders },
                { id: 'recipes', label: 'Recipes', icon: Sparkles },
                { id: 'faq', label: 'Manual', icon: HelpCircle },
              ] as const
            ).map((nav) => {
              const Icon = nav.icon;
              const active = activeSection === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setActiveSection(nav.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1 font-mono text-sm transition ${
                    active
                      ? 'border border-emerald-400/50 bg-emerald-500/20 text-white font-bold'
                      : 'border border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={nav.label}
                  aria-label={nav.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-3.5 w-3.5 text-zinc-400" />
                  {activeSection === 'editor' ? <StudioButtonLabel>{nav.label}</StudioButtonLabel> : <span>{nav.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* NON-EDITOR VIEWS: Clean Logo + Nav + Minimal CTA Only */}
        {activeSection === 'editor' && (
          <div className="studio-toolbar" role="toolbar" aria-label="Photo and export tools">
            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-none border border-studio-line bg-studio-raised px-2.5 py-1.5 text-sm font-medium text-studio-paper transition hover:border-white/30 hover:bg-studio-raised shrink-0"
              aria-label="Upload photo"
              title="Upload Photo (JPEG, PNG, WebP)"
            >
              <Upload className="h-3.5 w-3.5 text-studio-highlight" />
              <StudioButtonLabel className="hidden sm:inline">Upload Photo</StudioButtonLabel>
              <StudioButtonLabel className="sm:hidden text-sm">Upload</StudioButtonLabel>
            </button>

            <StudioSelect
              className="sample-picker"
              label="Sample photo"
              value={activeSampleId}
              options={[
                ...(activeSampleId === 'custom' ? [{ value: 'custom', label: 'Your photo' }] : []),
                ...(activeSampleId === 'signal-study' ? [{ value: 'signal-study', label: 'Signal study' }] : []),
                ...SAMPLE_PHOTOS.map((sample) => ({ value: sample.id, label: sample.name })),
              ]}
              onValueChange={(value) => {
                const sample = SAMPLE_PHOTOS.find((item) => item.id === value);
                if (sample) { setActiveSampleId(sample.id); loadSamplePhoto(sample); }
              }}
            />
            {/* Undo / Redo */}
            <div className="studio-history-tools flex items-center shrink-0" role="group" aria-label="Edit history">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Undo (Cmd+Z)"
                className="rounded-none p-1.5 text-studio-paper transition hover:bg-studio-raised disabled:opacity-30"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Redo (Cmd+Shift+Z)"
                className="rounded-none p-1.5 text-studio-paper transition hover:bg-studio-raised disabled:opacity-30"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="studio-export-trigger shrink-0">
              <button
                type="button"
                onClick={() => openExport()}
                aria-haspopup="dialog"
                data-export="menu"
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
              >
                <Download className="h-4 w-4" />
                <span><StudioButtonLabel>{isRecordingVideo ? 'Recording…' : isExporting ? 'Exporting…' : 'Export'}</StudioButtonLabel></span>
              </button>
            </div>


          </div>
        )}
      </header>

      {/* ==================== SECTION 1: HOME ==================== */}
      {activeSection === 'home' && (
        <HomeView
          onOpenEditorWithMode={handleOpenEditorWithMode}
          onOpenEditorWithStyle={handleOpenEditorWithStyle}
          onOpenRecipes={() => setActiveSection('recipes')}
          onOpenEditorWithRecipe={(recipe, source) => {
            if (source) { setImage(source); setActiveSampleId('signal-study'); }
            handleApplyRecipe(recipe);
            setActiveSection('editor');
          }}
        />
      )}

      {/* ==================== SECTION 2: EDITOR ==================== */}
      {activeSection === 'editor' && (
        <ParameterHistoryProvider value={parameterHistory}>
        <main className="studio-workspace studio-layout" aria-label="Image studio">
          {isDesktop && <LayerPanel {...layerPanelProps} />}
          <div className="studio-canvas-column">
            <div className="studio-source-bar">
              <div className="studio-source-identity"><h1>{SAMPLE_PHOTOS.find(sample => sample.id === activeSampleId)?.name ?? (activeSampleId === 'signal-study' ? 'Signal study' : 'Your photo')}</h1>
              {image && <span>{image.naturalWidth} × {image.naturalHeight} <span className="studio-source-unit">px</span></span>}</div>
              <CanvasViewTools state={liveState} showOriginal={showOriginalOnly} splitCompare={splitCompareActive} onOriginalChange={setShowOriginalOnly} onSplitChange={setSplitCompareActive} onUpdateState={handleInspectorStateUpdate} />
            </div>
            <CanvasStage
              image={image} state={liveState}
              selectedRegionId={propertyScope === 'selected' ? selectedRegionId : null}
              onSelectRegion={selectLayer}
              renderIntent={workspace} animationEnabled={liveState.animation?.enabled}
              playbackSpeed={liveState.animation?.playbackSpeed ?? 1}
              soloRegionId={soloRegionId}
              onEditLayer={() => {setMotionOpen(false);setPropertyScope('selected'); if (!isDesktop) setMobilePanel('properties');}}
              onUpdateRegions={(regions: AsciiRegion[], record = true) => commitState({...liveStateRef.current, regions}, record)}
              time={time} showOriginalOnly={showOriginalOnly} splitCompareActive={splitCompareActive}
              canvasRef={canvasRef} onImageDrop={handleFileUpload}
            />
          </div>
          {isDesktop && <div className="studio-properties-column">{propertiesWorkspace}</div>}
          {!isDesktop && <nav className="studio-mobile-panels" aria-label="Studio panels">
            <button type="button" onClick={() => setMobilePanel('layers')}><Layers size={18}/><span><StudioButtonLabel>{`Layers (${liveState.regions.length})`}</StudioButtonLabel></span></button>
            <button type="button" onClick={() => setMobilePanel('properties')}><Sliders size={18}/><span><StudioButtonLabel>Properties</StudioButtonLabel></span></button>
          </nav>}
          {!isDesktop && <Dialog.Root open={mobilePanel !== null} onOpenChange={open => {if (!open) setMobilePanel(null);}}>
            <Dialog.Portal>
              <div className="studio-ui studio-mobile-inspector fixed inset-0 z-50 flex justify-end">
                <Dialog.Backdrop className="fixed inset-0 bg-black/70" />
                <Dialog.Popup className="inspector-dialog studio-panel-dialog relative z-10 flex h-full max-w-full flex-col border-l border-studio-line">
                  <div className={`studio-panel-dialog-header${mobilePanel === 'layers' ? ' is-layers' : ''}`}>
                    <Dialog.Title className={mobilePanel === 'layers' ? 'sr-only' : undefined}>{mobilePanel === 'layers' ? 'Layers' : 'Properties'}</Dialog.Title>
                    <div>{mobilePanel === 'properties' && <button type="button" onClick={() => setMobilePanel('layers')}><Layers size={16}/><StudioButtonLabel>{`Layers (${liveState.regions.length})`}</StudioButtonLabel></button>}
                    <Dialog.Close aria-label="Close studio panel"><X size={18}/></Dialog.Close></div>
                  </div>
                  <div className="studio-panel-dialog-content">{mobilePanel === 'layers' ? <LayerPanel {...layerPanelProps} /> : propertiesWorkspace}</div>
                </Dialog.Popup>
              </div>
            </Dialog.Portal>
          </Dialog.Root>}
        </main>
        </ParameterHistoryProvider>
      )}

      {/* ==================== SECTION 3: RECIPES ==================== */}
      {activeSection === 'recipes' && (
        <RecipesView
          image={image}
          recipes={allRecipes}
          activeRecipeId={activeRecipeId}
          lockLayoutOnRecipe={lockLayoutOnRecipe}
          onToggleLockLayout={() => setLockLayoutOnRecipe((v) => !v)}
          onApplyRecipeAndOpenEditor={(recipe) => {
            handleApplyRecipe(recipe);
            setActiveSection('editor');
          }}
          onSaveCustomRecipe={handleSaveCustomRecipe}
          onDeleteCustomRecipe={handleDeleteCustomRecipe}
          onExportRecipeJson={handleExportRecipeJson}
        />
      )}

      {/* ==================== SECTION 4: FAQ ==================== */}
      {activeSection === 'faq' && <FaqView />}

      <Dialog.Root open={isExportDialogOpen} onOpenChange={open => {if (!open && isRecordingVideo) cancelVideoRef.current?.(); if (!isExporting) setIsExportDialogOpen(open);}}>
        <Dialog.Portal>
          <div className="studio-ui studio-export-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Backdrop className="studio-export-backdrop fixed inset-0 bg-black/75" />
            <Dialog.Popup className="studio-export-dialog relative z-10 w-full max-w-lg max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-studio-line bg-studio-ink p-6 text-studio-paper">
              <div className="studio-export-heading flex items-center justify-between gap-4">
                <Dialog.Title className="text-xl font-semibold">Export your work</Dialog.Title>
                <Dialog.Close aria-label="Close export options" className="flex h-11 w-11 items-center justify-center border border-studio-line"><X size={18} /></Dialog.Close>
              </div>
              <Dialog.Description className="studio-export-note mt-2 text-sm text-studio-muted">Export the static image, capture an animation frame, or record the 3-second clip.</Dialog.Description>
              <div className="studio-export-tabs studio-segmented mt-5 grid grid-cols-2" role="group" aria-label="Export type">
                <button type="button" aria-pressed={exportTab === 'photo'} onClick={() => selectExportTab('photo')} className="flex min-h-11 items-center justify-center gap-2"><Download size={16} /><span><StudioButtonLabel>Photo</StudioButtonLabel></span></button>
                <button type="button" aria-pressed={exportTab === 'video'} onClick={() => selectExportTab('video')} className="flex min-h-11 items-center justify-center gap-2"><Video size={16} /><span><StudioButtonLabel>Video clip</StudioButtonLabel></span></button>
              </div>
              <ExportPreview image={image} snapshot={exportSnapshot}/>
              {soloRegionId && <p className="studio-export-note">Solo is a view tool. This export uses the saved visibility of all layers, as shown above.</p>}
              {exportTab === 'photo' ? (
                <section aria-label="Photo export options" className="mt-5">
                  <fieldset disabled={isExporting || isRecordingVideo} className="studio-export-fields grid gap-4">
                    <label className="grid gap-2 text-sm">Photo format
                      <select aria-label="Photo format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as 'png' | 'webp')} className="min-h-11 w-full rounded-lg border border-studio-line bg-studio-raised px-3">
                        <option value="png">PNG · lossless</option><option value="webp">WebP · smaller file</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm">Photo size
                      <select aria-label="Photo size" value={exportScale} onChange={(event) => setExportScale(Number(event.target.value) as 1 | 2)} className="min-h-11 w-full rounded-lg border border-studio-line bg-studio-raised px-3">
                        <option value={1}>1× · source dimensions</option><option value={2}>2× · larger render, same source detail</option>
                      </select>
                    </label>
                    {exportFormat === 'webp' && <label className="grid gap-2 text-sm">WebP quality
                      <select aria-label="WebP quality" value={webpQuality} onChange={(event) => setWebpQuality(Number(event.target.value))} className="min-h-11 w-full rounded-lg border border-studio-line bg-studio-raised px-3">
                        {WEBP_QUALITIES.map((quality) => <option key={quality.value} value={quality.value}>{quality.label}</option>)}
                      </select>
                    </label>}
                  </fieldset>
                  <p className="studio-export-note mt-4 text-sm text-studio-muted">{exportFormat === 'png' ? 'PNG preserves detail and transparency without compression loss.' : 'WebP uses lossy compression. Higher quality retains more detail and creates a larger file.'} {exportSnapshot?.intent === 'animate' ? `Captured animation frame at ${exportSnapshot.time.toFixed(2)} s.` : 'This saves your static composition.'}</p>
                  <p className="studio-export-summary mt-4 font-mono text-sm">{image ? `${image.naturalWidth * exportScale} × ${image.naturalHeight * exportScale} px · ${exportFormat.toUpperCase()}` : 'Load a photo to export.'}</p>
                  <button type="button" onClick={handleExportImage} data-export="image" disabled={isExporting || isRecordingVideo || !image} className="studio-export-action mt-5 flex min-h-11 w-full items-center justify-center gap-2 px-4 py-3 disabled:opacity-40"><Download size={16} /><span><StudioButtonLabel>{isExporting ? 'Exporting photo…' : 'Download photo'}</StudioButtonLabel></span></button>
                </section>
              ) : (
                <section aria-label="Video clip export options" className="mt-5">
                  {videoFormats.length ? <>
                    <fieldset disabled={isExporting || isRecordingVideo} className="studio-export-fields grid gap-4">
                      <label className="grid gap-2 text-sm">Video format
                        <select aria-label="Video format" value={videoMimeType} onChange={(event) => setVideoMimeType(event.target.value)} className="min-h-11 w-full rounded-lg border border-studio-line bg-studio-raised px-3">
                          {videoFormats.map((format) => <option key={format.mimeType} value={format.mimeType}>{format.label}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm">Maximum long edge
                        <select aria-label="Video size" value={videoSize} onChange={(event) => setVideoSize(Number(event.target.value) as VideoSize)} className="min-h-11 w-full rounded-lg border border-studio-line bg-studio-raised px-3">
                          {[720,1080,1440].map((size) => <option key={size} value={size}>{size} px</option>)}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm">Video quality
                        <select aria-label="Video quality" value={videoQuality} onChange={(event) => setVideoQuality(event.target.value as VideoQuality)} className="min-h-11 w-full rounded-lg border border-studio-line bg-studio-raised px-3">
                          {VIDEO_QUALITIES.map((quality) => <option key={quality.id} value={quality.id}>{quality.label}</option>)}
                        </select>
                      </label>
                    </fieldset>
                    <p className="studio-export-note mt-4 text-sm text-studio-muted">{selectedVideoFormat?.extension === 'webm' ? 'WebM records in your browser. MP4 appears when supported.' : 'This browser supports MP4 recording.'} Quality sets a target bitrate; actual bitrate can vary.</p>
                    <p className="studio-export-summary mt-4 font-mono text-sm">{videoDimensions ? `${videoDimensions.width} × ${videoDimensions.height} px · ${selectedVideoFormat?.label}` : 'Load a photo to export.'}</p>
                    <p className="studio-export-note mt-2 text-sm text-studio-muted">About 3 seconds · up to 30 fps · no audio. Records the clip from 0 to 3 s. The join may jump; this is not a guaranteed seamless loop. Keep this tab visible.</p>
                  </> : <p role="status" className="studio-export-note text-sm text-studio-muted">Video recording is unavailable in this browser. Photo export is still available.</p>}
                  {isRecordingVideo && <button type="button" className="studio-export-cancel" onClick={() => cancelVideoRef.current?.()}><StudioButtonLabel>Cancel recording</StudioButtonLabel></button>}
                  <button type="button" onClick={handleExportVideoLoop} data-export="video" disabled={isExporting || isRecordingVideo || !image || !selectedVideoFormat} className="studio-export-action mt-5 flex min-h-11 w-full items-center justify-center gap-2 border border-studio-line px-4 py-3 disabled:opacity-40"><Video size={16} /><span><StudioButtonLabel>{isRecordingVideo ? 'Recording video…' : 'Download video clip'}</StudioButtonLabel></span></button>
                </section>
              )}
            </Dialog.Popup>
          </div>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Global Studio Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
