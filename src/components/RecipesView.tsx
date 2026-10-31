import React, { useEffect, useRef, useState } from 'react';
import type { Recipe, StudioState } from '../engine/types';
import { GLYPH_RAMPS, DEFAULT_BASE_CANVAS } from '../engine/types';
import { renderStudioFrame } from '../engine/renderer';
import './recipes.css';
import {
  Sparkles,
  Lock,
  Unlock,
  BookmarkPlus,
  FileJson,
  Trash2,
  ArrowUpRight,
  Layers,
  Maximize2,
  Combine,
  Check,
} from 'lucide-react';

interface RecipesViewProps {
  image: HTMLImageElement | null;
  recipes: Recipe[];
  activeRecipeId: string | null;
  lockLayoutOnRecipe: boolean;
  onToggleLockLayout: () => void;
  onApplyRecipeAndOpenEditor: (recipe: Recipe) => void;
  onSaveCustomRecipe: (name: string, tagline: string) => void;
  onDeleteCustomRecipe: (id: string) => void;
  onExportRecipeJson: () => void;
}

const RecipeCard: React.FC<{
  image: HTMLImageElement | null;
  recipe: Recipe;
  isActive: boolean;
  onApply: (recipe: Recipe) => void;
  onDelete?: (id: string) => void;
}> = ({ image, recipe, isActive, onApply, onDelete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const targetW = 420;
    const ratio = image.naturalWidth / image.naturalHeight;
    const targetH = Math.max(220, Math.round(targetW / ratio));
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderStudioFrame(ctx, image, recipe.state, {
      time: 1.4,
      scale: targetW / 1000,
      showOriginalOnly: false,
    });
  }, [image, recipe.state]);

  const mode = recipe.state.baseCanvas?.mode ?? DEFAULT_BASE_CANVAS.mode;
  const primaryStyle =
    mode === 'full'
      ? recipe.state.baseCanvas?.glyphFamily ?? 'density'
      : recipe.state.regions[0]?.glyphFamily ??
        recipe.state.baseCanvas?.glyphFamily ??
        'density';
  const styleInfo = GLYPH_RAMPS[primaryStyle] ?? GLYPH_RAMPS.density;

  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`recipe-card group ${isActive ? 'is-active' : ''}`}
    >
      {/* Live Canvas Thumbnail */}
      <div className="relative overflow-hidden border-b border-white/10 bg-black">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${recipe.name} applied to the current photograph`}
          className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />

        {/* Mode Pill */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/80 px-2.5 py-1 font-mono text-sm font-semibold text-zinc-200">
          {mode === 'full' ? (
            <>
              <Maximize2 className="h-3 w-3 text-emerald-400" />
              <span>FULL FRAME</span>
            </>
          ) : mode === 'hybrid' ? (
            <>
              <Combine className="h-3 w-3 text-sky-400" />
              <span>HYBRID</span>
            </>
          ) : (
            <>
              <Layers className="h-3 w-3 text-amber-400" />
              <span>{recipe.state.regions.length} {recipe.state.regions.length === 1 ? 'LAYER' : 'LAYERS'}</span>
            </>
          )}
        </div>

        {/* Category Badge */}
        <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/80 px-2.5 py-0.5 font-mono text-sm font-bold text-zinc-300 uppercase">
          {recipe.category}
        </div>
      </div>

      {/* Card Content */}
      <div className="relative z-10 flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: recipe.badgeColor,
                }}
              />
              <h3>
                {recipe.name}
              </h3>
            </div>

            {recipe.isCustom && onDelete && (
              <div
                className="flex items-center gap-1"
                data-delete
                onClick={(e) => e.stopPropagation()}
              >
                {confirmDelete ? (
                  <div className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/20 px-1.5 py-0.5">
                    <span className="font-mono text-sm font-bold text-rose-300">
                      Delete?
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(recipe.id)}
                      className="rounded px-1.5 py-0.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 transition"
                      title="Confirm deletion"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded px-1.5 py-0.5 text-sm text-zinc-300 hover:text-white transition"
                      title="Cancel deletion"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(true);
                    }}
                    className="rounded-lg p-1 text-zinc-400 transition hover:bg-rose-500/20 hover:text-rose-400"
                    title="Delete custom recipe"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="font-tech mt-1.5 text-sm leading-relaxed text-zinc-400">
            {recipe.tagline}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-sm">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="recipe-engine-glyph">
              {styleInfo.shortLabel}
            </span>
            <span className="truncate">{styleInfo.name}</span>
          </div>

          <button type="button" data-apply aria-label={`Apply ${recipe.name}`} onClick={() => onApply(recipe)} className="flex min-h-11 items-center gap-1 font-semibold text-emerald-400 group-hover:underline">
            <span>{isActive ? 'CURRENT LOOK' : 'USE RECIPE'}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const RecipesView: React.FC<RecipesViewProps> = ({
  image,
  recipes,
  activeRecipeId,
  lockLayoutOnRecipe,
  onToggleLockLayout,
  onApplyRecipeAndOpenEditor,
  onSaveCustomRecipe,
  onDeleteCustomRecipe,
  onExportRecipeJson,
}) => {
  const [recipeFilter, setRecipeFilter] = useState<string>('ALL');
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeTagline, setNewRecipeTagline] = useState('');

  const filteredRecipes =
    recipeFilter === 'ALL'
      ? recipes
      : recipes.filter((r) => r.category === recipeFilter);

  return (
    <main className="page-scroll custom-scrollbar signal-recipes" aria-label="Recipes">
      <div className="collection-page">
        {/* Header & Controls Bar */}
        <div className="collection-header">
          <div>
            <h1>FIND YOUR<br />NEXT LOOK.</h1>
            <p>A starting point, not a finished picture. Try a recipe on your photo, then make it your own in the studio.</p>
          </div>
          <div className="recipe-tools">
            {/* Lock Layout Toggle */}
            <button
              type="button"
              onClick={onToggleLockLayout}
              aria-pressed={lockLayoutOnRecipe}
              className="recipe-layout-toggle"
            >
              {lockLayoutOnRecipe ? (
                <Lock className="h-4 w-4 text-emerald-400" />
              ) : (
                <Unlock className="h-4 w-4 text-zinc-400" />
              )}
              <div>
                <div className="font-mono text-sm font-bold">
                  {lockLayoutOnRecipe ? 'Layers stay in place' : 'Keep my layers'}
                </div>
                <div className="font-tech text-sm text-zinc-400">
                  {lockLayoutOnRecipe
                    ? 'Only the treatment changes'
                    : 'Use each recipe’s layout by default'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsSavingRecipe((v) => !v)}
              aria-expanded={isSavingRecipe}
              className="recipe-save-toggle"
            >
              <BookmarkPlus className="h-4 w-4" />
              <span>Save recipe</span>
            </button>

            <button
              type="button"
              onClick={onExportRecipeJson}
              className="recipe-export"
            >
              <FileJson className="h-4 w-4 text-zinc-400" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Inline Modal: Save Custom Recipe */}
        {isSavingRecipe && (
          <form className="recipe-save space-y-4" onSubmit={(event) => {
            event.preventDefault();
            if(!newRecipeName.trim()) return;
            onSaveCustomRecipe(newRecipeName.trim(),newRecipeTagline.trim());
            setNewRecipeName(''); setNewRecipeTagline(''); setIsSavingRecipe(false);
          }}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="recipe-save-title">
                Save Current Setup as Custom Recipe
              </span>
              <button
                type="button"
                onClick={() => setIsSavingRecipe(false)}
                className="text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>Recipe name<input
                required
                autoFocus
                type="text"
                placeholder="Recipe name (e.g. Cyber Silver 4K)"
                value={newRecipeName}
                onChange={(e) => setNewRecipeName(e.target.value)}
                className="recipe-field"
              /></label>
              <label>Description (optional)<input
                type="text"
                placeholder="Short description (e.g. Fine intaglio with gentle tracking drift)"
                value={newRecipeTagline}
                onChange={(e) => setNewRecipeTagline(e.target.value)}
                className="recipe-field"
              /></label>
            </div>
            <button
              type="submit"
              disabled={!newRecipeName.trim()}
              className="recipe-save-submit"
            >
              <Check className="h-4 w-4" />
              <span>Save to Local Browser</span>
            </button>
          </form>
        )}

        {/* Category Filter Pills */}
        <div className="recipe-filters" aria-label="Recipe categories">
          {(
            [
              { id: 'ALL', label: 'All Recipes' },
              { id: 'Terminal', label: 'Terminal CRT' },
              { id: 'Full Artwork', label: 'Full Artwork' },
              { id: 'Print & Dither', label: 'Print & Dither' },
              { id: 'Signal & VHS', label: 'Signal & VHS' },
              { id: 'Custom', label: 'My Recipes' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setRecipeFilter(cat.id)}
              aria-pressed={recipeFilter === cat.id}
              className="recipe-filter"
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Recipes Grid */}
        <div className="recipe-grid">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              image={image}
              recipe={recipe}
              isActive={activeRecipeId === recipe.id}
              onApply={onApplyRecipeAndOpenEditor}
              onDelete={onDeleteCustomRecipe}
            />
          ))}
        </div>
        {filteredRecipes.length === 0 && <div className="empty-recipes"><h2>Your recipes start here.</h2><p>Save a setup from the studio to keep its style, layers and color. It will be stored in this browser.</p><button type="button" className="text-action" onClick={() => setIsSavingRecipe(true)}>Save the current setup <ArrowUpRight size={16} /></button></div>}
      </div>
    </main>
  );
};
