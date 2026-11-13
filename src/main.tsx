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

initStore().then(() => render(<App />, document.getElementById('root')!));
if ('serviceWorker' in navigator && !import.meta.env.DEV) registerSW({ immediate: true });

// Test hook used by the automated smoke tests (read-only helpers + render).
import { getSong, update } from './store';
import { renderSong } from './audio/export';
import { runPolish } from './audio/polishClient';
import { trackPitch } from './audio/polishDsp';
import { applyRecipe, applyTempo } from './actions';
import { polishContext } from './audio/takes';
import { contextMode } from './ui/App';
import { midiToName } from './theory';
import { setUi, ui } from './ui/ui';
import { takeSectionTranspose, TAKE_PREROLL_SEC } from './audio/compose';
import { VOICES, voiceById } from './audio/library';
import { keyAfterTranspose } from './theory';
import { toneCutoffHz, mixHasMacros, macrosForTrack, sendLevel, LEGACY_MACROS, DEFAULT_MACROS } from './audio/macros';
import { trimTakeToSection, trimTakeToSectionFloor, takeLookupTime, TAKE_SECTION_SLOP_SEC } from './audio/takeTiming';
import { migrate as migrateSong } from './store';
(window as any).__mq = { getSong, update, renderSong, runPolish, trackPitch, applyRecipe, applyTempo, polishContext, contextMode, midiToName, setUi, ui, takeSectionTranspose, TAKE_PREROLL_SEC, VOICES, voiceById, keyAfterTranspose, toneCutoffHz, mixHasMacros, macrosForTrack, sendLevel, LEGACY_MACROS, DEFAULT_MACROS,
  trimTakeToSection, trimTakeToSectionFloor, takeLookupTime, TAKE_SECTION_SLOP_SEC, migrateSong };
