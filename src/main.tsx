import { render } from 'preact';
import { App } from './ui/App';
import { initStore } from './store';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

// The app has no routes: if a deep link or the 404.html fallback landed us below the base path,
// go back to the base so relative asset URLs (dictionary, worklet, licenses) resolve correctly.
{
  const baseUrl = new URL(import.meta.env.BASE_URL, location.href);
  if (import.meta.env.BASE_URL.startsWith('/') && location.pathname !== baseUrl.pathname && location.pathname !== baseUrl.pathname + 'index.html') {
    history.replaceState(null, '', baseUrl.pathname + location.search + location.hash);
  }
}

// Test hook for automated smoke/regression tests.
// - Local `vite` (DEV): always on
// - CI preview builds: set VITE_TEST_HOOKS=true
// - Normal production Pages builds: omitted (keeps proprietary internals off window)
const enableTestHooks = import.meta.env.DEV || import.meta.env.VITE_TEST_HOOKS === 'true';

async function boot() {
  if (enableTestHooks) {
    const { FINISHES, finishOf, softClip } = await import('./audio/master');
    const { getSong, update, migrate: migrateSong } = await import('./store');
    const { renderSong } = await import('./audio/export');
    const { runPolish } = await import('./audio/polishClient');
    const { trackPitch } = await import('./audio/polishDsp');
    const { applyRecipe, applyTempo } = await import('./actions');
    const { polishContext } = await import('./audio/takes');
    const { contextMode } = await import('./ui/App');
    const { midiToName, keyAfterTranspose } = await import('./theory');
    const { setUi, ui } = await import('./ui/ui');
    const { takeSectionTranspose, TAKE_PREROLL_SEC } = await import('./audio/compose');
    const { VOICES, voiceById } = await import('./audio/library');
    const { toneCutoffHz, mixHasMacros, macrosForTrack, sendLevel, LEGACY_MACROS, DEFAULT_MACROS } = await import('./audio/macros');
    const { trimTakeToSection, trimTakeToSectionFloor, takeLookupTime, TAKE_SECTION_SLOP_SEC } = await import('./audio/takeTiming');
    const { isPlaying, stop, play } = await import('./audio/engine');
    (window as any).__mq = {
      FINISHES, finishOf, softClip, getSong, update, migrateSong, renderSong, runPolish, trackPitch,
      applyRecipe, applyTempo, polishContext, contextMode, midiToName, keyAfterTranspose, setUi, ui,
      takeSectionTranspose, TAKE_PREROLL_SEC, VOICES, voiceById, toneCutoffHz, mixHasMacros, macrosForTrack,
      sendLevel, LEGACY_MACROS, DEFAULT_MACROS, trimTakeToSection, trimTakeToSectionFloor, takeLookupTime,
      TAKE_SECTION_SLOP_SEC, isPlaying, stop, play,
    };
  }
  await initStore();
  render(<App />, document.getElementById('root')!);
  if ('serviceWorker' in navigator && !import.meta.env.DEV) registerSW({ immediate: true });
}

void boot();
