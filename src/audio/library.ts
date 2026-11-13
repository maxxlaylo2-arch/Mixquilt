// Catalog of in-app synthesized instrument voices. No samples, no AI.
// Builders live in voices.ts; this file is the discoverable list (names, categories, uses).

export type VoiceRole = 'kit' | 'bass' | 'chords' | 'lead';
export type VoiceCategory =
  | 'drum-kits'
  | '808-bass'
  | 'keys-pads'
  | 'plucks'
  | 'leads'
  | 'textures';

export interface VoiceDef {
  id: string;
  role: VoiceRole;
  category: VoiceCategory;
  name: string;
  character: string;
  genres: string[];
  /** True for voices that shipped in v0.1. */
  classic?: boolean;
}

export const VOICE_CATEGORIES: { id: VoiceCategory; label: string; roles: VoiceRole[] }[] = [
  { id: 'drum-kits', label: 'Drum kits', roles: ['kit'] },
  { id: '808-bass', label: '808 & bass', roles: ['bass'] },
  { id: 'keys-pads', label: 'Keys & pads', roles: ['chords'] },
  { id: 'plucks', label: 'Plucks', roles: ['chords', 'lead'] },
  { id: 'leads', label: 'Leads', roles: ['lead'] },
  { id: 'textures', label: 'Textures & FX', roles: ['chords', 'lead'] },
];

export const VOICES: VoiceDef[] = [
  // ----- Drum kits (classic 5 + 15) -----
  { id: 'boom808', role: 'kit', category: 'drum-kits', name: '808 boom', character: 'Long pitched kick, dry clap, tight hats.', genres: ['Trap', 'Hip-hop'], classic: true },
  { id: 'dusty', role: 'kit', category: 'drum-kits', name: 'Dusty', character: 'Pink-noise snare, muted top, tape-like air.', genres: ['Lo-fi', 'Soul', 'Boom-bap'], classic: true },
  { id: 'tight', role: 'kit', category: 'drum-kits', name: 'Tight', character: 'Short kick, snappy snare, crisp hats.', genres: ['Pop', 'R&B', 'Trap'], classic: true },
  { id: 'organic', role: 'kit', category: 'drum-kits', name: 'Organic', character: 'Soft kick, shaker-like perc, short hats.', genres: ['Afrobeats', 'Folk', 'Amapiano'], classic: true },
  { id: 'big', role: 'kit', category: 'drum-kits', name: 'Big room', character: 'Huge kick, long snare, festival punch.', genres: ['House', 'Club', 'Cinematic'], classic: true },
  { id: 'gospelclap', role: 'kit', category: 'drum-kits', name: 'Gospel clap', character: 'Punchy kick, stacked claps, tambourine-ish perc.', genres: ['Gospel', 'Trap', 'Soul'] },
  { id: 'trapdark', role: 'kit', category: 'drum-kits', name: 'Dark trap', character: 'Hard short kick and clap-snare through a dark body filter; hats stay crisp and bypass that filter.', genres: ['Trap', 'Drill', 'Phonk'] },
  { id: 'phonkbell', role: 'kit', category: 'drum-kits', name: 'Phonk bell', character: 'Crunchy snare, mid kick, synthesized cowbell perc.', genres: ['Phonk', 'Trap', 'Club'] },
  { id: 'lofitape', role: 'kit', category: 'drum-kits', name: 'Lo-fi tape', character: 'Muted kick, soft snare, dusty hats, worn air.', genres: ['Lo-fi', 'R&B', 'Soul'] },
  { id: 'worldpulse', role: 'kit', category: 'drum-kits', name: 'World pulse', character: 'Talking-drum kick, conga-like perc, shaker hats.', genres: ['Afrobeats', 'Amapiano', 'World'] },
  { id: 'technoclick', role: 'kit', category: 'drum-kits', name: 'Techno click', character: 'Clicky kick, sharp snare, tight analog ticks.', genres: ['Techno', 'House', 'Club'] },
  { id: 'boombapcrunch', role: 'kit', category: 'drum-kits', name: 'Boom-bap crunch', character: 'Crunchy mid snare, rounded kick, roomy hats.', genres: ['Boom-bap', 'Hip-hop', 'Jazz'] },
  { id: 'drillhat', role: 'kit', category: 'drum-kits', name: 'Drill hats', character: 'Thin snare, punchy kick, hissy rolling hats.', genres: ['Drill', 'Trap'] },
  { id: 'amapianoshek', role: 'kit', category: 'drum-kits', name: 'Amapiano shek', character: 'Shaker-forward groove, log-adjacent kick, wood rim.', genres: ['Amapiano', 'Afrobeats', 'House'] },
  { id: 'industrial', role: 'kit', category: 'drum-kits', name: 'Industrial', character: 'Distorted kick, metallic snare, clang perc.', genres: ['Industrial', 'Techno', 'Experimental'] },
  { id: 'jazzbrush', role: 'kit', category: 'drum-kits', name: 'Jazz brush', character: 'Soft kick, brush-noise snare, airy hats.', genres: ['Jazz', 'Lo-fi', 'Soul'] },
  { id: 'gospelroom', role: 'kit', category: 'drum-kits', name: 'Gospel room', character: 'Roomy kick, wide clap, church-tambourine sparkle.', genres: ['Gospel', 'Soul', 'Cinematic'] },
  { id: 'glitchtick', role: 'kit', category: 'drum-kits', name: 'Glitch tick', character: 'Short digital ticks, bit-crushed hats, click perc.', genres: ['Experimental', 'Club', 'IDM'] },
  { id: 'rimshot', role: 'kit', category: 'drum-kits', name: 'Rim shot', character: 'Rim-heavy snare, tight kick, woodblock perc.', genres: ['Pop', 'R&B', 'Funk'] },
  { id: 'halo', role: 'kit', category: 'drum-kits', name: 'Halo kit', character: 'Soft kick, airy open hats, shimmering perc.', genres: ['Dream pop', 'Ambient', 'Experimental'] },

  // ----- Bass (classic 5 + 15) -----
  { id: 'sub', role: 'bass', category: '808-bass', name: 'Sub 808', character: 'Sine 808 with a touch of grit and short glide.', genres: ['Trap', 'Hip-hop'], classic: true },
  { id: 'round', role: 'bass', category: '808-bass', name: 'Round bass', character: 'Warm triangle bass, short and musical.', genres: ['R&B', 'Lo-fi', 'Soul'], classic: true },
  { id: 'analog', role: 'bass', category: '808-bass', name: 'Analog', character: 'Filtered square mono bass.', genres: ['Synthwave', 'Funk', 'Pop'], classic: true },
  { id: 'saw', role: 'bass', category: '808-bass', name: 'Saw bass', character: 'Aggressive saw with a moving filter.', genres: ['Trap', 'EDM', 'Phonk'], classic: true },
  { id: 'log', role: 'bass', category: '808-bass', name: 'Log drum', character: 'Pitched percussive log-drum bass.', genres: ['Amapiano', 'Afrobeats'], classic: true },
  { id: 'subglide', role: 'bass', category: '808-bass', name: 'Glide 808', character: 'Sub 808 with a longer scooping glide.', genres: ['Trap', 'Drill'] },
  { id: 'dirty808', role: 'bass', category: '808-bass', name: 'Dirty 808', character: 'Overdriven 808 with crunchy harmonics.', genres: ['Trap', 'Phonk', 'Drill'] },
  { id: 'reese', role: 'bass', category: '808-bass', name: 'Reese', character: 'Detuned saws, dark and wide.', genres: ['Drum & bass', 'Techno', 'UK'] },
  { id: 'growl', role: 'bass', category: '808-bass', name: 'Growl', character: 'Mid growl with a tight filter bite.', genres: ['Dubstep', 'Trap', 'Experimental'] },
  { id: 'acid', role: 'bass', category: '808-bass', name: 'Acid', character: 'Resonant 303-style squelch.', genres: ['Acid', 'House', 'Techno'] },
  { id: 'rubber', role: 'bass', category: '808-bass', name: 'Rubber', character: 'Bouncy sine with a soft click on top.', genres: ['Funk', 'Pop', 'Afrobeats'] },
  { id: 'moogish', role: 'bass', category: '808-bass', name: 'Moogish', character: 'Warm low-pass mono, classic analog feel.', genres: ['Funk', 'Synthwave', 'Soul'] },
  { id: 'tapebass', role: 'bass', category: '808-bass', name: 'Tape bass', character: 'Wobbly, slightly saturated low end.', genres: ['Lo-fi', 'Soul', 'R&B'] },
  { id: 'fmbass', role: 'bass', category: '808-bass', name: 'FM bass', character: 'Punchy FM attack, tight body.', genres: ['Drum & bass', 'Club', 'Pop'] },
  { id: 'organbass', role: 'bass', category: '808-bass', name: 'Organ pedal', character: 'Organ-pedal tone, church-basement low.', genres: ['Gospel', 'Soul', 'Jazz'] },
  { id: 'choirsub', role: 'bass', category: '808-bass', name: 'Choir sub', character: 'Sub with a gentle vocal formant.', genres: ['Gospel', 'Cinematic', 'Experimental'] },
  { id: 'drone', role: 'bass', category: '808-bass', name: 'Drone', character: 'Long dark drone, barely decays.', genres: ['Cinematic', 'Ambient', 'Experimental'] },
  { id: 'wobble', role: 'bass', category: '808-bass', name: 'Wobble', character: 'Slow filter movement, bass-music nod.', genres: ['Dubstep', 'Experimental', 'Club'] },
  { id: 'hooverbass', role: 'bass', category: '808-bass', name: 'Hoover bass', character: 'Raucous hoover-adjacent low saws.', genres: ['Rave', 'Club', 'Experimental'] },
  { id: 'glassbass', role: 'bass', category: '808-bass', name: 'Glass bass', character: 'Hollow glassy FM low end.', genres: ['Experimental', 'Pop', 'Cinematic'] },

  // ----- Keys, pads, plucks, textures as chord voices (classic 7 + 20) -----
  { id: 'pad', role: 'chords', category: 'keys-pads', name: 'Airy pad', character: 'Slow fatsaw pad, soft and wide.', genres: ['Pop', 'R&B', 'Cinematic'], classic: true },
  { id: 'ekeys', role: 'chords', category: 'keys-pads', name: 'Electric keys', character: 'Bell-ish FM electric piano.', genres: ['R&B', 'Lo-fi', 'Soul'], classic: true },
  { id: 'organ', role: 'chords', category: 'keys-pads', name: 'Organ', character: 'Tonewheel-style drawbar organ.', genres: ['Gospel', 'Soul', 'Rock'], classic: true },
  { id: 'pluck', role: 'chords', category: 'plucks', name: 'Plucks', character: 'Short triangle plucks.', genres: ['Pop', 'Afrobeats', 'House'], classic: true },
  { id: 'strings', role: 'chords', category: 'keys-pads', name: 'Strings', character: 'Slow ensemble saw strings.', genres: ['Cinematic', 'Pop', 'Soul'], classic: true },
  { id: 'wide', role: 'chords', category: 'keys-pads', name: 'Wide synth', character: 'Wide fatsquare synth chords.', genres: ['Synthwave', 'Pop', 'Club'], classic: true },
  { id: 'piano', role: 'chords', category: 'keys-pads', name: 'Piano', character: 'Synthesized piano with a quick hammer.', genres: ['Pop', 'Gospel', 'Ballad'], classic: true },
  { id: 'choirpad', role: 'chords', category: 'keys-pads', name: 'Choir pad', character: 'Formant “aah” choir-like pad.', genres: ['Gospel', 'Cinematic', 'Pop'] },
  { id: 'gospelorg', role: 'chords', category: 'keys-pads', name: 'Gospel organ', character: 'Drawbar-style organ with a fast chorus swirl, not a modeled Leslie.', genres: ['Gospel', 'Soul', 'Trap'] },
  { id: 'glasspad', role: 'chords', category: 'keys-pads', name: 'Glass pad', character: 'Glassy FM pad, transparent and cold.', genres: ['Ambient', 'Pop', 'Experimental'] },
  { id: 'shimmer', role: 'chords', category: 'textures', name: 'Shimmer', character: 'Granular-ish octave sparkle over a soft pad.', genres: ['Ambient', 'Cinematic', 'Experimental'] },
  { id: 'bowed', role: 'chords', category: 'textures', name: 'Bowed metal', character: 'Slow bowed attack, inharmonic metallic partials.', genres: ['Cinematic', 'Experimental', 'Ambient'] },
  { id: 'tapepiano', role: 'chords', category: 'keys-pads', name: 'Tape piano', character: 'Piano with wow, dull highs, and tape hiss air.', genres: ['Lo-fi', 'Soul', 'Ballad'] },
  { id: 'rhodes', role: 'chords', category: 'keys-pads', name: 'Rhodes', character: 'Bell-tine electric piano, warmer than e-keys.', genres: ['R&B', 'Jazz', 'Soul'] },
  { id: 'wurli', role: 'chords', category: 'keys-pads', name: 'Wurli', character: 'Barkier reed-style electric piano.', genres: ['Funk', 'Soul', 'Rock'] },
  { id: 'churchorg', role: 'chords', category: 'keys-pads', name: 'Church organ', character: 'Pipe-like principal organ, long and airy.', genres: ['Gospel', 'Cinematic', 'Classical'] },
  { id: 'analogpad', role: 'chords', category: 'keys-pads', name: 'Analog pad', character: 'Warm, slightly detuned analog chord pad.', genres: ['Synthwave', 'Pop', 'Dream'] },
  { id: 'motionpad', role: 'chords', category: 'keys-pads', name: 'Motion pad', character: 'Fat saw pad with a slow auto-filter sweep and chorus.', genres: ['Pop', 'Ambient', 'R&B'] },
  { id: 'voxstab', role: 'chords', category: 'textures', name: 'Vocal stabs', character: 'Short formant “vocal-chop” chord stabs.', genres: ['House', 'Pop', 'Experimental'] },
  { id: 'darkpad', role: 'chords', category: 'keys-pads', name: 'Dark pad', character: 'Low, smoky cinematic pad.', genres: ['Cinematic', 'Trap', 'Ambient'] },
  { id: 'harp', role: 'chords', category: 'plucks', name: 'Harp', character: 'Bright rolled-harp plucks.', genres: ['Cinematic', 'Folk', 'Pop'] },
  { id: 'kalimba', role: 'chords', category: 'plucks', name: 'Kalimba', character: 'Thumb-piano tines, hollow and sweet.', genres: ['Afrobeats', 'Folk', 'Lo-fi'] },
  { id: 'nylon', role: 'chords', category: 'plucks', name: 'Nylon pluck', character: 'Nylon-guitar-like pluck.', genres: ['Pop', 'Folk', 'R&B'] },
  { id: 'harpsi', role: 'chords', category: 'plucks', name: 'Harpsichord', character: 'Nasal, quick-decay harpsichord-ish bite.', genres: ['Baroque-pop', 'Experimental', 'Folk'] },
  { id: 'noisepool', role: 'chords', category: 'textures', name: 'Noise pool', character: 'Soft pitched-noise texture bed.', genres: ['Ambient', 'Experimental', 'Lo-fi'] },
  { id: 'crystal', role: 'chords', category: 'textures', name: 'Crystal', character: 'Clustered crystal bells as chords.', genres: ['Pop', 'Ambient', 'Cinematic'] },
  { id: 'tapevox', role: 'chords', category: 'textures', name: 'Tape choir', character: 'Worn formant choir on slightly warbly tape.', genres: ['Gospel', 'Lo-fi', 'Cinematic'] },

  // ----- Leads (classic 6 + 15) -----
  { id: 'bell', role: 'lead', category: 'leads', name: 'Bell', character: 'Bright FM bell.', genres: ['Trap', 'Pop', 'R&B'], classic: true },
  { id: 'softlead', role: 'lead', category: 'leads', name: 'Soft lead', character: 'Gentle triangle lead.', genres: ['Pop', 'R&B', 'Lo-fi'], classic: true },
  { id: 'flute', role: 'lead', category: 'leads', name: 'Flute', character: 'Sine flute with light vibrato.', genres: ['Folk', 'Pop', 'Cinematic'], classic: true },
  { id: 'brass', role: 'lead', category: 'leads', name: 'Brass', character: 'Brassy saw lead.', genres: ['Funk', 'Pop', 'Cinematic'], classic: true },
  { id: 'square', role: 'lead', category: 'leads', name: 'Square lead', character: 'Buzzy square lead.', genres: ['Synthwave', 'Pop', 'Chiptune'], classic: true },
  // piano is already a chord voice; lead 'piano' stays as a classic alias
  { id: 'piano-lead', role: 'lead', category: 'leads', name: 'Piano lead', character: 'Melody piano (same family as the chord piano).', genres: ['Pop', 'Gospel', 'Ballad'] },
  { id: 'voxlead', role: 'lead', category: 'leads', name: 'Formant lead', character: 'Singing formant synth, “ooh/ee” vowels.', genres: ['Pop', 'Experimental', 'Gospel'] },
  { id: 'glassbell', role: 'lead', category: 'leads', name: 'Glass bell', character: 'Fragile glassy FM bell.', genres: ['Trap', 'Ambient', 'Pop'] },
  { id: 'supersaw', role: 'lead', category: 'leads', name: 'Supersaw', character: 'Wide stacked saw lead.', genres: ['Trance', 'Pop', 'Club'] },
  { id: 'whisper', role: 'lead', category: 'leads', name: 'Whisper', character: 'Airy, breathy lead with noise in the attack.', genres: ['R&B', 'Ambient', 'Pop'] },
  { id: 'sitarish', role: 'lead', category: 'leads', name: 'Sitarish', character: 'Buzzing FM lead with a sitar-like twang.', genres: ['Psychedelic', 'Experimental', 'World'] },
  { id: 'hoover', role: 'lead', category: 'leads', name: 'Hoover', character: 'Rave hoover-style stacked saw.', genres: ['Rave', 'Club', 'Experimental'] },
  { id: 'choirooh', role: 'lead', category: 'leads', name: 'Choir ooh', character: 'Small choir “ooh” as a lead.', genres: ['Gospel', 'Pop', 'Cinematic'] },
  { id: 'tapeflute', role: 'lead', category: 'leads', name: 'Tape flute', character: 'Flute with tape wobble and duller highs.', genres: ['Lo-fi', 'Folk', 'Soul'] },
  { id: 'dirtlead', role: 'lead', category: 'leads', name: 'Dirty lead', character: 'Saturated mid lead, slightly broken.', genres: ['Rock', 'Phonk', 'Trap'] },
  { id: 'pulselead', role: 'lead', category: 'leads', name: 'Pulse', character: 'Narrow pulse lead, nasal and nimble.', genres: ['Synthwave', 'Pop', 'Funk'] },
  { id: 'metalbell', role: 'lead', category: 'leads', name: 'Metal bell', character: 'Inharmonic metallic bell lead.', genres: ['Cinematic', 'Trap', 'Experimental'] },
  { id: 'slidelead', role: 'lead', category: 'leads', name: 'Slide lead', character: 'Expressive portamento saw lead.', genres: ['R&B', 'Funk', 'Trap'] },
  { id: 'shimmerlead', role: 'lead', category: 'textures', name: 'Shimmer lead', character: 'Lead with an octave-up sparkle trail.', genres: ['Ambient', 'Pop', 'Experimental'] },
  { id: 'beesaw', role: 'lead', category: 'leads', name: 'Bee saw', character: 'Detuned buzzing saw, insect-wide.', genres: ['Experimental', 'Club', 'Drum & bass'] },
  { id: 'kalimbalead', role: 'lead', category: 'plucks', name: 'Kalimba lead', character: 'Single-line thumb-piano melody.', genres: ['Afrobeats', 'Folk', 'Lo-fi'] },
];

export const voiceById = (id: string, role?: VoiceRole): VoiceDef | undefined => {
  if (role) {
    const exact = VOICES.find((v) => v.id === id && v.role === role);
    if (exact) return exact;
    if (role === 'lead' && id === 'piano') return VOICES.find((v) => v.id === 'piano-lead');
  }
  return VOICES.find((v) => v.id === id);
};

export const voicesFor = (role: VoiceRole) => {
  const list = VOICES.filter((v) => v.role === role);
  return list;
};

export function optionsFor(role: VoiceRole): [string, string][] {
  const list = voicesFor(role).map((v) => [v.id, v.name] as [string, string]);
  // Classic palettes use lead id "piano" (same synth as the chord piano).
  if (role === 'lead' && !list.some((o) => o[0] === 'piano')) list.push(['piano', 'Piano']);
  return list;
}

export const KIT_OPTIONS = optionsFor('kit');
export const BASS_OPTIONS = optionsFor('bass');
export const CHORD_OPTIONS = optionsFor('chords');
export const LEAD_OPTIONS = optionsFor('lead');
