/**
 * Seed entries for the command registry.
 *
 * Screens mirror src/screens/*.tsx; settings mirror the keys in
 * electron/data/settings.ts grouped into the sections the Settings screen
 * will expose as anchors ('/settings#asr' etc.). Descriptions are written
 * as the question someone would type — that text is what the BM25 side of
 * the search engine matches against, so wording matters more than brevity.
 */
import type { RegistryEntry } from './registry'

const screen = (
  id: string,
  title: string,
  route: string,
  keywords: string[],
  description: string
): RegistryEntry => ({ id: `screen.${id}`, kind: 'screen', title, route, keywords, description })

const section = (
  id: string,
  title: string,
  route: string,
  keywords: string[],
  description: string
): RegistryEntry => ({ id: `section.${id}`, kind: 'section', title, route, keywords, description })

const setting = (
  key: string,
  title: string,
  anchor: string,
  keywords: string[],
  description: string
): RegistryEntry => ({
  id: `setting.${key}`,
  kind: 'setting',
  title,
  route: `/settings#${anchor}`,
  keywords: [...keywords, key],
  description
})

const action = (
  id: string,
  title: string,
  route: string,
  keywords: string[],
  description: string
): RegistryEntry => ({ id: `action.${id}`, kind: 'action', title, route, keywords, description, actionId: id })

export const SCREEN_ENTRIES: RegistryEntry[] = [
  screen('live', 'Live', '/live', ['live', 'projector', 'output', 'service', 'operator', 'listen'],
    'The live operator surface during a service: what is on the projector right now, the detected verses queue, preview, and the listen button. Open the live screen, go to the service view.'),
  screen('bible', 'Bible', '/bible', ['bible', 'scripture', 'verse', 'chapter', 'passage', 'lookup', 'reference'],
    'Look up any scripture by reference or browse books and chapters. Find a verse, open the bible, search scripture, jump to a passage and send it to the screen.'),
  screen('songs', 'Songs', '/songs', ['songs', 'lyrics', 'worship', 'hymn', 'music', 'chorus', 'ccli'],
    'Song lyrics library for worship: add a song, edit lyrics, arrange verses and choruses, project lyrics slides. Where are my songs, worship set, hymns.'),
  screen('presentations', 'Presentations & Media', '/presentations', ['presentations', 'media', 'slides', 'powerpoint', 'pptx', 'video', 'images', 'announcements', 'library'],
    'Presentation slides, announcement decks, imported PowerPoint files, videos and pictures. Import a pptx, show announcements, media library, play a video.'),
  screen('themes', 'Themes', '/themes', ['themes', 'background', 'look', 'style', 'font', 'colors', 'design', 'stock', 'wallpaper'],
    'How verses look on the projector: backgrounds, stock images, fonts, text colour and overlay. Change the background picture, pick a theme, make the text bigger.'),
  screen('schedule', 'Schedule', '/schedule', ['schedule', 'order of service', 'run sheet', 'timeline', 'segments', 'programme', 'agenda'],
    'The order of service: worship, announcements, offering, sermon, altar call and closing, with start and end times. Plan the service, edit the run sheet, service segments.'),
  screen('preachers', 'Preachers', '/preachers', ['preachers', 'pastor', 'speaker', 'minister', 'profile', 'trust', 'training', 'corrections'],
    'Preacher profiles: who is speaking today, their trust meter for auto mode, learned aliases and correction history. Add a pastor, switch the active preacher, see how well the app knows a speaker.'),
  screen('notes', 'Notes', '/notes', ['notes', 'sermon notes', 'summary', 'transcript', 'outline', 'takeaways'],
    'AI sermon notes and transcript generated while the preacher speaks: outline, key points, verses referenced. Read the sermon notes, export the summary, see the transcript.'),
  screen('settings', 'Settings', '/settings', ['settings', 'preferences', 'options', 'config', 'configuration', 'setup'],
    'All app settings: microphone and speech recognition, auto mode, display, integrations, giving, church identity and the companion page. Where do I change settings, open preferences.'),
  screen('cloud', 'Cloud', '/cloud', ['cloud', 'account', 'sync', 'login', 'sign in', 'supabase', 'backup', 'subscription', 'plan'],
    'Cloud account and sync: sign in, link this computer to your church account, backups and plan. Log in, connect my account, sync to the cloud.')
]

export const SECTION_ENTRIES: RegistryEntry[] = [
  section('settings.asr', 'ASR & language', '/settings#asr', ['asr', 'speech', 'microphone', 'mic', 'audio', 'whisper', 'deepgram', 'language', 'transcription', 'recognition'],
    'Speech recognition settings: which microphone and engine the app listens with (local Whisper or Deepgram), model size, API keys and the language the preacher speaks.'),
  section('settings.auto', 'Auto mode & training', '/settings#auto', ['auto', 'automatic', 'trust', 'training', 'threshold', 'confidence', 'agent', 'learning'],
    'Auto mode: when the app is allowed to push verses to the screen by itself, the trust gate, training thermostat and the ping sound when it does.'),
  section('settings.display', 'Display', '/settings#display', ['display', 'projector', 'font', 'text', 'size', 'colour', 'color', 'background', 'overlay', 'theme', 'appearance', 'version', 'translation'],
    'Display settings: default font, size and colour of verses, background image and fit, overlay darkness, bible translation shown, app colour mode and accent.'),
  section('settings.integrations', 'Integrations (OBS / vMix)', '/settings#integrations', ['integrations', 'obs', 'vmix', 'streaming', 'livestream', 'ndi', 'websocket', 'broadcast'],
    'Connect Trilorah to OBS Studio or vMix so verses show up on the livestream: host, port and password for each.'),
  section('settings.giving', 'Giving', '/settings#giving', ['giving', 'offering', 'donate', 'tithe', 'zelle', 'venmo', 'cash app', 'paypal', 'bank'],
    'Giving details shown on the offering slide and companion page: Zelle, Venmo, Cash App, PayPal, bank info, a custom link and a note.'),
  section('settings.church', 'Church identity', '/settings#church', ['church', 'identity', 'name', 'logo', 'brand', 'colour', 'color', 'avatar'],
    'Your church name, logo and brand colour: what shows on the logo slide and seeds every generated avatar.'),
  section('settings.companion', 'Companion page', '/settings#companion', ['companion', 'qr', 'phone', 'congregation', 'share', 'link', 'follow along', 'stream', 'remote', 'polls'],
    'The congregation companion page people open on their phones: QR caption, who can open the shared link, livestream URL, polls and the remote control page.')
]

export const SETTING_ENTRIES: RegistryEntry[] = [
  // --- ASR & language ---
  setting('asrProvider', 'Speech recognition engine', 'asr', ['asr', 'provider', 'engine', 'whisper', 'deepgram', 'speech', 'recognition', 'microphone', 'mic', 'listening', 'transcription', 'model'],
    'Where do I change the speech recognition model — local Whisper or Deepgram cloud. Switch how the app listens to the microphone, change the mic engine, use whisper offline or deepgram.'),
  setting('whisperModelSize', 'Whisper model size', 'asr', ['whisper', 'model', 'size', 'base', 'small', 'medium', 'accent', 'accuracy', 'download'],
    'Pick the local Whisper model size: base is fastest, small is the right pick for strong accents, medium is most accurate. Make transcription more accurate, download a bigger model.'),
  setting('deepgramApiKey', 'Deepgram API key', 'asr', ['deepgram', 'api key', 'key', 'token', 'cloud', 'speech'],
    'Enter or change the Deepgram API key used for cloud speech recognition. Where do I paste my deepgram key.'),
  setting('hfToken', 'Hugging Face token', 'asr', ['hugging face', 'huggingface', 'hf', 'token', 'api key', 'model', 'download'],
    'Hugging Face access token used to download models. Where do I put my huggingface token.'),
  setting('asrLanguage', 'Listening language', 'asr', ['language', 'spoken', 'locale', 'english', 'spanish', 'french', 'portuguese', 'hindi', 'chinese', 'accent'],
    'The language the preacher speaks so the microphone transcribes correctly (en-US, es, fr, pt, hi, zh). Change the speech language, the pastor preaches in Spanish.'),
  setting('engineLanguage', 'Reference language pack', 'asr', ['language', 'pack', 'book names', 'voice commands', 'resolver', 'spanish', 'french', 'portuguese', 'hindi', 'chinese'],
    'Which language pack the verse detector and voice commands use to recognise book names. Detect scripture references spoken in another language.'),
  setting('voiceCommandsEnabled', 'Voice commands', 'asr', ['voice', 'commands', 'spoken', 'hands free', 'next verse', 'clear screen', 'say'],
    'Let the preacher control the screen by voice: "next verse", "clear the screen". Turn voice commands on or off.'),
  setting('mlModel', 'Detection model', 'asr', ['detection', 'model', 'regex', 'ml', 'intent', 'reference', 'detector'],
    'Which detection model finds scripture references in the transcript (regex or ML). Change how verses are detected.'),

  // --- Auto mode & training ---
  setting('agentEnabled', 'Agent (auto mode) enabled', 'auto', ['agent', 'auto', 'automatic', 'autopilot', 'hands free', 'enable', 'disable'],
    'Master switch for the agent that pushes detected verses to the projector on its own. Turn auto mode on, disable automatic display.'),
  setting('autoModeMinTrust', 'Auto mode trust threshold', 'auto', ['trust', 'threshold', 'confidence', 'precision', 'gate', 'percent', 'meter'],
    'How much the app must trust a preacher before it is allowed to go automatic (default 90%). Make auto mode stricter or looser, change the trust gate.'),
  setting('autoModeMinSamples', 'Auto mode minimum samples', 'auto', ['samples', 'detections', 'minimum', 'count', 'gate', 'trust'],
    'How many confirmed detections a preacher needs before auto mode unlocks. Change how much history is required.'),
  setting('autoModeMinServices', 'Auto mode minimum services', 'auto', ['services', 'minimum', 'sundays', 'sessions', 'gate', 'trust'],
    'How many services a preacher must be heard across before auto mode unlocks.'),
  setting('autoDisplayTimeout', 'Auto display timeout', 'auto', ['timeout', 'seconds', 'hide', 'clear', 'automatically', 'duration', 'how long'],
    'How many seconds a verse stays on screen before it clears automatically. Keep verses up longer, hide verses sooner.'),
  setting('falsePositiveFilterEnabled', 'False positive filter', 'auto', ['false positive', 'filter', 'wrong', 'mistakes', 'noise', 'accuracy'],
    'Filter out likely wrong detections before they reach the queue. The app keeps showing verses the pastor did not mention.'),
  setting('audienceTrainingEnabled', 'Audience training', 'auto', ['audience', 'training', 'congregation', 'corrections', 'crowd', 'feedback'],
    'Let corrections from the congregation companion page train the detector.'),
  setting('adaptToAudienceCorrections', 'Adapt to audience corrections', 'auto', ['audience', 'corrections', 'adapt', 'learn', 'congregation'],
    'Whether audience corrections change what the app shows and learns. Stop the congregation from changing verses.'),
  setting('rememberPreacherStyle', 'Remember preacher style', 'auto', ['remember', 'preacher', 'style', 'learn', 'aliases', 'habits', 'memory'],
    'Remember how each preacher says book names and which passages they favour. Turn off learning per preacher.'),
  setting('matureMaxCorrections', 'Training: max corrections when mature', 'auto', ['training', 'thermostat', 'corrections', 'mature', 'graduate'],
    'Training thermostat: how many corrections per service a mature preacher profile may have before it drops back to training.'),
  setting('matureStreak', 'Training: streak to graduate', 'auto', ['training', 'streak', 'graduate', 'mature', 'services in a row'],
    'How many clean services in a row a preacher needs to be considered mature.'),
  setting('reopenCorrections', 'Training: corrections to reopen', 'auto', ['training', 'reopen', 'corrections', 'reset', 'retrain'],
    'How many corrections in one service reopen training for a mature preacher.'),
  setting('autoPingEnabled', 'Ping when auto-pushing a verse', 'auto', ['ping', 'sound', 'chime', 'beep', 'notification', 'alert', 'audio cue'],
    'Play a soft ping when auto mode puts a verse on the screen so the operator notices. Turn the sound on or off.'),
  setting('autoPingVolume', 'Auto ping volume', 'auto', ['ping', 'volume', 'loud', 'quiet', 'sound level'],
    'How loud the auto mode ping is.'),
  setting('graceWindowEnabled', 'Grace window', 'auto', ['grace', 'window', 'undo', 'delay', 'cancel', 'before showing'],
    'A short window to cancel a verse before auto mode shows it. Give me time to stop a wrong verse.'),
  setting('seasonalEnabled', 'Seasonal priors', 'auto', ['seasonal', 'season', 'christmas', 'easter', 'calendar', 'priors', 'bias'],
    'Bias detection toward passages that fit the church calendar (Advent, Easter, Pentecost). Turn seasonal hints off.'),
  setting('slowPathEnabled', 'Slow path (batch) detection', 'auto', ['slow path', 'batch', 'second pass', 'llm', 'deeper'],
    'Run a slower second pass over batches of transcript to catch references the fast path missed.'),
  setting('batchIntervalMs', 'Batch interval', 'auto', ['batch', 'interval', 'milliseconds', 'seconds', 'how often', 'slow path'],
    'How often the slow path batches transcript, in milliseconds.'),
  setting('notesProvider', 'Sermon notes provider', 'auto', ['notes', 'provider', 'cloud', 'local', 'llm', 'model', 'summary', 'offline'],
    'Whether sermon notes are generated in the cloud or with the local model. Make notes work offline, use the local notes model.'),
  setting('useIncrementalNotes', 'Incremental notes', 'auto', ['notes', 'incremental', 'live', 'as they speak', 'streaming'],
    'Build sermon notes progressively during the sermon instead of all at once at the end.'),

  // --- Display ---
  setting('displayVersion', 'Bible translation on screen', 'display', ['version', 'translation', 'kjv', 'niv', 'esv', 'nkjv', 'nlt', 'nasb', 'amp', 'msg', 'bible', 'default'],
    'Which bible version is projected by default (KJV, NIV, ESV, NKJV, NLT...). Change the translation, switch to NIV, use ESV on screen.'),
  setting('defaultFontSize', 'Verse font size', 'display', ['font', 'size', 'bigger', 'smaller', 'text', 'scale', 'readable'],
    'Make the verse text bigger or smaller on the projector.'),
  setting('defaultFontFamily', 'Verse font family', 'display', ['font', 'family', 'typeface', 'serif', 'sans', 'typography'],
    'Which font the verse text uses on screen.'),
  setting('defaultFontWeight', 'Verse font weight', 'display', ['font', 'weight', 'bold', 'thin', 'light', 'heavy'],
    'How bold the verse text is.'),
  setting('scriptureFontPreset', 'Scripture font preset', 'display', ['font', 'preset', 'display serif', 'typography', 'style', 'scripture'],
    'A tuned font preset for scripture display (display-serif and friends).'),
  setting('defaultTextColor', 'Verse text colour', 'display', ['text', 'colour', 'color', 'white', 'yellow', 'font colour'],
    'The colour of the verse text on the projector.'),
  setting('overlayOpacity', 'Background overlay darkness', 'display', ['overlay', 'opacity', 'darken', 'dim', 'contrast', 'readable', 'background'],
    'How dark the overlay over the background image is, so text stays readable. Darken the background, make text stand out.'),
  setting('defaultBackgroundUrl', 'Default background image', 'display', ['background', 'image', 'picture', 'wallpaper', 'default', 'url'],
    'The default picture behind verses. Change the background image on the projector.'),
  setting('backgroundFit', 'Background fit', 'display', ['background', 'fit', 'cover', 'contain', 'fill', 'stretch', 'crop'],
    'How the background image fills the screen: cover, contain or fill. The picture is cropped or stretched.'),
  setting('backgroundPosition', 'Background position', 'display', ['background', 'position', 'top', 'bottom', 'center', 'align'],
    'Which part of the background image stays visible when it is cropped.'),
  setting('colorMode', 'App colour mode', 'display', ['dark mode', 'light mode', 'theme', 'appearance', 'colour mode', 'color mode'],
    'Switch the app between dark and light mode.'),
  setting('accentId', 'App accent colour', 'display', ['accent', 'colour', 'color', 'green', 'blue', 'highlight', 'appearance'],
    'The accent colour used for buttons and highlights in the app.'),
  setting('uiFont', 'App UI font', 'display', ['ui', 'font', 'interface', 'typeface', 'app font'],
    'The font the app interface itself uses (not the projector).'),

  // --- Integrations ---
  setting('obsEnabled', 'OBS integration', 'integrations', ['obs', 'studio', 'streaming', 'livestream', 'websocket', 'enable', 'connect'],
    'Connect to OBS Studio so verses appear on the livestream. Turn OBS on, connect to obs.'),
  setting('obsHost', 'OBS host', 'integrations', ['obs', 'host', 'address', 'ip', 'localhost', 'computer'],
    'The address of the computer running OBS.'),
  setting('obsPort', 'OBS port', 'integrations', ['obs', 'port', '4455', 'websocket'],
    'The OBS websocket port (default 4455).'),
  setting('obsPassword', 'OBS password', 'integrations', ['obs', 'password', 'websocket', 'auth'],
    'The OBS websocket password.'),
  setting('vmixEnabled', 'vMix integration', 'integrations', ['vmix', 'streaming', 'livestream', 'title', 'enable', 'connect'],
    'Connect to vMix so verses appear on the livestream. Turn vMix on.'),
  setting('vmixHost', 'vMix host', 'integrations', ['vmix', 'host', 'address', 'ip', 'localhost'],
    'The address of the computer running vMix.'),
  setting('vmixPort', 'vMix port', 'integrations', ['vmix', 'port', '8088', 'api'],
    'The vMix web API port (default 8088).'),
  setting('pixabayApiKey', 'Pixabay API key', 'integrations', ['pixabay', 'api key', 'stock', 'images', 'backgrounds', 'photos'],
    'API key for searching Pixabay stock backgrounds.'),
  setting('pexelsApiKey', 'Pexels API key', 'integrations', ['pexels', 'api key', 'stock', 'images', 'backgrounds', 'photos'],
    'API key for searching Pexels stock backgrounds.'),

  // --- Giving ---
  setting('givingZelle', 'Zelle', 'giving', ['zelle', 'giving', 'offering', 'donate', 'tithe'],
    'The Zelle address shown on the giving slide.'),
  setting('givingVenmo', 'Venmo', 'giving', ['venmo', 'giving', 'offering', 'donate', 'tithe'],
    'The Venmo handle shown on the giving slide.'),
  setting('givingCashApp', 'Cash App', 'giving', ['cash app', 'cashapp', 'giving', 'offering', 'donate', 'tithe'],
    'The Cash App tag shown on the giving slide.'),
  setting('givingPaypal', 'PayPal', 'giving', ['paypal', 'giving', 'offering', 'donate', 'tithe'],
    'The PayPal link shown on the giving slide.'),
  setting('givingBankInfo', 'Bank details', 'giving', ['bank', 'account', 'transfer', 'sort code', 'routing', 'giving', 'offering'],
    'Bank transfer details shown on the giving slide.'),
  setting('givingCustomUrl', 'Giving link', 'giving', ['giving', 'link', 'url', 'website', 'online giving', 'tithely', 'pushpay'],
    'A custom online giving URL (Tithe.ly, Pushpay, your website).'),
  setting('givingNote', 'Giving note', 'giving', ['giving', 'note', 'message', 'caption', 'offering text'],
    'A short message shown with the giving details.'),

  // --- Church identity ---
  setting('churchName', 'Church name', 'church', ['church', 'name', 'title', 'identity', 'logo slide'],
    'Your church name, shown on the logo slide and companion page. Change the church name.'),
  setting('churchLogoUrl', 'Church logo', 'church', ['church', 'logo', 'image', 'brand', 'logo slide', 'upload'],
    'Upload or change the church logo shown on the logo slide.'),
  setting('churchBrandColor', 'Church brand colour', 'church', ['brand', 'colour', 'color', 'hex', 'primary', 'avatar', 'identity'],
    'Your church brand colour: seeds every generated avatar and accent. Change the brand colour.'),
  setting('accountSlug', 'Account slug', 'church', ['account', 'slug', 'handle', 'url', 'church id', 'cloud'],
    'The short handle for your church used in companion page links.'),
  setting('activePreacherId', 'Active preacher', 'church', ['active', 'preacher', 'current', 'speaker', 'who is preaching', 'pastor'],
    'Which preacher profile is active for this service. Switch the preacher, change who is speaking.'),

  // --- Companion ---
  setting('qrCompanionCaption', 'QR caption', 'companion', ['qr', 'caption', 'text', 'scan', 'companion', 'follow along'],
    'The caption under the QR code on screen ("Scan to follow live verses…").'),
  setting('publicWebUrl', 'Companion page URL', 'companion', ['companion', 'url', 'public', 'web', 'link', 'address', 'phone'],
    'The public address of the companion page the QR code points to.'),
  setting('companionShareMode', 'Who can open the companion link', 'companion', ['companion', 'share', 'anyone', 'wifi', 'wifi-only', 'access', 'privacy', 'link'],
    'Whether anyone with the link can open the companion page or only people on the church wifi.'),
  setting('streamUrl', 'Livestream URL', 'companion', ['stream', 'livestream', 'youtube', 'facebook', 'watch', 'url', 'companion'],
    'Your church livestream link, shown as a "Watch the stream" button on the companion page.'),
  setting('congregationPollsEnabled', 'Congregation polls', 'companion', ['polls', 'congregation', 'vote', 'low confidence', 'ask', 'companion'],
    'Ask the congregation on their phones which verse was meant when the app is unsure. Turn polls off.'),
  setting('remoteControlEnabled', 'Remote control page', 'companion', ['remote', 'control', 'phone', 'paired', 'devices', 'clicker', 'pair'],
    'Let a paired phone control the screen (next verse, clear). Pair a device, turn remote control off.'),
  setting('serviceStartTime', 'Service start time', 'companion', ['service', 'start', 'time', 'schedule', 'when'],
    'When the service starts, used by the schedule.'),
  setting('serviceEndTime', 'Service end time', 'companion', ['service', 'end', 'time', 'schedule', 'finish'],
    'When the service ends, used by the schedule.')
]

export const ACTION_ENTRIES: RegistryEntry[] = [
  action('go-live', 'Go live', '/live', ['go live', 'live', 'start service', 'begin', 'projector', 'output on'],
    'Start the service: open the live surface and put the output on the projector.'),
  action('start-listening', 'Start listening', '/live', ['listen', 'start', 'microphone', 'mic on', 'record', 'begin transcribing', 'detect'],
    'Turn the microphone on and begin detecting scripture references.'),
  action('stop-listening', 'Stop listening', '/live', ['stop', 'listen', 'microphone', 'mic off', 'pause', 'end transcribing'],
    'Turn the microphone off and stop detecting.'),
  action('clear-screen', 'Clear screen', '/live', ['clear', 'screen', 'blank', 'remove verse', 'hide', 'take down'],
    'Take the current verse off the projector, leaving the background.'),
  action('black-screen', 'Black screen', '/live', ['black', 'blackout', 'screen', 'dark', 'kill', 'off'],
    'Blank the projector to black.'),
  action('show-logo', 'Show logo', '/live', ['logo', 'church logo', 'show', 'holding slide', 'idle'],
    'Put the church logo slide on the projector.'),
  action('next-verse', 'Next verse', '/live', ['next', 'verse', 'forward', 'advance', 'following'],
    'Advance to the next verse on the projector.'),
  action('previous-verse', 'Previous verse', '/live', ['previous', 'verse', 'back', 'last', 'before'],
    'Go back to the previous verse on the projector.'),
  action('switch-version', 'Switch bible version', '/live', ['switch', 'version', 'translation', 'kjv', 'niv', 'esv', 'nkjv', 'nlt', 'nasb', 'amp', 'msg', 'csb', 'rsv', 'nrsv'],
    'Change the translation of the verse on screen right now: KJV, NIV, ESV, NKJV, NLT, NASB, AMP, MSG, CSB.'),
  action('toggle-auto-mode', 'Toggle auto mode', '/live', ['auto', 'automatic', 'toggle', 'manual', 'autopilot', 'hands free', 'agent'],
    'Flip between automatic verse display and manual operator control.'),
  action('show-qr', 'Show QR code', '/live', ['qr', 'code', 'companion', 'scan', 'phone', 'follow along'],
    'Put the companion page QR code on the projector so people can scan it.')
]

export const ALL_ENTRIES: RegistryEntry[] = [
  ...SCREEN_ENTRIES,
  ...SECTION_ENTRIES,
  ...SETTING_ENTRIES,
  ...ACTION_ENTRIES
]
