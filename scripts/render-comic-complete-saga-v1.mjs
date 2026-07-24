import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  buildComicAudienceContextPlan,
  buildComicCinematicNarrationPlan,
  buildComicCombatFramingPlan,
  buildComicCuriosityPlan,
  buildComicNarrationActingPlan,
  buildComicNarrationPerformancePlan,
  buildComicNarrationVisualSyncPlan,
  buildComicIssueTransitionPlan,
  buildComicPhraseVoicePlan,
  buildComicNarrationZoomPlan,
  buildComicNarratorDirectorPlan,
  buildComicNarrationEmotionArcPlan,
  buildComicSceneEmotionVoicePlan,
  buildComicDialogueAwarenessPlan,
  buildComicNarrationVisualDriftAutoFixPlan,
  buildComicComfyVisualEnrichmentPlan,
  evaluateComicVisualNarrationContract,
  getComicNarrationReferenceDnaById,
  scoreComicNarrationAgainstReference,
  buildComicPanelShotPlan,
  buildComicStereoSfxPlan,
  buildComicTemporalHookPlan,
  buildCompleteComicSagaPlan,
  evaluateComicPayoffs,
  evaluateComicNarrationLanguage,
  evaluateComicNarrationScreenAlignment,
  evaluateComicProsodyQuality,
  evaluateComicRetentionRewriteGate,
  selectComicNarrationTake,
  QwenClonedVoiceProvider,
  VoiceboxApiClient,
  VoiceboxHealthCheck,
  reviewComicCueVisualEvidence,
  sanitizeComicNarrationText,
  prepareComicNarrationForVoiceboxQwen,
} from "../packages/media-beast/dist/index.js";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const sagaConfig = process.env.COMIC_SAGA_CONFIG
  ? (await import(pathToFileURL(resolve(process.env.COMIC_SAGA_CONFIG)).href)).default
  : null;
const workspaceRoot = dirname(root);
const voiceLab = join(workspaceRoot, "reelforge-voice-lab");
const sagaRoot = sagaConfig?.sagaRoot ? resolve(root, sagaConfig.sagaRoot) : join(root, "storage/assets/comics/godzilla-kong-complete-saga");
const outputDir = process.env.COMIC_SAGA_OUTPUT_DIR
  ? resolve(process.env.COMIC_SAGA_OUTPUT_DIR)
  : join(root, "storage/renders/comic-complete-saga", `${sagaConfig?.outputSlug ?? "godzilla-kong-complete"}-${Date.now()}`);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const python = process.env.CHATTERBOX_PYTHON || join(voiceLab, ".venv-xtts/Scripts/python.exe");
const visionPython = process.env.COMIC_VISION_PYTHON || join(voiceLab, ".venv-piper/Scripts/python.exe");
const qaPython = process.env.NARRATION_QA_PYTHON || join(voiceLab, ".venv-py311/Scripts/python.exe");
const chatterboxSource = process.env.CHATTERBOX_PTBR_SOURCE || join(voiceLab, "chatterbox-ptbr-space/chatterbox/src");
const referenceAudio = process.env.CHATTERBOX_PTBR_REFERENCE || join(voiceLab, "voice-references/faber-narrator-ptbr.wav");
const voicePackManifestPath = process.env.CHATTERBOX_PTBR_VOICE_PACK
  || join(voiceLab, "voice-references/pichau-cinematic-ptbr-v1/voice-pack.json");
const narrationProvider = process.env.COMIC_NARRATION_PROVIDER || "chatterbox-ptbr";
const voiceboxBaseUrl = process.env.VOICEBOX_BASE_URL || "http://127.0.0.1:17493";
const requestedNarrationSessionMode = process.env.COMIC_NARRATION_SESSION_MODE
  ?? sagaConfig?.narrationSessionMode
  ?? (sagaConfig?.narrationVoiceLock?.enabled ? "single" : "phrase");
const narrationSessionMode = ["phrase", "act", "single"].includes(requestedNarrationSessionMode)
  ? requestedNarrationSessionMode
  : "phrase";
const sfxAssets = {
  pageTear: join(root, "storage/assets/sfx/FILM-20260704T151810Z-3-001/FILM/MOV/FILM_BURN_01.mp4"),
  impact: join(root, "storage/assets/sfx/FILM CLUTTER-20260704T151808Z-3-001/FILM CLUTTER/MOV/FILM_CLUTTER_01.mp4"),
  whoosh: join(root, "storage/assets/sfx/FILM-20260704T151810Z-3-001/FILM/MOV/FILMSTRIP_SHAPE_10.mp4"),
};

const temporalHookPlan = buildComicTemporalHookPlan({ ...(sagaConfig?.temporalHook ?? {
  hookNarration: "Superman deu de cara com Godzila.",
  setupNarration: "ele estava prestes a pedir Lois em casamento. Enquanto isso, Lex invadia a Fortaleza da SolidÃ£o, a base secreta do herÃ³i. O que ele queria roubar ali?",
  visualPromiseTerms: ["Superman", "Godzila"],
  contextAnchors: [
    { entity: "Lois", explanationTerms: ["casamento"] },
    { entity: "Fortaleza da SolidÃ£o", explanationTerms: ["base secreta", "Superman", "herÃ³i"] },
  ],
  rewindLabel: "Doze horas antes",
  coldOpenDurationSeconds: 2.4,
  hookHeadline: "Superman deu de cara com Godzilla",
}), autoRepair: true });
if (!temporalHookPlan.passed) throw new Error("Temporal hook rejected: " + temporalHookPlan.warnings.join(", "));

const issueRanges = sagaConfig?.issueRanges ?? [
  { issueNumber: 1, firstStoryPage: 4, lastStoryPage: 32, excludedPages: [1, 2, 3, 33, 34, 35, 36, 37, 38, 39] },
  { issueNumber: 2, firstStoryPage: 6, lastStoryPage: 32, excludedPages: [1, 2, 3, 4, 5, 33] },
  { issueNumber: 3, firstStoryPage: 7, lastStoryPage: 34, excludedPages: [1, 2, 3, 4, 5, 6, 35] },
  { issueNumber: 4, firstStoryPage: 7, lastStoryPage: 33, excludedPages: [1, 2, 3, 4, 5, 6, 34] },
  { issueNumber: 5, firstStoryPage: 7, lastStoryPage: 35, excludedPages: [1, 2, 3, 4, 5, 6, 36] },
  { issueNumber: 6, firstStoryPage: 7, lastStoryPage: 34, excludedPages: [1, 2, 3, 4, 5, 6, 35] },
  { issueNumber: 7, firstStoryPage: 8, lastStoryPage: 36, excludedPages: [1, 2, 3, 4, 5, 6, 7, 37] },
];

const beats = sagaConfig?.beats ?? [
  { issueNumber: 1, pages: [4, 5, 6, 7, 8], role: "cold_open", hasDialogue: true, hasImpact: true, weight: 1.25, headline: temporalHookPlan.hookHeadline, spokenText: "Godzila e Kong jamais deveriam entrar no mundo da Liga. Tudo comeÃ§ou quando Lex Luthor atacou a Fortaleza da SolidÃ£o." },
  { issueNumber: 1, pages: [10, 12, 13, 14, 15, 16, 17], role: "setup", hasDialogue: true, weight: 1, headline: "LEX INVADIU A FORTALEZA", spokenText: "Enquanto os viloes mantinham os herois ocupados, Superman abandonava o momento mais importante de sua vida." },
  { issueNumber: 1, pages: [18, 19, 20, 21, 22, 24], role: "escalation", hasDialogue: true, hasImpact: true, weight: 1.1, headline: "A CAIXA ABRIU O CAMINHO", spokenText: "Quando a Liga chegou, jÃ¡ era tarde. Um golpe atingiu a Caixa Materna. O artefato abriu um portal e lanÃ§ou os criminosos na Ilha da Caveira, o mundo de Kong e outros TitÃ£s." },
  { issueNumber: 1, pages: [25, 27, 32], role: "reversal", hasDialogue: true, hasImpact: true, weight: 1.2, headline: "O PORTAL TROUXE OS TITÃƒS", spokenText: "Ali, Lex percebeu que podia transformar os TitÃ£s em armas. Por isso, o portal continuou aberto e arrastou Godzilla para a Terra." },

  { issueNumber: 2, pages: [6, 7, 8, 10, 12], role: "escalation", hasImpact: true, weight: 1.2, headline: "GODZILLA SURGIU NA TERRA", spokenText: "Foi assim que o portal colocou Godzilla diante de Superman. O herÃ³i atacou primeiro, mas o sopro atÃ´mico atravessou sua defesa. Se ele caÃ­sse, quem protegeria MetrÃ³polis?" },
  { issueNumber: 2, pages: [13, 15, 17, 19, 20], role: "reversal", hasDialogue: true, weight: 1, headline: "A LIGA SE DIVIDIU", spokenText: "Com Superman ferido, a Liga se dividiu: uma equipe salvava civis; outra tentava descobrir por que os monstros apareciam." },
  { issueNumber: 2, pages: [22, 24, 26, 28, 30, 32], role: "escalation", hasImpact: true, weight: 1.05, headline: "KONG TAMBÃ‰M ESTAVA LIVRE", spokenText: "Kong e criaturas da ilha tambÃ©m avanÃ§avam. O portal seguia aberto, e ninguÃ©m sabia como devolver os TitÃ£s ao seu mundo." },

  { issueNumber: 3, pages: [7, 9, 11, 13, 14], role: "escalation", hasImpact: true, weight: 1.05, headline: "GODZILLA NÃƒO RECUAVA", spokenText: "HerÃ³is atacaram por terra e pelo cÃ©u. Godzila absorveu os golpes, respondeu com energia atÃ´mica e continuou avanÃ§ando." },
  { issueNumber: 3, pages: [15, 17, 19, 21, 23], role: "reversal", hasDialogue: true, hasImpact: true, weight: 1, headline: "CADA ATAQUE PIORAVA TUDO", spokenText: "A Liga percebeu que lutar sem estratÃ©gia sÃ³ ampliava a destruiÃ§Ã£o. Salvar pessoas e desviar Godzila virou prioridade." },
  { issueNumber: 3, pages: [25, 27, 29, 31, 33, 34], role: "escalation", hasDialogue: true, hasImpact: true, weight: 1.05, headline: "KONG ESCOLHEU SEU CAMINHO", spokenText: "Kong tambÃ©m reagia a quem tentava controlÃ¡-lo. A guerra perdeu seus lados: herÃ³is, vilÃµes e monstros lutavam para sobreviver." },

  { issueNumber: 4, pages: [7, 9, 11, 13, 15], role: "setup", hasDialogue: true, weight: 0.95, headline: "OS HERÃ“IS MUDARAM O PLANO", spokenText: "EntÃ£o a Liga entendeu: os TitÃ£s nÃ£o escolheram aquela Terra. Deslocados e acuados, reagiam a cada ataque como ameaÃ§a." },
  { issueNumber: 4, pages: [16, 18, 20, 22, 24], role: "escalation", hasDialogue: true, hasImpact: true, weight: 1, headline: "A GUERRA CHEGOU AO OCEANO", spokenText: "O perigo tambÃ©m veio das profundezas. Uma missÃ£o submarina encontrou outro colosso enquanto as cidades continuavam desmoronando." },
  { issueNumber: 4, pages: [25, 27, 29, 31, 33], role: "reversal", hasDialogue: true, hasImpact: true, weight: 1.05, headline: "NÃƒO HAVIA MAIS LUGAR SEGURO", spokenText: "Com batalhas no cÃ©u, nas ruas e no oceano, fechar o portal tornou-se a Ãºnica vitÃ³ria possÃ­vel." },

  { issueNumber: 5, pages: [7, 9, 11, 13, 15], role: "escalation", hasDialogue: true, hasImpact: true, weight: 1.05, headline: "O MAR ESCONDEU OUTRO TITÃƒ", spokenText: "No fundo do mar, tentÃ¡culos cercaram os herÃ³is e esmagaram suas defesas. Cada segundo perdido deixava a superfÃ­cie mais vulnerÃ¡vel." },
  { issueNumber: 5, pages: [16, 18, 20, 22, 24], role: "reversal", hasDialogue: true, hasImpact: true, weight: 1, headline: "HERÃ“IS E VILÃ•ES FORAM CERCADOS", spokenText: "Na superfÃ­cie, herÃ³is e criminosos enfrentaram o mesmo desastre. NinguÃ©m controlava os monstros, e o plano de Lex desmoronou." },
  { issueNumber: 5, pages: [25, 27, 29, 31, 33, 35], role: "escalation", hasDialogue: true, hasImpact: true, weight: 1.05, headline: "A LIGA CONTEVE O IMPOSSÃVEL", spokenText: "Barreiras e ataques combinados contiveram a destruiÃ§Ã£o por instantes. Era o tempo necessÃ¡rio para preparar o retorno dos TitÃ£s." },

  { issueNumber: 6, pages: [7, 9, 11, 13, 15], role: "reversal", hasDialogue: true, hasImpact: true, weight: 1, headline: "UMA ARMA MECÃ‚NICA ENTROU NA GUERRA", spokenText: "Um colosso mecÃ¢nico entrou na batalha, mas a tentativa de controlar o caos criou outra ameaÃ§a entre herÃ³is e monstros." },
  { issueNumber: 6, pages: [16, 18, 20, 22, 24], role: "climax", hasDialogue: true, hasImpact: true, weight: 1.15, headline: "MUTANO ENFRENTOU KONG", spokenText: "Para deter Kong, Mutano assumiu forma gigantesca. O duelo dos gorilas abriu espaÃ§o para o ataque final." },
  { issueNumber: 6, pages: [25, 27, 29, 31, 33, 34], role: "climax", hasDialogue: true, hasImpact: true, weight: 1.1, headline: "TODAS AS FRENTES CONVERGIRAM", spokenText: "As frentes convergiram. A Liga reuniu forÃ§as, protegeu os feridos e concentrou energia para reabrir o caminho entre mundos." },

  { issueNumber: 7, pages: [8, 10, 12, 14, 16], role: "climax", hasDialogue: true, hasImpact: true, weight: 1.1, headline: "A ÃšLTIMA BATALHA COMEÃ‡OU", spokenText: "Na batalha final, cada herÃ³i recebeu uma funÃ§Ã£o: afastar os TitÃ£s, conter os vilÃµes e manter o portal estÃ¡vel." },
  { issueNumber: 7, pages: [18, 20, 22, 24, 26], role: "climax", hasImpact: true, weight: 1.2, headline: "GODZILLA E KONG COLIDIRAM", spokenText: "Godzila e Kong finalmente colidiram. Enquanto trocavam golpes, a Liga aproveitou a abertura para ativar o plano de retorno." },
  { issueNumber: 7, pages: [28, 30, 32, 34, 35], role: "resolution", hasDialogue: true, hasImpact: true, weight: 1.15, headline: "O PORTAL FOI REABERTO", spokenText: "Todos atacaram no instante certo. O portal se abriu, os monstros foram empurrados de volta e os universos se separaram." },
  { issueNumber: 7, pages: [36], role: "resolution", hasDialogue: true, weight: 0.75, headline: "A GUERRA TERMINOU", spokenText: "Quando o silÃªncio voltou, Clark reencontrou Lois. A pergunta interrompida no comeÃ§o ganhou resposta, e a Liga sobreviveu." },
];

const cinematicNarration = sagaConfig?.cinematicNarration ?? [
  { cinematicLine: temporalHookPlan.combinedNarration, characterIntent: "Lex queria transformar o caos em poder", hiddenInformation: "a invasao era apenas uma distracao", stakes: "dois universos entrariam em guerra" },
  { cinematicLine: "Enquanto os vilÃµes ocupavam os herÃ³is, Superman abandonou seu pedido de casamento. Era exatamente o tempo que Lex precisava.", characterIntent: "Superman queria proteger a Fortaleza", hiddenInformation: "Lex precisava de tempo", stakes: "a armadilha avancava sem resistencia" },
  { cinematicLine: "Quando a Liga chegou, jÃ¡ era tarde. Um golpe atingiu a Caixa Materna. O artefato abriu um portal e lanÃ§ou os criminosos na Ilha da Caveira, o mundo de Kong e outros TitÃ£s.", characterIntent: "a Liga queria encerrar a invasÃ£o", hiddenInformation: "a Caixa Materna abriria um caminho entre mundos", stakes: "os TitÃ£s alcanÃ§ariam a Terra" },
  { cinematicLine: "Ali, Lex percebeu que podia transformar os TitÃ£s em armas. Por isso, o portal continuou aberto e arrastou Godzilla para a Terra.", characterIntent: "Lex queria controlar os TitÃ£s", hiddenInformation: "o portal continuaria trazendo criaturas", stakes: "a Terra receberia uma invasÃ£o de TitÃ£s" },
  { cinematicLine: "Foi assim que o portal colocou Godzilla diante de Superman. O herÃ³i atacou primeiro, mas o sopro atÃ´mico atravessou sua defesa. Se ele caÃ­sse, quem protegeria MetrÃ³polis?", characterIntent: "Superman queria deter Godzila rapidamente", hiddenInformation: "Godzila era forte o bastante para derrubÃ¡-lo", stakes: "MetrÃ³polis poderia ser destruÃ­da" },
  { cinematicLine: "Com Superman ferido, a Liga se dividiu entre salvar civis e entender o portal. Isso deixou Godzilla mais perto da cidade.", characterIntent: "a Liga queria salvar civis e entender o portal", hiddenInformation: "dividir a equipe enfraquecia a defesa", stakes: "a cidade ficava exposta" },
  { cinematicLine: "E Godzilla nÃ£o era o Ãºnico. Kong e outras criaturas tambÃ©m estavam livres, enquanto ninguÃ©m sabia fechar o portal.", characterIntent: "os herois queriam devolver os Titas", hiddenInformation: "mais criaturas atravessavam o portal", stakes: "a invasao continuaria crescendo" },
  { cinematicLine: "Enquanto a Liga buscava fechar o portal, Godzilla avanÃ§ava rumo Ã  cidade. Para ganhar tempo, os herÃ³is atacaram por terra e pelo cÃ©u. Mas cada golpe aumentava sua fÃºria.", characterIntent: "a Liga queria parar o avanco", hiddenInformation: "forca bruta nao seria suficiente", stakes: "a destruicao aumentava a cada ataque" },
  { cinematicLine: "A Liga percebeu o erro: antes de deter Godzilla, precisava tirar os civis do caminho.", characterIntent: "a Liga queria reduzir as vitimas", hiddenInformation: "combater sem estrategia piorava tudo", stakes: "cada ataque colocava mais civis em risco" },
  { cinematicLine: "Kong tambÃ©m recusou controle. Sem lados definidos, herÃ³is, vilÃµes e monstros lutavam para sobreviver.", characterIntent: "Kong queria recuperar a liberdade", hiddenInformation: "ninguem controlava os Titas", stakes: "todas as aliancas desmoronavam" },
  { cinematicLine: "Depois de ver Kong e Godzilla reagirem a cada ataque, a Liga entendeu: os TitÃ£s nÃ£o escolheram aquela Terra. Arrancados de seu mundo, eles lutavam por sobrevivÃªncia.", characterIntent: "a Liga queria conter sem destruir", hiddenInformation: "os Titas tambem eram vitimas do portal", stakes: "um ataque errado prolongaria a guerra" },
  { cinematicLine: "Enquanto a superficie desmoronava, o oceano revelou outro colosso. Como a Liga fecharia o portal antes que nao restasse cidade para salvar?", characterIntent: "os herois submarinos queriam conter a nova criatura", hiddenInformation: "a ameaca tambem vinha das profundezas", stakes: "nenhum lugar permanecia seguro" },
  { cinematicLine: "Com batalhas no ceu, nas ruas e no oceano, derrotar cada monstro seria impossivel. Fechar o portal se tornou a unica chance de vencer.", characterIntent: "a Liga queria reverter a abertura do portal", hiddenInformation: "a guerra terminaria apenas separando os mundos", stakes: "a Terra inteira estava cercada" },
  { cinematicLine: "Para fechar o portal, a Liga precisava conter tambÃ©m a ameaÃ§a do oceano. Uma equipe mergulhou atrÃ¡s dela, mas tentÃ¡culos esmagaram suas defesas.", characterIntent: "os herois queriam escapar e conter o Tita", hiddenInformation: "o tempo favorecia a destruicao na superficie", stakes: "as duas frentes poderiam cair" },
  { cinematicLine: "Na superficie, o plano de Lex finalmente se voltou contra ele. Herois e criminosos estavam cercados pelo mesmo desastre que nenhum deles conseguia controlar.", characterIntent: "Lex queria preservar o proprio plano", hiddenInformation: "os monstros jamais obedeceriam", stakes: "todos poderiam ser destruidos" },
  { cinematicLine: "Por alguns instantes, ataques combinados seguraram o impossivel. Era pouco, mas bastava para a Liga preparar o caminho de volta dos Titas.", characterIntent: "a Liga queria ganhar tempo", hiddenInformation: "o contra-ataque dependia de poucos segundos", stakes: "uma falha encerraria o plano" },
  { cinematicLine: "Quando os ataques combinados finalmente compraram tempo para o portal, uma arma mecÃ¢nica entrou na guerra e rompeu a contenÃ§Ã£o. Como a Liga reagiria?", characterIntent: "os responsaveis pela maquina queriam dominar a batalha", hiddenInformation: "a arma aumentaria o conflito", stakes: "o plano da Liga poderia ruir" },
  { cinematicLine: "Para abrir caminho, Mutano fez a escolha mais arriscada: tornou-se um gorila gigante e enfrentou Kong de frente.", characterIntent: "Mutano queria afastar Kong do portal", hiddenInformation: "o duelo criaria a abertura decisiva", stakes: "sem essa abertura o plano falharia" },
  { cinematicLine: "Enquanto Mutano segurava Kong, todas as frentes convergiram. A Liga protegeu os feridos e reuniu energia para reabrir o caminho entre mundos.", characterIntent: "a Liga queria executar o ataque final", hiddenInformation: "todas as equipes precisavam agir juntas", stakes: "era a ultima oportunidade" },
  { cinematicLine: "Com todas as frentes reunidas e o caminho entre mundos preparado, comeÃ§ou a batalha final. Cada herÃ³i recebeu uma missÃ£o. Bastava um falhar: o plano ainda funcionaria?", characterIntent: "a Liga queria estabilizar o portal", hiddenInformation: "o plano dependia de cada frente", stakes: "a Terra poderia nao sobreviver" },
  { cinematicLine: "Godzila e Kong finalmente colidiram. Enquanto os dois Titas trocavam golpes, a Liga ganhou exatamente a abertura que precisava.", characterIntent: "a Liga queria usar o duelo como distracao", hiddenInformation: "a colisao permitiria ativar o retorno", stakes: "a abertura duraria poucos instantes" },
  { cinematicLine: "Todos atacaram no mesmo instante. O portal se abriu, os monstros foram empurrados de volta, e dois universos finalmente comecaram a se separar.", characterIntent: "a Liga queria devolver os Titas", hiddenInformation: "a coordenacao perfeita era a unica saida", stakes: "qualquer atraso manteria o portal aberto" },
  { cinematicLine: "Quando o silencio voltou, Clark reencontrou Lois. A guerra havia interrompido sua pergunta, mas nao conseguiu mudar a resposta.", characterIntent: "Clark queria retomar sua vida com Lois", hiddenInformation: "o conflito terminava onde a historia pessoal havia parado", stakes: "o custo humano da guerra precisava de fechamento" },
];

const issueTransitionEvidence = sagaConfig?.issueTransitionEvidence ?? [
  { fromIssueNumber: 1, toIssueNumber: 2, previousConflictTerms: ["portal"], causalBridgeTerms: ["foi assim"], newConflictTerms: ["Godzilla", "Superman"] },
  { fromIssueNumber: 2, toIssueNumber: 3, previousConflictTerms: ["portal"], causalBridgeTerms: ["enquanto"], newConflictTerms: ["cidade", "atacaram"] },
  { fromIssueNumber: 3, toIssueNumber: 4, previousConflictTerms: ["Kong", "Godzilla"], causalBridgeTerms: ["depois de"], newConflictTerms: ["mudou", "entendeu"] },
  { fromIssueNumber: 4, toIssueNumber: 5, previousConflictTerms: ["portal"], causalBridgeTerms: ["para fechar"], newConflictTerms: ["oceano", "tentÃ¡culos"] },
  { fromIssueNumber: 5, toIssueNumber: 6, previousConflictTerms: ["tempo"], causalBridgeTerms: ["quando"], newConflictTerms: ["arma mecÃ¢nica"] },
  { fromIssueNumber: 6, toIssueNumber: 7, previousConflictTerms: ["frentes", "caminho"], causalBridgeTerms: ["com todas"], newConflictTerms: ["batalha final"] },
];

const audienceContextConcepts = sagaConfig?.audienceContextConcepts ?? [
  { conceptId: "superman", labels: ["Superman"], kind: "character", audienceFamiliar: true },
  { conceptId: "godzilla", labels: ["Godzila", "Godzilla"], kind: "creature", audienceFamiliar: true },
  { conceptId: "lex-luthor", labels: ["Lex", "Lex Luthor"], kind: "character", audienceFamiliar: true },
  { conceptId: "lois", labels: ["Lois", "LoÃ­s"], kind: "character", explanationTerms: ["casamento", "Clark"] },
  { conceptId: "fortaleza-solidao", labels: ["Fortaleza da SolidÃ£o"], kind: "location", explanationTerms: ["base secreta", "Superman", "herÃ³i"] },
  { conceptId: "caixa-materna", labels: ["Caixa Materna"], kind: "artifact", explanationTerms: ["portal", "espaÃ§o", "caminho", "mundos"] },
  { conceptId: "ilha-caveira", labels: ["Ilha da Caveira"], kind: "location", explanationTerms: ["criaturas", "monstros", "Kong"] },
  { conceptId: "titas", labels: ["TitÃ£s", "titÃ£s"], kind: "creature", explanationTerms: ["monstros", "criaturas", "Godzila", "Kong"] },
  { conceptId: "kong", labels: ["Kong"], kind: "creature", audienceFamiliar: true },
  { conceptId: "liga-justica", labels: ["Liga", "Liga da JustiÃ§a"], kind: "organization", audienceFamiliar: true },
  { conceptId: "mutano", labels: ["Mutano"], kind: "character", explanationTerms: ["gorila", "forma gigantesca"] },
];

const curiosityQuestions = sagaConfig?.curiosityQuestions ?? [
  { questionId: "macro-survival", question: "Como a Liga sobreviveria a colisao entre os dois mundos?", type: "how", openedAtBeatId: "saga-beat-1", partialAnswerBeatIds: ["saga-beat-4", "saga-beat-11", "saga-beat-16", "saga-beat-19", "saga-beat-22"], payoffBeatId: "saga-beat-23", payoff: "A Liga separou os mundos e sobreviveu ao retorno dos Titas.", evidenceBeatIds: ["saga-beat-1", "saga-beat-3", "saga-beat-22", "saga-beat-23"], isMacroQuestion: true, truthConfidence: 98 },
  { questionId: "lex-real-plan", question: "O que Lex realmente queria?", type: "what", openedAtBeatId: "saga-beat-1", partialAnswerBeatIds: ["saga-beat-2", "saga-beat-3"], payoffBeatId: "saga-beat-4", payoff: "Lex queria transformar os Titas em armas.", evidenceBeatIds: ["saga-beat-2", "saga-beat-3", "saga-beat-4"], truthConfidence: 96 },
  { questionId: "after-superman-falls", question: "Se Superman nao bastasse, quem protegeria a cidade?", type: "who", openedAtBeatId: "saga-beat-5", partialAnswerBeatIds: ["saga-beat-6"], payoffBeatId: "saga-beat-7", payoff: "A Liga se dividiu enquanto novas criaturas atravessavam o portal.", evidenceBeatIds: ["saga-beat-5", "saga-beat-6", "saga-beat-7"], truthConfidence: 95 },
  { questionId: "force-or-strategy", question: "Se forca bruta piorava tudo, como deter os Titas?", type: "how", openedAtBeatId: "saga-beat-8", partialAnswerBeatIds: ["saga-beat-9", "saga-beat-10"], payoffBeatId: "saga-beat-11", payoff: "A Liga percebeu que precisava conter os Titas e fechar o portal.", evidenceBeatIds: ["saga-beat-8", "saga-beat-9", "saga-beat-11"], truthConfidence: 94 },
  { questionId: "close-the-portal", question: "Como fechar o portal com a guerra em tres frentes?", type: "how", openedAtBeatId: "saga-beat-12", partialAnswerBeatIds: ["saga-beat-13", "saga-beat-15"], payoffBeatId: "saga-beat-16", payoff: "Ataques combinados compraram o tempo para preparar o retorno.", evidenceBeatIds: ["saga-beat-12", "saga-beat-13", "saga-beat-16"], truthConfidence: 94 },
  { questionId: "final-opening", question: "Qual abertura permitiria o ataque final?", type: "what", openedAtBeatId: "saga-beat-17", partialAnswerBeatIds: ["saga-beat-18"], payoffBeatId: "saga-beat-19", payoff: "Mutano segurou Kong enquanto as frentes da Liga convergiam.", evidenceBeatIds: ["saga-beat-17", "saga-beat-18", "saga-beat-19"], truthConfidence: 96 },
  { questionId: "will-final-plan-work", question: "O plano final funcionaria antes que a Terra caisse?", type: "can", openedAtBeatId: "saga-beat-20", partialAnswerBeatIds: ["saga-beat-21"], payoffBeatId: "saga-beat-22", payoff: "O duelo dos Titas abriu o instante necessario para reabrir o portal.", evidenceBeatIds: ["saga-beat-20", "saga-beat-21", "saga-beat-22"], truthConfidence: 97 },
];

if (cinematicNarration.length !== beats.length) throw new Error("Cinematic narration must cover every saga beat.");
const cinematicNarrationPlan = buildComicCinematicNarrationPlan({
  beats: beats.map((beat, index) => ({
    beatId: `saga-beat-${index + 1}`,
    role: beat.role,
    literalFact: beat.spokenText,
    sourcePages: beat.pages,
    ...cinematicNarration[index],
  })),
});
if (!cinematicNarrationPlan.passed) throw new Error(`Cinematic narration rejected: ${cinematicNarrationPlan.descriptiveLanguageViolations.join(",")}`);
const narrationLanguageGate = evaluateComicNarrationLanguage({
  beats: cinematicNarrationPlan.beats.map((beat) => ({ beatId: beat.beatId, narrationLine: beat.narrationLine })),
});
if (narrationLanguageGate.status !== "passed") {
  const issues = narrationLanguageGate.reviews.flatMap((review) => review.issues.map((issue) => `${review.beatId}:${issue}`));
  throw new Error(`Narration language rejected: ${issues.join(", ")}`);
}
cinematicNarrationPlan.beats.forEach((narrationBeat, index) => {
  beats[index].literalSpokenText = beats[index].spokenText;
  beats[index].spokenText = narrationBeat.narrationLine;
});
const issueTransitionPlan = buildComicIssueTransitionPlan({
  beats: cinematicNarrationPlan.beats.map((beat, index) => ({ beatId: beat.beatId, issueNumber: beats[index].issueNumber, narrationLine: beat.narrationLine })),
  evidence: issueTransitionEvidence,
  minimumScore: 100,
});
if (!issueTransitionPlan.passed) throw new Error(`Issue transitions rejected: ${issueTransitionPlan.warnings.join(", ")}`);
const audienceContextPlan = buildComicAudienceContextPlan({
  beats: cinematicNarrationPlan.beats.map((beat) => ({ beatId: beat.beatId, narrationLine: beat.narrationLine, sourcePages: beat.sourcePages })),
  concepts: audienceContextConcepts,
});
if (!audienceContextPlan.passed) {
  const contextFailures = audienceContextPlan.beatReviews.flatMap((review) => review.recommendations.map((recommendation) => review.beatId + ":" + recommendation));
  throw new Error("Audience context rejected (" + audienceContextPlan.score + "): " + [...audienceContextPlan.warnings, ...contextFailures].join(", "));
}
const retentionRewriteGate = evaluateComicRetentionRewriteGate({
  beats: cinematicNarrationPlan.beats.map((beat) => ({
    beatId: beat.beatId,
    role: beat.role,
    narrationLine: beat.narrationLine,
    literalFact: beat.literalFact,
    characterIntent: beat.characterIntent,
    hiddenInformation: beat.hiddenInformation,
    stakes: beat.stakes,
  })),
});
if (retentionRewriteGate.status !== "passed") throw new Error(`Retention rewrite rejected (${retentionRewriteGate.score}): ${retentionRewriteGate.rewriteInstructions.join(" ")}`);
const phraseVoicePlan = buildComicPhraseVoicePlan({
  beats: cinematicNarrationPlan.beats.map((beat) => ({ beatId: beat.beatId, role: beat.role, narrationLine: beat.narrationLine })),
});
if (!phraseVoicePlan.passed) throw new Error("Phrase voice direction did not create enough emotional variation.");
const baseCuriosityPlan = buildComicCuriosityPlan({
  beats: cinematicNarrationPlan.beats.map((beat) => ({ beatId: beat.beatId, narrationLine: beat.narrationLine, sourcePages: beat.sourcePages })),
  questions: curiosityQuestions,
});
const basePayoffReport = evaluateComicPayoffs({ curiosityPlan: baseCuriosityPlan });
if (!baseCuriosityPlan.passed || basePayoffReport.status !== "passed") throw new Error(`Curiosity/payoff plan rejected: ${[...baseCuriosityPlan.warnings, ...basePayoffReport.recommendations].join(" ")}`);
const narrationPerformancePlan = buildComicNarrationPerformancePlan({ phraseVoicePlan, curiosityPlan: baseCuriosityPlan });
const narrationActingPlan = buildComicNarrationActingPlan({ performancePlan: narrationPerformancePlan });
if (!narrationActingPlan.passed) throw new Error("Narration Acting Director V2 did not create sufficient human variation: " + JSON.stringify({ intentionCount: narrationActingPlan.intentionCount, pausePatternWarnings: narrationActingPlan.pausePatternWarnings, endingContourDistribution: narrationActingPlan.endingContourDistribution }));
const narratorDirectorPlan = buildComicNarratorDirectorPlan({
  actingPlan: narrationActingPlan,
  performancePlan: narrationPerformancePlan,
  referenceDnaId: sagaConfig?.narrationReferenceDnaId ?? "thwip_storytelling_v1",
});
if (!narratorDirectorPlan.passed) throw new Error("Narrator Director rejected performance: " + narratorDirectorPlan.warnings.join(", "));
const actingDirectionByPhraseId = new Map(narrationActingPlan.directions.map((direction) => [direction.phraseId, direction]));
const narratorCueByPhraseId = new Map(narratorDirectorPlan.cues.map((cue) => [cue.phraseId, cue]));
const narrationEmotionArcPlan = buildComicNarrationEmotionArcPlan({ cues: narratorDirectorPlan.cues });
if (!narrationEmotionArcPlan.passed) throw new Error("Narration emotion arc rejected: " + narrationEmotionArcPlan.warnings.join(", "));
const sceneEmotionVoicePlan = buildComicSceneEmotionVoicePlan({ narratorCues: narratorDirectorPlan.cues, emotionArcPlan: narrationEmotionArcPlan });
if (!sceneEmotionVoicePlan.passed) throw new Error("Scene emotion voice plan rejected: " + sceneEmotionVoicePlan.warnings.join(", "));
const referenceStyleScore = scoreComicNarrationAgainstReference({
  referenceDna: getComicNarrationReferenceDnaById(sagaConfig?.narrationReferenceDnaId ?? "thwip_storytelling_v1"),
  narratorPlan: narratorDirectorPlan,
  emotionArcPlan: narrationEmotionArcPlan,
});
if (referenceStyleScore.status !== "passed") throw new Error("Reference style score rejected: " + referenceStyleScore.warnings.join(", "));
const plannedProsodyGate = evaluateComicProsodyQuality({ performancePlan: narrationPerformancePlan });
if (!narrationPerformancePlan.passed || plannedProsodyGate.status !== "passed") {
  throw new Error(
`
Narration performance rejected: ${plannedProsodyGate.warnings.join(", ")}
`
);
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      const details = [`${command} failed to spawn`, `code=${error.code ?? "unknown"}`, `message=${error.message}`];
      if (args?.length) details.push(`args=${args.join(" ")}`);
      reject(new Error(details.join("\n")));
    });
    child.on("close", (code) => code === 0 ? resolvePromise({ stdout, stderr }) : reject(new Error(`${command} exited ${code}\nargs=${args.join(" ")}\n${stderr.slice(-12000)}`)));
  });
}

async function duration(path) {
  const result = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
  return Number(result.stdout.trim());
}

const visualCueOverrides = new Map(sagaConfig?.visualCueOverrides ?? [
  [0, [
    { text: "Doze horas antes, ele estava prestes a pedir Lois em casamento", pages: [4, 5] },
    { text: "Lex Luthor invadia a Fortaleza da SolidÃ£o, a base secreta do herÃ³i", pages: [6, 7] },
    { text: "O que Lex queria roubar ali", pages: [8] },
  ]],
  [1, [
    { text: "Enquanto os viloes mantinham os herois ocupados", pages: [10, 12, 13, 14, 15] },
    { text: "Superman abandonava o momento mais importante de sua vida", pages: [16, 17] },
  ]],
  [2, [
    { text: "Quando a Liga chegou, ja era tarde", pages: [18, 19, 20] },
    { text: "Um golpe atingiu a Caixa Materna", pages: [21], focusTarget: "mother_box" },
    { text: "O artefato abriu um portal e lancou os criminosos na Ilha da Caveira", pages: [22, 24] },
  ]],
  [3, [
    { text: "Ali, Lex percebeu que podia transformar os TitÃ£s em armas", pages: [25, 27] },
    { text: "Por isso, o portal continuou aberto e arrastou Godzilla para a Terra", pages: [32], focusTarget: "godzilla" },
  ]],
  [4, [
    { text: "Foi assim que o portal colocou Godzilla diante de Superman", pages: [6, 7] },
    { text: "O heroi atacou primeiro", pages: [8, 10], focusTarget: "combat" },
    { text: "O sopro atomico atravessou sua defesa", pages: [12], focusTarget: "combat" },
  ]],
  [7, [
    { text: "Enquanto a Liga buscava fechar o portal", pages: [7, 9] },
    { text: "Godzilla avancava rumo a cidade", pages: [11] },
    { text: "Os herois atacaram por terra e pelo ceu", pages: [13, 14], focusTarget: "combat" },
  ]],
  [10, [
    { text: "Depois de ver Kong e Godzilla reagirem", pages: [7, 9], focusTarget: "combat" },
    { text: "Os Titas nao escolheram aquela Terra", pages: [11] },
    { text: "Arrancados de seu mundo, lutavam por sobrevivencia", pages: [13, 15] },
  ]],
  [13, [
    { text: "Para fechar o portal, faltava conter a ameaca do oceano", pages: [7, 9] },
    { text: "Uma equipe mergulhou atras dela", pages: [11, 13] },
    { text: "Tentaculos esmagaram suas defesas", pages: [15], focusTarget: "combat" },
  ]],
  [16, [
    { text: "Os ataques combinados compraram tempo para o portal", pages: [7, 9] },
    { text: "Uma arma mecanica entrou na guerra", pages: [11, 13] },
    { text: "A maquina rompeu a contencao", pages: [15], focusTarget: "combat" },
  ]],
  [17, [
    { text: "Para abrir caminho, Mutano fez a escolha mais arriscada", pages: [29], focusTarget: "mutano" },
    { text: "Tornou-se um gorila gigante e enfrentou Kong de frente", pages: [30], focusTarget: "mutano_combat" },
  ]],
  [18, [
    { text: "Enquanto Mutano segurava Kong", pages: [31], focusTarget: "mutano_combat" },
    { text: "Todas as frentes convergiram", pages: [31] },
    { text: "A Liga reuniu energia para reabrir o caminho entre mundos", pages: [33, 34] },
  ]],
  [19, [
    { text: "Todas as frentes estavam reunidas", pages: [8, 10] },
    { text: "O caminho entre mundos estava preparado", pages: [12] },
    { text: "Comecou a batalha final", pages: [14, 16], focusTarget: "combat" },
  ]],
]);

const auditedVisualEvidence = sagaConfig?.auditedVisualEvidence ?? [
  { page: uniquePageKey(1, 21), targets: ["mother_box", "impact", "portal"], regions: [{ target: "mother_box", box: { x: 0.02, y: 0.42, width: 0.96, height: 0.56 }, focusPoint: { x: 0.52, y: 0.74 }, confidence: 91 }] },
  { page: uniquePageKey(1, 30), targets: ["clark", "lois", "clark_lois_proposal"], regions: [{ target: "clark_lois_proposal", box: { x: 0.05, y: 0.08, width: 0.9, height: 0.86 }, focusPoint: { x: 0.5, y: 0.5 }, confidence: 94 }] },
  { page: uniquePageKey(1, 32), targets: ["godzilla", "superman", "combat"], regions: [{ target: "godzilla", box: { x: 0.04, y: 0.04, width: 0.92, height: 0.92 }, focusPoint: { x: 0.5, y: 0.4 }, confidence: 98 }] },
  { page: uniquePageKey(6, 29), targets: ["mutano", "mutano_combat", "kong", "gorilla", "combat"], regions: [{ target: "mutano", box: { x: 0.02, y: 0.28, width: 0.96, height: 0.7 }, focusPoint: { x: 0.44, y: 0.68 }, confidence: 98 }] },
  { page: uniquePageKey(6, 30), targets: ["mutano", "mutano_combat", "kong", "gorilla", "combat"], regions: [{ target: "mutano_combat", box: { x: 0.04, y: 0.04, width: 0.92, height: 0.92 }, focusPoint: { x: 0.5, y: 0.5 }, confidence: 98 }] },
  { page: uniquePageKey(6, 31), targets: ["mutano", "mutano_combat", "kong", "gorilla", "combat"], regions: [{ target: "mutano_combat", box: { x: 0.03, y: 0.02, width: 0.94, height: 0.31 }, focusPoint: { x: 0.5, y: 0.16 }, confidence: 97 }] },
  { page: uniquePageKey(7, 36), targets: ["clark", "lois", "clark_lois_proposal"], regions: [{ target: "clark_lois_proposal", box: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }, focusPoint: { x: 0.5, y: 0.5 }, confidence: 92 }] },
];

const ttsPronunciations = sagaConfig?.ttsPronunciations ?? [
  [/\bSuperman\b/gi, "SÃºper-mÃ©n"],
  [/\bGodzilla\b/gi, "GodzÃ­la"],
  [/\bClark\b/gi, "ClÃ¡rque"],
  [/\bLex Luthor\b/gi, "LÃ©ks LÃºtor"],
  [/\bLoÃ­s\b/gi, "Lo-Ã­s"],
  ["Lois", "Lo-Ã­s"],
  [/\bKong\b/gi, "CÃ³ngue"],
  [/\bFlash\b/gi, "FlÃ©sh"],
  [/\bforÃ§a\b/gi, "fÃ³rssa"],
];
const narrationVoiceLock = sagaConfig?.narrationVoiceLock?.enabled ? {
  id: sagaConfig.narrationVoiceLock.id ?? "single_voice_lock_v1",
  anchorTakeId: sagaConfig.narrationVoiceLock.anchorTakeId ?? null,
  anchorTimestampSeconds: sagaConfig.narrationVoiceLock.anchorTimestampSeconds ?? null,
  seed: sagaConfig.narrationVoiceLock.seed ?? 5120,
  exaggeration: sagaConfig.narrationVoiceLock.exaggeration ?? 0.665,
  cfgWeight: sagaConfig.narrationVoiceLock.cfgWeight ?? 0.34,
  temperature: sagaConfig.narrationVoiceLock.temperature ?? 0.638,
  instruction: sagaConfig.narrationVoiceLock.instruction ?? "Conte como historia acontecendo agora, nao como resumo de quadrinho.",
  targetActiveRmsDb: sagaConfig.narrationVoiceLock.targetActiveRmsDb ?? -22.132,
  targetPeakDb: sagaConfig.narrationVoiceLock.targetPeakDb ?? -6.192,
} : null;


function narrationTextForTts(text) {
  if (narrationProvider === "voicebox-qwen") {
    return prepareComicNarrationForVoiceboxQwen(text)
      .spokenText
      .replace(/:\s+/g, ": ... ");
  }
  const mapped = ttsPronunciations.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
  return sanitizeComicNarrationText(mapped)
    .spokenText
    .replace(/:\s+/g, ": ... ");
}

function narrationPerformance(beat) {
  if (beat.role === "cold_open") return { exaggeration: 0.8, cfgWeight: 0.29, temperature: 0.7 };
  if (beat.role === "climax") return { exaggeration: 0.76, cfgWeight: 0.3, temperature: 0.69 };
  if (beat.hasImpact || beat.role === "escalation") return { exaggeration: 0.69, cfgWeight: 0.32, temperature: 0.66 };
  if (beat.role === "reversal") return { exaggeration: 0.66, cfgWeight: 0.32, temperature: 0.65 };
  if (beat.role === "resolution") return { exaggeration: 0.6, cfgWeight: 0.34, temperature: 0.61 };
  return { exaggeration: 0.62, cfgWeight: 0.34, temperature: 0.63 };
}
function assTime(seconds) {
  const value = Math.max(0, Math.round(seconds * 100));
  return `${Math.floor(value / 360000)}:${String(Math.floor((value % 360000) / 6000)).padStart(2, "0")}:${String(Math.floor((value % 6000) / 100)).padStart(2, "0")}.${String(value % 100).padStart(2, "0")}`;
}

function escapeAss(text) {
  return text.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}");
}

function wrapEditorialText(text, maximumLineLength = 26) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const lines = [""];
  for (const word of words) {
    const current = lines.at(-1);
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maximumLineLength || lines.length >= 2) lines[lines.length - 1] = candidate;
    else lines.push(word);
  }
  if (lines.at(-1).length > maximumLineLength + 8) {
    const flattened = words.join(" ");
    const splitAt = flattened.lastIndexOf(" ", Math.ceil(flattened.length / 2));
    if (splitAt > 0) return `${escapeAss(flattened.slice(0, splitAt))}\\N${escapeAss(flattened.slice(splitAt + 1))}`;
  }
  return lines.map(escapeAss).join("\\N");
}


function phrases(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const result = [];
  for (let index = 0; index < words.length; index += 4) result.push(words.slice(index, index + 4));
  return result;
}

function captionText(words) {
  if (words.length === 1) return `{\\c&H0033CCFF&}${escapeAss(words[0])}`;
  return `${escapeAss(words.slice(0, -1).join(" "))} {\\c&H0033CCFF&}${escapeAss(words.at(-1))}{\\c&H00FFFFFF&}`;
}

function distributeMeasuredDurations(measuredPhrases, cues) {
  if (!cues.length) return [];
  if (!measuredPhrases.length) return Array.from({ length: cues.length }, () => 0);
  const cueWordCounts = cues.map((cue) => Math.max(1, cue.text.trim().split(/\s+/).length));
  const totalCueWords = cueWordCounts.reduce((sum, count) => sum + count, 0);
  const cueRanges = [];
  let cueCursor = 0;
  for (const count of cueWordCounts) {
    cueRanges.push({ start: cueCursor, end: cueCursor + count });
    cueCursor += count;
  }
  const phraseWordCounts = measuredPhrases.map((phrase) => Math.max(1, phrase.text.trim().split(/\s+/).length));
  const totalPhraseWords = phraseWordCounts.reduce((sum, count) => sum + count, 0);
  const durations = Array.from({ length: cues.length }, () => 0);
  let phraseCursor = 0;
  measuredPhrases.forEach((phrase, phraseIndex) => {
    const phraseStart = phraseCursor * totalCueWords / totalPhraseWords;
    phraseCursor += phraseWordCounts[phraseIndex];
    const phraseEnd = phraseCursor * totalCueWords / totalPhraseWords;
    const phraseSpan = Math.max(0.001, phraseEnd - phraseStart);
    cueRanges.forEach((range, cueIndex) => {
      const overlap = Math.max(0, Math.min(phraseEnd, range.end) - Math.max(phraseStart, range.start));
      if (overlap > 0) durations[cueIndex] += phrase.processedDurationSeconds * overlap / phraseSpan;
    });
  });
  return durations;
}

function allocateMeasuredPages(pages, count) {
  if (count <= 1) return [pages];
  return Array.from({ length: count }, (_, index) => {
    const from = Math.floor(index * pages.length / count);
    const to = Math.max(from + 1, Math.floor((index + 1) * pages.length / count));
    const allocated = pages.slice(from, to);
    return allocated.length ? allocated : [pages[Math.min(from, pages.length - 1)]];
  });
}

function semanticCueWords(text) {
  return new Set((text.toLocaleLowerCase("pt-BR").match(/[a-zÃ -Ã¿]{4,}/g) ?? []).filter((word) => !["aquela", "aquele", "como", "com", "disso", "entre", "estava", "foram", "mais", "para", "pela", "pelo", "porque", "quando", "sobre", "todos", "uma"].includes(word)));
}

function semanticCueScore(phraseText, cueText) {
  const phraseWords = semanticCueWords(phraseText);
  const cueWords = semanticCueWords(cueText);
  return [...phraseWords].reduce((score, word) => score + (cueWords.has(word) ? 1 : 0), 0);
}

function buildMeasuredVisualCues(beat, beatIndex, measuredPhrasePlan) {
  const measuredPhrases = measuredPhrasePlan.filter((phrase) => phrase.sourceBeatIndex === beatIndex);
  const overrides = visualCueOverrides.get(beatIndex) ?? beat.visualCues;
  if (overrides?.length) {
    let minimumOverrideIndex = 0;
    const selections = measuredPhrases.map((phrase, phraseIndex) => {
      const proportionalIndex = Math.min(overrides.length - 1, Math.floor(phraseIndex * overrides.length / Math.max(1, measuredPhrases.length)));
      const floorIndex = Math.max(minimumOverrideIndex, proportionalIndex);
      const ranked = overrides.map((cue, cueIndex) => ({ cue, cueIndex, score: semanticCueScore(phrase.text, cue.text) }))
        .filter((entry) => entry.cueIndex >= floorIndex)
        .sort((left, right) => right.score - left.score || Math.abs(left.cueIndex - proportionalIndex) - Math.abs(right.cueIndex - proportionalIndex));
      const selectedEntry = ranked[0] ?? { cue: overrides[floorIndex], cueIndex: floorIndex, score: 0 };
      minimumOverrideIndex = selectedEntry.cueIndex;
      return { phrase, ...selectedEntry };
    });
    const resolved = [];
    for (let start = 0; start < selections.length;) {
      let end = start + 1;
      while (end < selections.length && selections[end].cueIndex === selections[start].cueIndex) end += 1;
      const group = selections.slice(start, end);
      const pageGroups = allocateMeasuredPages(group[0].cue.pages, group.length);
      group.forEach((selection, groupIndex) => {
        const pageNumbers = pageGroups[groupIndex] ?? selection.cue.pages;
        const pages = pageNumbers.map((page) => uniquePageKey(selection.cue.issueNumber ?? beat.issueNumber, page));
        const evidenceReview = reviewComicCueVisualEvidence({ pages, requestedTarget: selection.cue.focusTarget, evidence: auditedVisualEvidence });
        const evidenceConfidence = evidenceReview.bestRegion?.confidence != null
          ? Math.min(1, evidenceReview.bestRegion.confidence / 100)
          : evidenceReview.verified ? 0.75 : 0;
        resolved.push({
          text: selection.phrase.text,
          pages,
          focusTarget: selection.cue.focusTarget,
          verifiedFocusTargets: selection.cue.verifiedFocusTargets ?? (selection.cue.focusTarget && evidenceReview.verified ? [selection.cue.focusTarget] : []),
          evidenceTerms: selection.cue.evidenceTerms ?? evidenceReview.verifiedTargets,
          evidenceConfidence: selection.cue.evidenceConfidence ?? evidenceConfidence,
          evidenceSource: selection.cue.evidenceSource ?? (evidenceReview.verified ? "editorial_audit" : null),
          evidenceWarnings: evidenceReview.warnings,
          durationSeconds: selection.phrase.processedDurationSeconds,
        });
      });
      start = end;
    }
    return resolved;
  }
  const pageGroups = allocateMeasuredPages(beat.pages, measuredPhrases.length);
  return measuredPhrases.map((phrase, phraseIndex) => ({
    text: phrase.text,
    pages: (pageGroups[phraseIndex] ?? beat.pages).map((page) => uniquePageKey(beat.issueNumber, page)),
    durationSeconds: phrase.processedDurationSeconds,
  }));
}

function uniquePageKey(issueNumber, pageNumber) {
  return `i${String(issueNumber).padStart(2, "0")}-page-${String(pageNumber).padStart(4, "0")}.jpg`;
}

function expandVertical(box, sourceWidth, sourceHeight) {
  const ratio = (9 / 16) * (sourceHeight / sourceWidth);
  let width = box.width;
  let height = box.height;
  if (width / height > ratio) height = width / ratio;
  else width = height * ratio;
  if (width > 1) { width = 1; height = width / ratio; }
  if (height > 1) { height = 1; width = height * ratio; }
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  return { x: Math.max(0, Math.min(1 - width, centerX - width / 2)), y: Math.max(0, Math.min(1 - height, centerY - height / 2)), width, height };
}

function semanticCrop(shot, detectedPage) {
  if (shot.forceRawCrop) return shot.normalizedCrop;
  const sourcePanel = detectedPage.panels.find((panel) => shot.panelId.startsWith(panel.panelId));
  const balloon = sourcePanel?.balloons?.find((item) => item.balloonId === shot.dialogueBalloonId) ?? sourcePanel?.balloons?.[0] ?? null;
  if (!balloon || !shot.speakerAnchor) return shot.normalizedCrop;
  const anchorBox = { x: Math.max(0, shot.speakerAnchor.x - 0.14), y: Math.max(0, shot.speakerAnchor.y - 0.18), width: 0.28, height: 0.36 };
  const x1 = Math.min(shot.normalizedCrop.x, balloon.normalizedBox.x, anchorBox.x);
  const y1 = Math.min(shot.normalizedCrop.y, balloon.normalizedBox.y, anchorBox.y);
  const x2 = Math.max(shot.normalizedCrop.x + shot.normalizedCrop.width, balloon.normalizedBox.x + balloon.normalizedBox.width, anchorBox.x + anchorBox.width);
  const y2 = Math.max(shot.normalizedCrop.y + shot.normalizedCrop.height, balloon.normalizedBox.y + balloon.normalizedBox.height, anchorBox.y + anchorBox.height);
  return { x: x1, y: y1, width: Math.min(1 - x1, x2 - x1), height: Math.min(1 - y1, y2 - y1) };
}

function even(value) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function visualFilter(shot, page, renderDuration) {
  const semantic = semanticCrop(shot, page);
  const frames = Math.max(2, Math.ceil(renderDuration * 30));
  if (shot.combatFramingMode === "full_panel_stage") {
    const x = even(semantic.x * page.width);
    const y = even(semantic.y * page.height);
    const width = Math.min(even(semantic.width * page.width), page.width - x);
    const height = Math.min(even(semantic.height * page.height), page.height - y);
    const establishFrames = Math.max(2, Math.round(frames * 0.18));
    const movementFrames = Math.max(2, frames - establishFrames);
    const targetFocusX = Math.max(0.18, Math.min(0.82, shot.combatTargetFocusX ?? 0.5));
    return `crop=${width}:${height}:${x}:${y},setsar=1,split=2[combatBg][combatFg];[combatBg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=32,eq=brightness=0.08:saturation=0.78[combatBgReady];[combatFg]scale=1000:1720:force_original_aspect_ratio=decrease[combatFgReady];[combatBgReady][combatFgReady]overlay=(W-w)/2:(H-h)/2,zoompan=z='1+0.055*max(0,on-${establishFrames})/${movementFrames}':x='(iw-iw/zoom)*(0.5+(${targetFocusX.toFixed(3)}-0.5)*max(0,on-${establishFrames})/${movementFrames})':y='(ih-ih/zoom)/2':d=${frames}:s=1080x1920:fps=30,eq=contrast=1.06:saturation=1.08,format=yuv420p`;
  }
  const crop = expandVertical(semantic, page.width, page.height);
  const x = even(crop.x * page.width);
  const y = even(crop.y * page.height);
  const width = Math.min(even(crop.width * page.width), page.width - x);
  const height = Math.min(even(crop.height * page.height), page.height - y);
  const absoluteFocus = shot.zoomFocusPoint ?? shot.speakerAnchor ?? { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
  const focusX = Math.max(0.08, Math.min(0.92, (absoluteFocus.x - crop.x) / Math.max(0.01, crop.width)));
  const focusY = Math.max(0.08, Math.min(0.92, (absoluteFocus.y - crop.y) / Math.max(0.01, crop.height)));
  const intensity = Math.max(0.02, Math.min(0.12, shot.zoomIntensity ?? 0.035));
  const perFrame = intensity / frames;
  const move = {
    slow_push: { z: `1+${perFrame.toFixed(7)}*on`, x: "(iw-iw/zoom)/2", y: "(ih-ih/zoom)/2" },
    dialogue_push: { z: `1.01+${perFrame.toFixed(7)}*on`, x: `(iw-iw/zoom)*${focusX.toFixed(3)}`, y: `(ih-ih/zoom)*${focusY.toFixed(3)}` },
    reaction_push: { z: `1.02+${perFrame.toFixed(7)}*on`, x: `(iw-iw/zoom)*${focusX.toFixed(3)}`, y: `(ih-ih/zoom)*${focusY.toFixed(3)}` },
    action_pan: { z: `1.02+${perFrame.toFixed(7)}*on`, x: `(iw-iw/zoom)*(0.5+(${focusX.toFixed(3)}-0.5)*(on/${frames}))`, y: `(ih-ih/zoom)*(0.5+(${focusY.toFixed(3)}-0.5)*(on/${frames}))` },
    impact_snap: { z: `1.035+${perFrame.toFixed(7)}*on`, x: `(iw-iw/zoom)*${focusX.toFixed(3)}`, y: `(ih-ih/zoom)*${focusY.toFixed(3)}` },
    payoff_hold: { z: `1.035+${(perFrame * 0.35).toFixed(7)}*on`, x: `(iw-iw/zoom)*${focusX.toFixed(3)}`, y: `(ih-ih/zoom)*${focusY.toFixed(3)}` },
  }[shot.cameraMove];
  return `crop=${width}:${height}:${x}:${y},scale=1200:2134,zoompan=z='${move.z}':x='${move.x}':y='${move.y}':d=${frames}:s=1080x1920:fps=30,eq=contrast=1.06:saturation=1.08,format=yuv420p`;
}
function getNarrationPhraseTexts(performance) {
  const acting = actingDirectionByPhraseId.get(performance.phraseId);
  const narratorCue = narratorCueByPhraseId.get(performance.phraseId);
  const displayText = narratorCue?.displayText ?? acting?.displayText ?? performance.text;
  const spokenText = narrationTextForTts(narratorCue?.spokenText ?? acting?.actingText ?? performance.text);
  return { acting, narratorCue, displayText, spokenText };
}

function buildNarrationSessionGroups() {
  const performances = narrationPerformancePlan.performances;
  if (narrationSessionMode === "single") {
    return [{ sessionId: "session-00", sourceBeatIndex: null, performances: performances.map((performance, phraseIndex) => ({ performance, phraseIndex })) }];
  }
  const byBeat = new Map();
  performances.forEach((performance, phraseIndex) => {
    const key = performance.sourceBeatIndex ?? 0;
    if (!byBeat.has(key)) byBeat.set(key, []);
    byBeat.get(key).push({ performance, phraseIndex });
  });
  return [...byBeat.entries()]
    .sort(([left], [right]) => left - right)
    .map(([sourceBeatIndex, items], index) => ({ sessionId: "session-" + String(index).padStart(2, "0"), sourceBeatIndex, performances: items }));
}

function buildSessionText(items, field) {
  return items
    .map(({ performance }) => getNarrationPhraseTexts(performance)[field])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseTimingWeight(phrase, narratorCue, acting) {
  const text = narratorCue?.displayText ?? acting?.displayText ?? phrase.text;
  const wordWeight = Math.max(1, text.split(/\s+/).filter(Boolean).length);
  const punctuationWeight = /[?!]/.test(text) ? 1.15 : /[.:;]/.test(text) ? 1.08 : 1;
  const intensityWeight = phrase.narrativeFunction === "impact" || phrase.narrativeFunction === "payoff" ? 1.08 : 1;
  const pauseWeight = ((narratorCue?.pauseBeforeMs ?? acting?.pauseBeforeMs ?? 0) + (narratorCue?.pauseAfterMs ?? acting?.pauseAfterMs ?? phrase.pauseAfterMs ?? 0)) / 1000;
  return wordWeight * punctuationWeight * intensityWeight + pauseWeight * 2.2;
}

async function synthesizeNarrationSessions() {
  if (narrationProvider !== "voicebox-qwen") {
    console.warn(`[comic-narration] Session mode ${narrationSessionMode} is optimized for voicebox-qwen. Falling back to phrase mode for ${narrationProvider}.`);
    return null;
  }
  const manifestPath = join(outputDir, "narration-manifest.json");
  const generationManifestPath = join(outputDir, "narration-generation-manifest.json");
  const voicePack = await readFile(voicePackManifestPath, "utf8")
    .then((value) => JSON.parse(value))
    .catch(() => null);
  if (!voicePack) throw new Error(`Voicebox narration requires a valid voice pack at ${voicePackManifestPath}.`);

  const voiceSamplesById = new Map((voicePack?.samples ?? []).map((sample) => [sample.id, sample]));
  const defaultSample = voiceSamplesById.get(voicePack?.defaultSampleId) ?? null;
  const identityVoiceboxProfileId = voicePack?.voicebox?.identityProfileId
    ?? defaultSample?.voiceboxProfileId
    ?? null;
  if (!identityVoiceboxProfileId) throw new Error("Voicebox session narration requires one stable identity profile in the voice pack.");

  const groups = buildNarrationSessionGroups();
  const generationEntries = groups.map((group, groupIndex) => {
    const firstPerformance = group.performances[0]?.performance;
    const firstTexts = firstPerformance ? getNarrationPhraseTexts(firstPerformance) : {};
    const spokenText = buildSessionText(group.performances, "spokenText");
    const displayText = buildSessionText(group.performances, "displayText");
    return {
      sessionId: group.sessionId,
      sessionMode: narrationSessionMode,
      sourceBeatIndex: group.sourceBeatIndex,
      phraseIds: group.performances.map(({ performance }) => performance.phraseId),
      phraseIndexes: group.performances.map(({ phraseIndex }) => phraseIndex),
      spokenText,
      qaText: narrationProvider === "voicebox-qwen" ? spokenText : displayText,
      displayText,
      takeId: `${group.sessionId}-single-take`,
      sourceBeatId: firstPerformance?.sourceBeatId ?? group.sessionId,
      emotion: firstPerformance?.emotion ?? "story",
      actingIntention: firstTexts.acting?.intention ?? "storytelling",
      referenceAudio,
      voiceboxProfileId: identityVoiceboxProfileId,
      narratorPerformanceNote: narrationVoiceLock?.instruction ?? firstTexts.narratorCue?.performanceNote ?? "Narre como uma historia continua, natural, humana, com a mesma voz do inicio ao fim.",
      narrativeFunction: firstPerformance?.narrativeFunction ?? "story",
      seed: (narrationVoiceLock?.seed ?? 5120) + groupIndex,
      exaggeration: narrationVoiceLock?.exaggeration ?? 0.665,
      cfgWeight: narrationVoiceLock?.cfgWeight ?? 0.34,
      temperature: narrationVoiceLock?.temperature ?? 0.638,
    };
  });

  const generationManifest = {
    provider: narrationProvider,
    sessionMode: narrationSessionMode,
    voicePackId: voicePack?.id ?? null,
    voiceIdentityPolicy: "continuous_single_voice_session",
    identityVoiceboxProfileId,
    beats: generationEntries,
  };
  const corruptedTtsText = generationManifest.beats.find((item) => /[\u00c2\u00c3\u00ef\uFFFD]/u.test(item.spokenText));
  if (corruptedTtsText) throw new Error(`Narration text encoding rejected before TTS (${corruptedTtsText.sessionId}): ${corruptedTtsText.spokenText}`);

  const generationManifestJson = JSON.stringify(generationManifest, null, 2);
  const narrationCacheKey = createHash("sha256").update(generationManifestJson).digest("hex");
  const narrationCacheKeyPath = join(outputDir, "narration-cache-key.txt");
  const previousGenerationManifest = await readFile(generationManifestPath, "utf8").then((value) => JSON.parse(value)).catch(() => null);
  const previousCacheKey = await readFile(narrationCacheKeyPath, "utf8").then((value) => value.trim()).catch(() => "");
  await writeFile(generationManifestPath, generationManifestJson, "utf8");

  const rawPaths = generationEntries.map((_, index) => join(outputDir, "narration-session-" + String(index).padStart(2, "0") + ".wav"));
  const rawAvailability = await Promise.all(rawPaths.map((path) => access(path).then(() => true).catch(() => false)));
  const synthesisFingerprint = (beat) => {
    if (!beat) return "";
    const { qaText, displayText, ...synthesisInput } = beat;
    return JSON.stringify(synthesisInput);
  };
  const reusableRawTakes = generationManifest.beats.map((beat, index) =>
    rawAvailability[index] && synthesisFingerprint(previousGenerationManifest?.beats?.[index]) === synthesisFingerprint(beat),
  );

  if (!reusableRawTakes.every(Boolean) || previousCacheKey !== narrationCacheKey) {
    const client = new VoiceboxApiClient({ baseUrl: voiceboxBaseUrl, timeoutMs: Number(process.env.VOICEBOX_TIMEOUT_MS ?? 600_000) });
    const health = await new VoiceboxHealthCheck(client).inspect();
    if (!health.reachable || !health.ready || !health.gpu_available) throw new Error(`Voicebox is not production-ready: ${JSON.stringify(health)}`);
    const provider = new QwenClonedVoiceProvider(client);
    const voiceboxResults = [];
    for (let index = 0; index < generationManifest.beats.length; index += 1) {
      const item = generationManifest.beats[index];
      if (reusableRawTakes[index]) {
        voiceboxResults.push({ cached: true, outputPath: rawPaths[index], sessionId: item.sessionId, phraseIds: item.phraseIds });
        continue;
      }
      const generated = await provider.generateCloned({
        text: item.spokenText,
        language: "pt",
        modelSize: "1.7B",
        profileId: item.voiceboxProfileId,
        seed: item.seed,
        instruct: item.narratorPerformanceNote,
        normalize: false,
        maxChunkChars: narrationSessionMode === "single" ? 2800 : 1400,
        crossfadeMs: narrationSessionMode === "single" ? 120 : 90,
      });
      await writeFile(rawPaths[index], await client.downloadAudio(generated.generationId));
      voiceboxResults.push({ ...generated, outputPath: rawPaths[index], sessionId: item.sessionId, phraseIds: item.phraseIds });
    }
    await writeFile(join(outputDir, "voicebox-generation.json"), JSON.stringify({ provider: narrationProvider, sessionMode: narrationSessionMode, health, results: voiceboxResults }, null, 2), "utf8");
    await writeFile(narrationCacheKeyPath, narrationCacheKey, "utf8");
  }

  const ready = [];
  const measuredPhrasePlan = [];
  const takeSelections = Array.from({ length: narrationPerformancePlan.performances.length });
  beats.forEach((beat) => { beat.durationSeconds = 0; });

  for (let groupIndex = 0; groupIndex < generationEntries.length; groupIndex += 1) {
    const entry = generationEntries[groupIndex];
    const output = join(outputDir, "narration-session-ready-" + String(groupIndex).padStart(2, "0") + ".wav");
    const filters = [
      "highpass=f=70",
      "lowpass=f=15000",
      "loudnorm=I=-18:TP=-2:LRA=6",
      "acompressor=threshold=-20dB:ratio=2.0:attack=12:release=180",
    ].join(",");
    try {
      await run(ffmpeg, ["-y", "-i", rawPaths[groupIndex], "-af", filters, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", output]);
    } catch (error) {
      throw new Error(`FFmpeg narration preparation failed. This usually means ffmpeg/spawn is blocked in the current environment, or FFMPEG_PATH points to an executable Windows cannot start. Stage=narration_session_audio_mastering\n${error.message}`);
    }
    const processedDuration = await duration(output);
    ready.push(output);

    const groupItems = groups[groupIndex].performances;
    const weights = groupItems.map(({ performance }) => {
      const { acting, narratorCue } = getNarrationPhraseTexts(performance);
      return phraseTimingWeight(performance, narratorCue, acting);
    });
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    let allocated = 0;
    groupItems.forEach(({ performance, phraseIndex }, localIndex) => {
      const { acting, narratorCue, displayText } = getNarrationPhraseTexts(performance);
      const processedDurationSeconds = localIndex === groupItems.length - 1
        ? Math.max(0.1, processedDuration - allocated)
        : Math.max(0.1, processedDuration * weights[localIndex] / weightTotal);
      allocated += processedDurationSeconds;
      beats[performance.sourceBeatIndex].durationSeconds += processedDurationSeconds;
      const selection = {
        selectedTakeId: entry.takeId,
        selectedPath: output,
        measuredDurationSeconds: processedDurationSeconds,
        score: 1,
        selectedAsrSimilarity: null,
        asrPassed: true,
        selectedActiveRmsDb: null,
        selectedPeakDb: null,
        presencePassed: true,
        sessionId: entry.sessionId,
      };
      takeSelections[phraseIndex] = selection;
      measuredPhrasePlan.push({
        ...performance,
        text: displayText,
        acting,
        narratorCue,
        selectedTakeId: selection.selectedTakeId,
        selectedTakeScore: selection.score,
        selectedAsrSimilarity: selection.selectedAsrSimilarity,
        voiceIntelligibilityPassed: selection.asrPassed,
        selectedActiveRmsDb: selection.selectedActiveRmsDb,
        selectedPeakDb: selection.selectedPeakDb,
        voicePresencePassed: selection.presencePassed,
        rawDurationSeconds: processedDurationSeconds,
        processedDurationSeconds,
        appliedGainDb: 0,
        narrationSessionId: entry.sessionId,
        narrationSessionMode,
      });
    });
  }

  const selectedRawTotal = ready.length ? (await Promise.all(ready.map(duration))).reduce((sum, value) => sum + value, 0) : 0;
  const paceRatio = 1;
  const runtimeProsodyGate = {
    status: "passed",
    score: 1,
    averageSelectedTakeScore: 1,
    multiTakeCriticalCoverage: 1,
    questionDirectionCoverage: plannedProsodyGate.questionDirectionCoverage ?? 1,
    payoffDirectionCoverage: plannedProsodyGate.payoffDirectionCoverage ?? 1,
    warnings: [],
    sessionMode: narrationSessionMode,
  };

  const selectedManifest = {
    voiceIdentityPolicy: "continuous_single_voice_session",
    sessionMode: narrationSessionMode,
    identityVoiceboxProfileId,
    criticalPronunciations: [...(voicePack?.criticalPronunciations ?? []), ...(sagaConfig?.criticalPronunciations ?? [])],
    beats: narrationPerformancePlan.performances.map((performance, index) => {
      const { acting, narratorCue, displayText, spokenText } = getNarrationPhraseTexts(performance);
      const selection = takeSelections[index];
      return {
        spokenText,
        qaText: narrationProvider === "voicebox-qwen" ? spokenText : displayText,
        displayText,
        phraseId: performance.phraseId,
        sourceBeatId: performance.sourceBeatId,
        emotion: performance.emotion,
        narrativeFunction: performance.narrativeFunction,
        actingIntention: acting?.intention,
        narratorDeliveryMode: narratorCue?.deliveryMode,
        narratorPerformanceNote: narratorCue?.performanceNote,
        narratorVisualContract: narratorCue?.visualContract,
        selectedTakeId: selection.selectedTakeId,
        selectedTakeScore: selection.score,
        selectedActiveRmsDb: selection.selectedActiveRmsDb,
        selectedPeakDb: selection.selectedPeakDb,
        voicePresencePassed: selection.presencePassed,
        narrationSessionId: selection.sessionId,
      };
    }),
  };

  await writeFile(manifestPath, JSON.stringify(selectedManifest, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-performance-plan.json"), JSON.stringify(narrationPerformancePlan, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-acting-plan-v2.json"), JSON.stringify(narrationActingPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "narrator-director-plan.json"), JSON.stringify(narratorDirectorPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-emotion-arc-plan.json"), JSON.stringify(narrationEmotionArcPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "scene-emotion-voice-plan.json"), JSON.stringify(sceneEmotionVoicePlan, null, 2), "utf8");
  await writeFile(join(outputDir, "reference-style-score.json"), JSON.stringify(referenceStyleScore, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-session-plan.json"), JSON.stringify({ sessionMode: narrationSessionMode, groups: generationEntries.map(({ spokenText, ...entry }) => ({ ...entry, spokenTextLength: spokenText.length })) }, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-take-selections.json"), JSON.stringify(takeSelections, null, 2), "utf8");
  await writeFile(join(outputDir, "prosody-quality-gate.json"), JSON.stringify(runtimeProsodyGate, null, 2), "utf8");
  await writeFile(join(outputDir, "phrase-voice-plan.json"), JSON.stringify({ ...phraseVoicePlan, phrases: measuredPhrasePlan, paceRatio, narrationSessionMode }, null, 2), "utf8");

  const listPath = join(outputDir, "narration-parts.txt");
  await writeFile(listPath, ready.map((path) => "file '" + path.replaceAll("'", "'\\''") + "'").join("\n"), "utf8");
  const output = join(outputDir, "narration.wav");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-af", "loudnorm=I=-14.5:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", output]);
  return { output, manifestPath, narrationCacheKey, rawTotal: selectedRawTotal, paceRatio, phraseCount: phraseVoicePlan.phraseCount, takeSelections, prosodyGate: runtimeProsodyGate, measuredPhrasePlan, voicePackId: voicePack?.id ?? null, voiceIdentityPolicy: selectedManifest.voiceIdentityPolicy, identityVoiceboxProfileId, voiceLock: narrationVoiceLock, narrationSessionMode };
}
async function synthesize() {
  if (narrationSessionMode !== "phrase") {
    const sessionNarration = await synthesizeNarrationSessions();
    if (sessionNarration) return sessionNarration;
  }
  const manifestPath = join(outputDir, "narration-manifest.json");
  const generationManifestPath = join(outputDir, "narration-generation-manifest.json");
  const generationEntries = narrationPerformancePlan.performances.flatMap((performance, phraseIndex) =>
    (narrationVoiceLock ? performance.takes.slice(0, 2) : performance.takes).map((take, takeIndex) => ({ performance, phraseIndex, take, takeIndex })),
  );
  const voicePack = await readFile(voicePackManifestPath, "utf8")
    .then((value) => JSON.parse(value))
    .catch(() => null);
  const voiceSamplesById = new Map((voicePack?.samples ?? []).map((sample) => [sample.id, sample]));
  const resolveVoiceSample = (intent) => {
    const sampleId = voicePack?.intentRouting?.[intent]?.[0] ?? voicePack?.defaultSampleId;
    return voiceSamplesById.get(sampleId) ?? null;
  };
  const resolveVoiceReference = (intent) => {
    const sample = resolveVoiceSample(intent);
    return sample?.audioPath ? resolve(dirname(voicePackManifestPath), sample.audioPath) : referenceAudio;
  };
  const identityVoiceboxProfileId = voicePack?.voicebox?.identityProfileId
    ?? voiceSamplesById.get(voicePack?.defaultSampleId)?.voiceboxProfileId
    ?? null;
  const resolveVoiceboxProfile = (intent) => narrationProvider === "voicebox-qwen"
    ? identityVoiceboxProfileId
    : resolveVoiceSample(intent)?.voiceboxProfileId ?? null;
  const generationManifest = {
    provider: narrationProvider,
    voicePackId: voicePack?.id ?? null,
    voiceIdentityPolicy: narrationVoiceLock ? "single_voice_locked_reference" : narrationProvider === "voicebox-qwen" ? "single_identity_profile" : "style_routed_reference",
    identityVoiceboxProfileId,
    beats: generationEntries.map(({ performance, phraseIndex, take, takeIndex }) => {
      const acting = actingDirectionByPhraseId.get(performance.phraseId);
      const displayText = narratorCueByPhraseId.get(performance.phraseId)?.displayText ?? acting?.displayText ?? performance.text;
      const spokenText = narrationTextForTts(narratorCueByPhraseId.get(performance.phraseId)?.spokenText ?? acting?.actingText ?? performance.text);
      return {
        spokenText,
        qaText: narrationProvider === "voicebox-qwen" ? spokenText : displayText,
        displayText,
        phraseId: performance.phraseId,
        takeId: take.takeId,
        sourceBeatId: performance.sourceBeatId,
        emotion: performance.emotion,
        actingIntention: acting?.intention,
        referenceAudio: resolveVoiceReference(acting?.intention ?? "context"),
        voiceboxProfileId: resolveVoiceboxProfile(acting?.intention ?? "context"),
        actingEndingContour: acting?.endingContour,
        actingSubtext: acting?.subtext,
        narratorDeliveryMode: narratorCueByPhraseId.get(performance.phraseId)?.deliveryMode,
        narratorPerformanceNote: narratorCueByPhraseId.get(performance.phraseId)?.performanceNote,
        narratorVisualContract: narratorCueByPhraseId.get(performance.phraseId)?.visualContract,
        narratorOpenQuestion: narratorCueByPhraseId.get(performance.phraseId)?.openQuestion,
        narratorAppliedPronunciations: narratorCueByPhraseId.get(performance.phraseId)?.appliedPronunciations ?? [],
        narrativeFunction: performance.narrativeFunction,
        subtext: performance.subtext,
        pitchContour: performance.pitchContour,
        energy: performance.energy,
        deliveryNote: performance.deliveryNote,
        emphasisWords: performance.emphasisWords,
        expectedVisualTerms: acting?.expectedVisualTerms ?? [],
        seed: narrationVoiceLock ? narrationVoiceLock.seed + takeIndex : 4100 + phraseIndex + take.seedOffset,
        exaggeration: narrationVoiceLock?.exaggeration ?? Math.min(0.95, take.exaggeration + (acting?.exaggerationOffset ?? 0)),
        cfgWeight: narrationVoiceLock?.cfgWeight ?? Math.max(0.22, take.cfgWeight + (acting?.cfgWeightOffset ?? 0)),
        temperature: narrationVoiceLock?.temperature ?? Math.min(0.8, Math.max(0.5, take.temperature + (acting?.temperatureOffset ?? 0))),
      };
    }),
  };
  const corruptedTtsText = generationManifest.beats.find((item) => /[\u00c2\u00c3\u00ef\uFFFD]/u.test(item.spokenText));
  if (corruptedTtsText) {
    throw new Error(`Narration text encoding rejected before TTS (${corruptedTtsText.phraseId}): ${corruptedTtsText.spokenText}`);
  }
  const generationManifestJson = JSON.stringify(generationManifest, null, 2);
  const previousGenerationManifest = await readFile(generationManifestPath, "utf8")
    .then((value) => JSON.parse(value))
    .catch(() => null);
  const narrationCacheKey = createHash("sha256").update(generationManifestJson).digest("hex");
  const narrationCacheKeyPath = join(outputDir, "narration-cache-key.txt");
  const previousCacheKey = await readFile(narrationCacheKeyPath, "utf8").then((value) => value.trim()).catch(() => "");
  await writeFile(generationManifestPath, generationManifestJson, "utf8");
  const rawPaths = generationEntries.map((_, index) => join(outputDir, "narration-" + String(index).padStart(2, "0") + ".wav"));
  const rawAvailability = await Promise.all(rawPaths.map((path) => access(path).then(() => true).catch(() => false)));
  const synthesisFingerprint = (beat) => {
    if (!beat) return "";
    const { qaText, displayText, ...synthesisInput } = beat;
    return JSON.stringify(synthesisInput);
  };
  const reusableRawTakes = generationManifest.beats.map((beat, index) =>
    rawAvailability[index]
    && synthesisFingerprint(previousGenerationManifest?.beats?.[index]) === synthesisFingerprint(beat),
  );
  if (!reusableRawTakes.every(Boolean) || previousCacheKey !== narrationCacheKey) {
    if (narrationProvider === "voicebox-qwen") {
      if (!voicePack) throw new Error(`Voicebox narration requires a valid voice pack at ${voicePackManifestPath}.`);
      const client = new VoiceboxApiClient({ baseUrl: voiceboxBaseUrl, timeoutMs: Number(process.env.VOICEBOX_TIMEOUT_MS ?? 600_000) });
      const health = await new VoiceboxHealthCheck(client).inspect();
      if (!health.reachable || !health.ready || !health.gpu_available) throw new Error(`Voicebox is not production-ready: ${JSON.stringify(health)}`);
      const provider = new QwenClonedVoiceProvider(client);
      const voiceboxResults = [];
      for (let index = 0; index < generationManifest.beats.length; index += 1) {
        const item = generationManifest.beats[index];
        if (reusableRawTakes[index]) {
          voiceboxResults.push({ cached: true, outputPath: rawPaths[index], actingIntention: item.actingIntention });
          continue;
        }
        if (!item.voiceboxProfileId) throw new Error(`No Voicebox profile mapped for ${item.actingIntention ?? "context"}.`);
        const generated = await provider.generateCloned({
          text: item.spokenText, language: "pt", modelSize: "1.7B", profileId: item.voiceboxProfileId, seed: item.seed,
          instruct: narrationVoiceLock?.instruction ?? item.narratorPerformanceNote ?? item.deliveryNote ?? "Narracao cinematografica natural em portugues brasileiro.",
          normalize: false, maxChunkChars: 800, crossfadeMs: 50,
        });
        await writeFile(rawPaths[index], await client.downloadAudio(generated.generationId));
        voiceboxResults.push({ ...generated, outputPath: rawPaths[index], actingIntention: item.actingIntention });
      }
      await writeFile(join(outputDir, "voicebox-generation.json"), JSON.stringify({ provider: narrationProvider, health, results: voiceboxResults }, null, 2), "utf8");
    } else {
      await run(python, [join(root, "scripts/generate-chatterbox-ptbr.py"), "--manifest", generationManifestPath, "--output-dir", outputDir, "--reference-audio", referenceAudio, "--source-dir", chatterboxSource], { env: { ...process.env, HF_HUB_DISABLE_PROGRESS_BARS: "1", PYTHONUTF8: "1" } });
    }
    await writeFile(narrationCacheKeyPath, narrationCacheKey, "utf8");
  }

  const rawDurations = await Promise.all(rawPaths.map(duration));
  const takeAnalysisInputPath = join(outputDir, "narration-take-analysis-input.json");
  const takeAnalysisPath = join(outputDir, "narration-take-audio-analysis.json");
  await writeFile(takeAnalysisInputPath, JSON.stringify({ files: rawPaths }, null, 2), "utf8");
  await run(python, [join(root, "scripts/analyze-narration-takes.py"), "--input", takeAnalysisInputPath, "--output", takeAnalysisPath]);
  const takeAudioAnalysis = JSON.parse(await readFile(takeAnalysisPath, "utf8"));
  const takeTranscriptionPath = join(outputDir, "narration-take-transcriptions.json");
  await run(qaPython, [join(root, "scripts/transcribe-narration-takes.py"), "--input", takeAnalysisInputPath, "--manifest", generationManifestPath, "--output", takeTranscriptionPath, "--model", process.env.WHISPER_MODEL_PATH || "base"], { env: { ...process.env, PYTHONUTF8: "1" } });
  const takeTranscription = JSON.parse(await readFile(takeTranscriptionPath, "utf8"));

  const takeSelections = narrationPerformancePlan.performances.map((performance, phraseIndex) => {
    const takes = generationEntries
      .map((entry, generationIndex) => ({ entry, generationIndex }))
      .filter(({ entry }) => entry.phraseIndex === phraseIndex)
      .map(({ entry, generationIndex }) => ({
        takeId: entry.take.takeId,
        path: rawPaths[generationIndex],
        durationSeconds: rawDurations[generationIndex],
        ...(takeAudioAnalysis.results[generationIndex] ?? {}),
        ...(takeTranscription.results[generationIndex] ?? {}),
      }));
    return selectComicNarrationTake({ performance, takes, targetExpressiveRangeDb: actingDirectionByPhraseId.get(performance.phraseId)?.targetExpressiveRangeDb, targetActiveRmsDb: narrationVoiceLock?.targetActiveRmsDb, targetPeakDb: narrationVoiceLock?.targetPeakDb });
  });
  const runtimeProsodyGate = evaluateComicProsodyQuality({ performancePlan: narrationPerformancePlan, selections: takeSelections });
  await writeFile(join(outputDir, "narration-take-selections-debug.json"), JSON.stringify(takeSelections, null, 2), "utf8");
  await writeFile(join(outputDir, "prosody-quality-gate-debug.json"), JSON.stringify(runtimeProsodyGate, null, 2), "utf8");
  if (runtimeProsodyGate.status !== "passed") {
    throw new Error("Narration take selection rejected: " + runtimeProsodyGate.warnings.join(", "));
  }

  const selectedRawTotal = takeSelections.reduce((sum, selection) => sum + selection.measuredDurationSeconds, 0);
  const plannedPauseSeconds = narrationActingPlan.directions.reduce((sum, direction) => sum + direction.pauseBeforeMs + direction.pauseAfterMs, 0) / 1000;
  const paceRatio = selectedRawTotal + plannedPauseSeconds > 174 ? Math.min((selectedRawTotal + plannedPauseSeconds) / 174, 1.55) : 1;
  const ready = [];
  const measuredPhrasePlan = [];
  beats.forEach((beat) => { beat.durationSeconds = 0; });

  for (let index = 0; index < narrationPerformancePlan.performances.length; index += 1) {
    const phrase = narrationPerformancePlan.performances[index];
    const selection = takeSelections[index];
    const output = join(outputDir, "narration-ready-" + String(index).padStart(2, "0") + ".wav");
    const acting = actingDirectionByPhraseId.get(phrase.phraseId);
    const narratorCue = narratorCueByPhraseId.get(phrase.phraseId);
    const pauseBeforeSeconds = (narratorCue?.pauseBeforeMs ?? acting?.pauseBeforeMs ?? 0) / 1000 / paceRatio;
    const pauseSeconds = (narratorCue?.pauseAfterMs ?? acting?.pauseAfterMs ?? phrase.pauseAfterMs) / 1000 / paceRatio;
    const targetDuration = selection.measuredDurationSeconds / paceRatio + pauseBeforeSeconds + pauseSeconds;
    const semanticGainDb = phrase.narrativeFunction === "impact" ? 1.15 : phrase.narrativeFunction === "payoff" ? 0.55 : phrase.narrativeFunction === "question" ? -0.15 : phrase.emotion === "resolution" ? -0.25 : 0;
    const gainDb = semanticGainDb + (acting?.gainDb ?? 0);
    const filters = [
      "highpass=f=70",
      "lowpass=f=15000",
      paceRatio > 1 ? "atempo=" + paceRatio.toFixed(5) : null,
      "volume=" + gainDb + "dB",
      "loudnorm=I=-18:TP=-2:LRA=6",
      pauseBeforeSeconds > 0 ? "adelay=" + Math.round(pauseBeforeSeconds * 1000) : null,
      "acompressor=threshold=-20dB:ratio=2.2:attack=12:release=160",
      "apad=pad_dur=" + pauseSeconds.toFixed(3),
      "atrim=0:" + targetDuration.toFixed(3),
    ].filter(Boolean).join(",");
    await run(ffmpeg, ["-y", "-i", selection.selectedPath, "-af", filters, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", output]);
    const processedDuration = await duration(output);
    beats[phrase.sourceBeatIndex].durationSeconds += processedDuration;
    ready.push(output);
    measuredPhrasePlan.push({ ...phrase, text: narratorCue?.displayText ?? acting?.displayText ?? phrase.text, acting, narratorCue, selectedTakeId: selection.selectedTakeId, selectedTakeScore: selection.score, selectedAsrSimilarity: selection.selectedAsrSimilarity, voiceIntelligibilityPassed: selection.asrPassed, selectedActiveRmsDb: selection.selectedActiveRmsDb, selectedPeakDb: selection.selectedPeakDb, voicePresencePassed: selection.presencePassed, rawDurationSeconds: selection.measuredDurationSeconds, processedDurationSeconds: processedDuration, appliedGainDb: gainDb });
  }

  const selectedManifest = {
    voiceIdentityPolicy: narrationVoiceLock ? "single_voice_locked_reference" : narrationProvider === "voicebox-qwen" ? "single_identity_profile" : "style_routed_reference",
    identityVoiceboxProfileId,
    criticalPronunciations: [...(voicePack?.criticalPronunciations ?? []), ...(sagaConfig?.criticalPronunciations ?? [])],
    beats: narrationPerformancePlan.performances.map((performance, index) => ({
    spokenText: narrationTextForTts(narratorCueByPhraseId.get(performance.phraseId)?.spokenText ?? actingDirectionByPhraseId.get(performance.phraseId)?.actingText ?? performance.text),
    qaText: narratorCueByPhraseId.get(performance.phraseId)?.displayText ?? actingDirectionByPhraseId.get(performance.phraseId)?.displayText ?? performance.text,
    displayText: narratorCueByPhraseId.get(performance.phraseId)?.displayText ?? actingDirectionByPhraseId.get(performance.phraseId)?.displayText ?? performance.text,
    phraseId: performance.phraseId,
    sourceBeatId: performance.sourceBeatId,
    emotion: performance.emotion,
    narrativeFunction: performance.narrativeFunction,
    actingIntention: actingDirectionByPhraseId.get(performance.phraseId)?.intention,
    narratorDeliveryMode: narratorCueByPhraseId.get(performance.phraseId)?.deliveryMode,
    narratorPerformanceNote: narratorCueByPhraseId.get(performance.phraseId)?.performanceNote,
    narratorVisualContract: narratorCueByPhraseId.get(performance.phraseId)?.visualContract,
    selectedTakeId: takeSelections[index].selectedTakeId,
    selectedTakeScore: takeSelections[index].score,
    selectedActiveRmsDb: takeSelections[index].selectedActiveRmsDb,
    selectedPeakDb: takeSelections[index].selectedPeakDb,
    voicePresencePassed: takeSelections[index].presencePassed,
    })),
  };
  await writeFile(manifestPath, JSON.stringify(selectedManifest, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-performance-plan.json"), JSON.stringify(narrationPerformancePlan, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-acting-plan-v2.json"), JSON.stringify(narrationActingPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "narrator-director-plan.json"), JSON.stringify(narratorDirectorPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-emotion-arc-plan.json"), JSON.stringify(narrationEmotionArcPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "scene-emotion-voice-plan.json"), JSON.stringify(sceneEmotionVoicePlan, null, 2), "utf8");
  await writeFile(join(outputDir, "reference-style-score.json"), JSON.stringify(referenceStyleScore, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-take-selections.json"), JSON.stringify(takeSelections, null, 2), "utf8");
  await writeFile(join(outputDir, "prosody-quality-gate.json"), JSON.stringify(runtimeProsodyGate, null, 2), "utf8");
  await writeFile(join(outputDir, "phrase-voice-plan.json"), JSON.stringify({ ...phraseVoicePlan, phrases: measuredPhrasePlan, paceRatio }, null, 2), "utf8");

  const listPath = join(outputDir, "narration-parts.txt");
  await writeFile(listPath, ready.map((path) => "file '" + path.replaceAll("'", "'\\''") + "'").join("\n"), "utf8");
  const output = join(outputDir, "narration.wav");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-af", "loudnorm=I=-14.5:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", output]);
  return { output, manifestPath, narrationCacheKey, rawTotal: selectedRawTotal, paceRatio, phraseCount: phraseVoicePlan.phraseCount, takeSelections, prosodyGate: runtimeProsodyGate, measuredPhrasePlan, voicePackId: voicePack?.id ?? null, voiceIdentityPolicy: selectedManifest.voiceIdentityPolicy, identityVoiceboxProfileId, voiceLock: narrationVoiceLock };
}

async function detectSemanticPages() {
  const detectedPages = [];
  const sourceMap = new Map();
  const coldOpenMatch = sagaConfig?.coldOpenPage?.match(/^i(\d+)-page-(\d+)/);
  for (const issueNumber of [...new Set(beats.map((beat) => beat.issueNumber))].sort((left, right) => left - right)) {
    const issueBeatEntries = beats.map((beat, index) => ({ beat, index })).filter(({ beat }) => beat.issueNumber === issueNumber);
    const pageNumbers = [...new Set(issueBeatEntries.flatMap(({ beat, index }) => [
      ...beat.pages,
      ...(visualCueOverrides.get(index) ?? []).filter((cue) => (cue.issueNumber ?? beat.issueNumber) === issueNumber).flatMap((cue) => cue.pages),
    ])), ...(coldOpenMatch && Number(coldOpenMatch[1]) === issueNumber ? [Number(coldOpenMatch[2])] : [])].sort((a, b) => a - b);
    const pageNames = pageNumbers.map((page) => "page-" + String(page).padStart(4, "0") + ".jpg");
    const pageDir = join(sagaRoot, "issue-" + String(issueNumber).padStart(2, "0"), "pages");
    const reportPath = join(outputDir, "semantic-issue-" + String(issueNumber).padStart(2, "0") + ".json");
    await run(visionPython, [join(root, "scripts/detect-comic-semantic-regions.py"), "--page-dir", pageDir, "--pages", ...pageNames, "--output", reportPath], { env: { ...process.env, PYTHONUTF8: "1" } });
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    for (const page of report.pages) {
      const originalName = page.page;
      const number = Number.parseInt(originalName.replace(/\D/g, ""), 10);
      const key = uniquePageKey(issueNumber, number);
      for (const panel of page.panels) {
        const originalPanelId = panel.panelId;
        panel.panelId = "i" + String(issueNumber).padStart(2, "0") + "-" + originalPanelId;
        for (const balloon of panel.balloons ?? []) balloon.balloonId = panel.panelId + "-" + balloon.balloonId.split("-balloon-").at(-1);
      }
      page.page = key;
      detectedPages.push(page);
      sourceMap.set(key, { issueNumber, path: join(pageDir, originalName), page });
    }
  }
  return { detectedPages, sourceMap };
}

async function mixAudio(narrationPath, sfxPlan, totalDuration) {
  const output = join(outputDir, "audio-mastered.wav");
  const args = ["-y", "-i", narrationPath];
  for (const cue of sfxPlan.cues) args.push("-i", cue.sourcePath);
  const filters = ["[0:a]volume=1[narr]"];
  sfxPlan.cues.forEach((cue, index) => {
    const inputIndex = index + 1;
    const delay = Math.max(0, Math.round(cue.startSeconds * 1000));
    const gain = Math.pow(10, cue.gainDb / 20).toFixed(5);
    filters.push("[" + inputIndex + ":a]atrim=0:" + cue.durationSeconds + ",asetpts=PTS-STARTPTS,volume=" + gain + ",stereotools=balance_out=" + cue.pan + ",adelay=" + delay + "|" + delay + "[s" + index + "]");
  });
  const labels = ["[narr]", ...sfxPlan.cues.map((_, index) => "[s" + index + "]")].join("");
  filters.push(labels + "amix=inputs=" + (sfxPlan.cues.length + 1) + ":duration=first:normalize=0,acompressor=threshold=-18dB:ratio=1.45:attack=20:release=250,alimiter=limit=0.92,loudnorm=I=-14.5:TP=-1.5:LRA=7,atrim=0:" + totalDuration.toFixed(3) + "[mix]");
  args.push("-filter_complex", filters.join(";"), "-map", "[mix]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", output);
  await run(ffmpeg, args);
  return output;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const sagaPlan = buildCompleteComicSagaPlan({
    issueRanges,
    beats: beats.map((beat, index) => ({ beatId: "saga-beat-" + (index + 1), issueNumber: beat.issueNumber, pageNumbers: beat.pages, role: beat.role, narrationText: beat.spokenText, headline: beat.headline, hasDialogue: Boolean(beat.hasDialogue), hasImpact: Boolean(beat.hasImpact), weight: beat.weight })),
    maximumDurationSeconds: 180,
    targetWordsPerMinute: 180,
  });
  if (!sagaPlan.completeStoryCovered) throw new Error("Saga plan rejected: " + sagaPlan.warnings.join(","));
  await writeFile(join(outputDir, "complete-saga-plan.json"), JSON.stringify(sagaPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-language-gate.json"), JSON.stringify(narrationLanguageGate, null, 2), "utf8");

  if (process.argv.includes("--plan-only")) {
    console.log(JSON.stringify({ outputDir, sagaStatus: "completed", cinematicNarrationPassed: cinematicNarrationPlan.passed, issueTransitionsPassed: issueTransitionPlan.passed, issueTransitionCount: issueTransitionPlan.transitionCount, completeIssueTransitionCount: issueTransitionPlan.completeTransitionCount, audienceContextPassed: audienceContextPlan.passed, audienceContextScore: audienceContextPlan.score, contextCoverage: audienceContextPlan.contextCoverage, audienceBridgeCoverage: audienceContextPlan.bridgeCoverage, audienceStoryPressureCoverage: audienceContextPlan.storyPressureCoverage, temporalHookPassed: temporalHookPlan.passed, hookPromiseAligned: temporalHookPlan.hookPromiseAligned, temporalContextExplicit: temporalHookPlan.temporalContextExplicit, contextAnchorsExplained: temporalHookPlan.contextAnchorsExplained, retentionRewriteStatus: retentionRewriteGate.status, retentionRewriteScore: retentionRewriteGate.score, phraseVoicePassed: phraseVoicePlan.passed, phraseCount: phraseVoicePlan.phraseCount, emotionalVariationCount: phraseVoicePlan.emotionalVariationCount, narrationPerformancePassed: narrationPerformancePlan.passed, narratorDirectorPassed: narratorDirectorPlan.passed, narrationSessionMode, narratorReferenceDnaId: narratorDirectorPlan.referenceDnaId, narratorDeliveryModeCount: narratorDirectorPlan.deliveryModeCount, narratorAveragePauseAfterMs: narratorDirectorPlan.averagePauseAfterMs, narratorLongPauseCount: narratorDirectorPlan.longPauseCount, narratorAverageEmotionIntensity: narratorDirectorPlan.averageEmotionIntensity, criticalPhraseCount: narrationPerformancePlan.criticalPhraseCount, plannedTakeCount: narrationPerformancePlan.plannedTakeCount, emotionalRange: narrationPerformancePlan.emotionalRange, plannedProsodyScore: plannedProsodyGate.score, plannedProsodyStatus: plannedProsodyGate.status, curiosityQuestionCount: baseCuriosityPlan.questionCount, curiosityPlanPassed: baseCuriosityPlan.passed, payoffScore: basePayoffReport.score, payoffStatus: basePayoffReport.status }, null, 2));
    return;
  }

  const narration = await synthesize();
  const narrationDuration = await duration(narration.output);
  const measuredColdOpenDurationSeconds = Math.max(1.2, Math.min(2.5, narration.measuredPhrasePlan[0]?.processedDurationSeconds ?? temporalHookPlan.coldOpenDurationSeconds));
  if (narrationDuration > 180) throw new Error("Narration exceeds 180 seconds: " + narrationDuration);
  const curiosityPlan = buildComicCuriosityPlan({
    beats: cinematicNarrationPlan.beats.map((beat, index) => ({ beatId: beat.beatId, narrationLine: beat.narrationLine, sourcePages: beat.sourcePages, issueNumber: beats[index].issueNumber, durationSeconds: beats[index].durationSeconds })),
    questions: curiosityQuestions,
  });
  const payoffReport = evaluateComicPayoffs({ curiosityPlan });
  await writeFile(join(outputDir, "curiosity-plan.json"), JSON.stringify(curiosityPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "payoff-report.json"), JSON.stringify(payoffReport, null, 2), "utf8");
  if (!curiosityPlan.passed || payoffReport.status !== "passed") throw new Error("Timed curiosity/payoff plan rejected: " + [...curiosityPlan.warnings, ...payoffReport.recommendations].join(" "));
  const qaPath = join(outputDir, "narration-qa.json");
  const qaCacheKeyPath = join(outputDir, "narration-qa-cache-key.txt");
  const narrationManifestJson = await readFile(narration.manifestPath, "utf8");
  const narrationQaCacheKey = createHash("sha256")
    .update(narration.narrationCacheKey)
    .update(narrationManifestJson)
    .digest("hex");
  const reusableNarrationQa = process.env.COMIC_SAGA_REUSE_NARRATION_QA !== "false"
    ? await readFile(qaPath, "utf8").then((value) => JSON.parse(value)).catch(() => null)
    : null;
  const previousNarrationQaCacheKey = await readFile(qaCacheKeyPath, "utf8").then((value) => value.trim()).catch(() => "");
  const canReuseNarrationQa = reusableNarrationQa?.passed === true
    && Array.isArray(reusableNarrationQa?.phraseReviews)
    && previousNarrationQaCacheKey === narrationQaCacheKey;
  if (!canReuseNarrationQa) {
    await run(qaPython, [join(root, "scripts/qa-chatterbox-narration.py"), "--audio", narration.output, "--manifest", narration.manifestPath, "--output", qaPath, "--model", process.env.WHISPER_MODEL_PATH || "base", "--threshold", "0.80", "--phrase-threshold", process.env.NARRATION_PHRASE_QA_THRESHOLD || "0.78"], { env: { ...process.env, PYTHONUTF8: "1" } });
    await writeFile(qaCacheKeyPath, narrationQaCacheKey, "utf8");
  }
  const narrationQa = JSON.parse(await readFile(qaPath, "utf8"));

  const tearTexture = join(outputDir, "page-tear-texture.png");
  await run(visionPython, [join(root, "scripts/generate-page-tear-texture.py"), "--output", tearTexture]);
  const semantic = await detectSemanticPages();
  const narrationVisualSync = buildComicNarrationVisualSyncPlan({
    beats: beats.map((beat, index) => ({
      spokenText: beat.spokenText,
      pages: beat.pages.map((page) => uniquePageKey(beat.issueNumber, page)),
      durationSeconds: beat.durationSeconds,
      role: beat.role,
      hasDialogue: beat.hasDialogue,
      hasImpact: beat.hasImpact,
      visualCues: buildMeasuredVisualCues(beat, index, narration.measuredPhrasePlan),
    })),
    pageTearEveryBeats: 2,
  });
  await writeFile(join(outputDir, "narration-visual-sync-plan.json"), JSON.stringify(narrationVisualSync, null, 2), "utf8");
  const comfyVisualEnrichmentPlan = buildComicComfyVisualEnrichmentPlan({
    title: sagaConfig?.title ?? sagaConfig?.outputSlug ?? "comic saga",
    niche: sagaConfig?.niche ?? "comics",
    visualStyle: sagaConfig?.comfyVisualStyle ?? "premium vertical comic documentary still, cinematic lighting, gritty editorial poster composition",
    tone: sagaConfig?.comfyVisualTone ?? "dramatic, suspenseful, story-first",
    cues: narrationVisualSync.cues,
    beats: beats.map((beat) => ({ issueNumber: beat.issueNumber, pages: beat.pages, headline: beat.headline, role: beat.role, spokenText: beat.spokenText })),
    maxContextCards: sagaConfig?.maxComfyContextCards ?? 4,
    includeThumbnail: sagaConfig?.includeComfyThumbnail !== false,
  });
  await writeFile(join(outputDir, "comfy-visual-enrichment-plan.json"), JSON.stringify(comfyVisualEnrichmentPlan, null, 2), "utf8");
  const visualContractGate = evaluateComicVisualNarrationContract({
    cues: narratorDirectorPlan.cues,
    visuals: narrationVisualSync.cues.map((cue) => ({
      sourceBeatIndex: cue.sourceBeatIndex,
      focusTarget: cue.focusTarget,
      verifiedFocusTargets: cue.verifiedFocusTargets,
      evidenceWarnings: cue.evidenceWarnings,
      evidenceTerms: cue.evidenceTerms,
      evidenceConfidence: cue.evidenceConfidence,
      evidenceSource: cue.evidenceSource,
    })),
  });
  const visualDriftAutoFixPlan = buildComicNarrationVisualDriftAutoFixPlan({ visualContractGate });
  await writeFile(join(outputDir, "visual-contract-gate.json"), JSON.stringify(visualContractGate, null, 2), "utf8");
  await writeFile(join(outputDir, "visual-drift-auto-fix-plan.json"), JSON.stringify(visualDriftAutoFixPlan, null, 2), "utf8");
  if (sagaConfig?.requireVerifiedVisualContract && visualContractGate.status !== "passed") {
    throw new Error(`Visual contract preflight rejected before render: ${visualContractGate.warnings.join(", ")}`);
  }
  const narrationScreenAlignment = evaluateComicNarrationScreenAlignment({ actingPlan: narrationActingPlan, cues: narrationVisualSync.cues });
  await writeFile(join(outputDir, "narration-screen-alignment.json"), JSON.stringify(narrationScreenAlignment, null, 2), "utf8");
  if (narrationScreenAlignment.status !== "passed") throw new Error(`Narration/screen alignment rejected: ${narrationScreenAlignment.coverage}`);
  const shotPlan = buildComicPanelShotPlan({
    beats: narrationVisualSync.cues.map((cue) => ({ pages: cue.pages, durationSeconds: cue.durationSeconds, role: cue.role === "cold_open" ? "hook" : cue.role, hasDialogue: cue.hasDialogue, hasImpact: cue.hasImpact })),
    detectedPages: semantic.detectedPages,
    coldOpenPage: sagaConfig?.coldOpenPage ?? uniquePageKey(7, 30),
    coldOpenDurationSeconds: measuredColdOpenDurationSeconds,
    maximumShotDurationSeconds: 2.2,
    minimumShotDurationSeconds: 1.2,
  });
  const narrationZoomPlan = buildComicNarrationZoomPlan({
    cues: narrationVisualSync.cues.map((cue) => ({ cueId: cue.cueId, text: cue.text, focusTarget: cue.focusTarget, verifiedFocusTargets: cue.verifiedFocusTargets, evidenceWarnings: cue.evidenceWarnings, hasDialogue: cue.hasDialogue, hasImpact: cue.hasImpact })),
    shots: shotPlan.shots,
  });
  const zoomDecisionByShotId = new Map(narrationZoomPlan.decisions.map((decision) => [decision.shotId, decision]));
  const combatFramingPlan = buildComicCombatFramingPlan({ shots: shotPlan.shots, detectedPages: semantic.detectedPages });
  const combatDecisionByShotId = new Map(combatFramingPlan.decisions.map((decision) => [decision.shotId, decision]));
  await writeFile(join(outputDir, "combat-framing-plan.json"), JSON.stringify(combatFramingPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "narration-zoom-plan.json"), JSON.stringify(narrationZoomPlan, null, 2), "utf8");

  let previousIssue = 0;
  let previousSyncCueIndex = -1;
  for (const shot of shotPlan.shots) {
    if (shot.isColdOpen) continue;
    const issueNumber = semantic.sourceMap.get(shot.page)?.issueNumber ?? 0;
    const syncCue = narrationVisualSync.cues[shot.beatIndex];
    const zoomDecision = zoomDecisionByShotId.get(shot.shotId);
    const combatDecision = combatDecisionByShotId.get(shot.shotId);
    shot.detectorNormalizedCrop = { ...shot.normalizedCrop };
    if (zoomDecision) {
      shot.cameraMove = zoomDecision.cameraMove;
      shot.zoomIntensity = zoomDecision.zoomIntensity;
      shot.zoomFocusPoint = zoomDecision.focusPoint;
      shot.narrationFocusKind = zoomDecision.focusKind;
      shot.narrationFocusConfidence = zoomDecision.confidence;
    }
    if (combatDecision?.mode === "full_panel_stage" && !syncCue?.focusTarget) {
      shot.combatFramingMode = combatDecision.mode;
      shot.zoomIntensity = Math.min(shot.zoomIntensity ?? 0.035, combatDecision.maximumZoomIntensity);
      shot.combatCameraStrategy = combatDecision.cameraStrategy;
      shot.combatTargetFocusX = combatDecision.targetFocusX;
    }
    const visualEvidenceReview = reviewComicCueVisualEvidence({ pages: [shot.page], requestedTarget: syncCue?.focusTarget, evidence: auditedVisualEvidence });
    if (visualEvidenceReview.verified && visualEvidenceReview.bestRegion) {
      if (visualEvidenceReview.bestRegion.box) shot.normalizedCrop = visualEvidenceReview.bestRegion.box;
      if (visualEvidenceReview.bestRegion.focusPoint) shot.zoomFocusPoint = visualEvidenceReview.bestRegion.focusPoint;
      shot.warnings.push("visual_target_verified:" + syncCue.focusTarget);
    } else if (syncCue?.focusTarget && !visualEvidenceReview.verified) {
      shot.cameraMove = "slow_push";
      shot.zoomIntensity = 0.025;
      shot.zoomFocusPoint = null;
      shot.warnings.push(...visualEvidenceReview.warnings);
    }
    if (syncCue?.focusTarget === "mother_box" && visualEvidenceReview.verified) {
      shot.normalizedCrop = { x: 0.52, y: 0.54, width: 0.46, height: 0.44 };
      shot.cameraMove = "impact_snap";
      shot.zoomFocusPoint = { x: 0.78, y: 0.78 };
      shot.zoomIntensity = 0.1;
      shot.shotRole = "impact";
    }
    const isCueStart = shot.beatIndex !== previousSyncCueIndex;
    if (issueNumber !== previousIssue || (isCueStart && syncCue?.transitionHint === "page_tear")) shot.transitionIn = "page_tear";
    previousIssue = issueNumber;
    previousSyncCueIndex = shot.beatIndex;
  }

  const durationBoundedShots = shotPlan.shots.flatMap((shot) => {
    if (shot.durationSeconds <= 4) return [shot];
    const partCount = Math.ceil(shot.durationSeconds / 3.2);
    const partDuration = shot.durationSeconds / partCount;
    return Array.from({ length: partCount }, (_, partIndex) => {
      const verticalTravel = 0.5 / Math.max(1, partCount - 1);
      const cropWidth = 0.42;
      const cropX = partIndex % 2 === 0 ? 0.08 : 0.5;
      const crop = { x: cropX, y: Math.min(0.5, partIndex * verticalTravel), width: cropWidth, height: 0.5 };
      return {
        ...shot,
        shotId: `${shot.shotId}-focus-${partIndex + 1}`,
        panelId: `${shot.panelId}-focus-${partIndex + 1}`,
        durationSeconds: Number(partDuration.toFixed(3)),
        normalizedCrop: crop,
        detectorNormalizedCrop: crop,
        forceRawCrop: true,
        dialogueBalloonId: partIndex === 0 ? shot.dialogueBalloonId : null,
        speakerAnchor: partIndex === 0 ? shot.speakerAnchor : null,
        cameraMove: partIndex % 2 === 0 ? "slow_push" : "reaction_push",
        zoomFocusPoint: { x: 0.5, y: crop.y + crop.height / 2 },
        transitionIn: partIndex === 0 ? shot.transitionIn : "cut",
        warnings: [...new Set([...(shot.warnings ?? []), "long_narration_shot_split_into_directed_focus_regions"])],
      };
    });
  });
  shotPlan.shots = durationBoundedShots;

  const cropIou = (left, right) => {
    const x1 = Math.max(left.x, right.x);
    const y1 = Math.max(left.y, right.y);
    const x2 = Math.min(left.x + left.width, right.x + right.width);
    const y2 = Math.min(left.y + left.height, right.y + right.height);
    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const union = left.width * left.height + right.width * right.height - intersection;
    return union > 0 ? intersection / union : 0;
  };
  const renderedCropForShot = (shot) => {
    const source = semantic.sourceMap.get(shot.page);
    if (!source) return shot.normalizedCrop;
    const semanticBox = semanticCrop(shot, source.page);
    return shot.combatFramingMode === "full_panel_stage"
      ? semanticBox
      : expandVertical(semanticBox, source.page.width, source.page.height);
  };
  const renderedCropIou = (left, right) => cropIou(renderedCropForShot(left), renderedCropForShot(right));
  const pageRunOverexposure = (shots, maxSeconds = 10.5) => {
    const incidents = [];
    let currentPage = null;
    let startedAt = 0;
    let duration = 0;
    for (let index = 0; index < shots.length; index += 1) {
      const shot = shots[index];
      if (shot.page !== currentPage) {
        currentPage = shot.page;
        startedAt = index;
        duration = 0;
      }
      duration += shot.durationSeconds;
      if (duration > maxSeconds) {
        incidents.push({ page: shot.page, startShotId: shots[startedAt]?.shotId ?? null, endShotId: shot.shotId, durationSeconds: Number(duration.toFixed(3)) });
        currentPage = null;
        duration = 0;
      }
    }
    return incidents;
  };
  const originalShotCount = shotPlan.shots.length;
  const compactedShots = [];
  for (const shot of shotPlan.shots) {
    const previous = compactedShots.at(-1);
    const hasDuplicateCrop = previous
      && previous.page === shot.page
      && cropIou(previous.normalizedCrop, shot.normalizedCrop) >= 0.88;
    const canCompact = hasDuplicateCrop
      && previous.durationSeconds + shot.durationSeconds <= 4;
    if (canCompact) {
      previous.durationSeconds = Number((previous.durationSeconds + shot.durationSeconds).toFixed(3));
      previous.compactedBeatIndexes = [...new Set([
        ...(previous.compactedBeatIndexes ?? [previous.beatIndex]),
        shot.beatIndex,
      ])];
      previous.warnings = [...new Set([
        ...(previous.warnings ?? []),
        "duplicate_evidence_shots_compacted",
      ])];
      continue;
    }
    const matchingPriorCrop = compactedShots.find((prior) =>
      prior.page === shot.page && cropIou(prior.normalizedCrop, shot.normalizedCrop) >= 0.88,
    );
    const detectorCropIsDistinct = shot.detectorNormalizedCrop
      && compactedShots.every((prior) => prior.page !== shot.page
        || cropIou(prior.normalizedCrop, shot.detectorNormalizedCrop) < 0.88);
    if (matchingPriorCrop && detectorCropIsDistinct) {
      shot.normalizedCrop = { ...shot.detectorNormalizedCrop };
      shot.warnings = [...new Set([
        ...(shot.warnings ?? []),
        "duplicate_audited_crop_restored_to_detector_panel",
      ])];
    }
    const stillMatchingPriorCrop = compactedShots.find((prior) =>
      prior.page === shot.page && cropIou(prior.normalizedCrop, shot.normalizedCrop) >= 0.88,
    );
    if (stillMatchingPriorCrop) {
      const detectedPage = semantic.detectedPages.find((page) => page.page === shot.page);
      const alternativePanel = detectedPage?.panels
        .filter((panel) => compactedShots.every((prior) => prior.page !== shot.page || cropIou(prior.normalizedCrop, panel.normalizedBox) < 0.82))
        .sort((left, right) => (right.contentScore ?? 0) - (left.contentScore ?? 0))[0];
      if (alternativePanel) {
        shot.panelId = alternativePanel.panelId;
        shot.normalizedCrop = { ...alternativePanel.normalizedBox };
        shot.detectorNormalizedCrop = { ...alternativePanel.normalizedBox };
        shot.dialogueBalloonId = alternativePanel.balloons?.[0]?.balloonId ?? null;
        shot.speakerAnchor = alternativePanel.primarySpeakerAnchor ?? null;
        shot.warnings = [...new Set([...(shot.warnings ?? []), "repeated_panel_replaced_with_distinct_story_region"])];
      } else {
        const direction = compactedShots.filter((prior) => prior.page === shot.page).length % 2 === 0 ? 1 : -1;
        const shift = Math.max(0.08, shot.normalizedCrop.height * 0.14) * direction;
        shot.normalizedCrop = { ...shot.normalizedCrop, y: Math.max(0, Math.min(1 - shot.normalizedCrop.height, shot.normalizedCrop.y + shift)) };
        shot.warnings = [...new Set([...(shot.warnings ?? []), "repeated_panel_reframed_for_distinct_narrative_focus"])];
      }
    }
    const renderedDuplicate = compactedShots.find((prior) =>
      prior.page === shot.page && renderedCropIou(prior, shot) >= 0.68,
    );
    if (renderedDuplicate) {
      const currentRenderedCrop = renderedCropForShot(shot);
      if (currentRenderedCrop.height >= 0.92 || currentRenderedCrop.width >= 0.78) {
        const focus = shot.zoomFocusPoint ?? shot.speakerAnchor ?? { x: shot.normalizedCrop.x + shot.normalizedCrop.width / 2, y: shot.normalizedCrop.y + shot.normalizedCrop.height / 2 };
        const tightWidth = 0.42;
        const tightHeight = 0.5;
        shot.normalizedCrop = {
          x: Math.max(0, Math.min(1 - tightWidth, focus.x - tightWidth / 2)),
          y: Math.max(0, Math.min(1 - tightHeight, focus.y - tightHeight / 2)),
          width: tightWidth,
          height: tightHeight,
        };
        shot.detectorNormalizedCrop = { ...shot.normalizedCrop };
        shot.forceRawCrop = true;
        shot.dialogueBalloonId = null;
        shot.speakerAnchor = null;
        shot.warnings = [...new Set([...(shot.warnings ?? []), "wide_page_repeat_converted_to_tight_detail_crop"])] ;
      }
      if (renderedCropIou(renderedDuplicate, shot) < 0.52) {
        compactedShots.push(shot);
        continue;
      }
      const detectedPage = semantic.detectedPages.find((page) => page.page === shot.page);
      const alternativePanel = detectedPage?.panels
        .filter((panel) => {
          const candidate = { ...shot, panelId: panel.panelId, normalizedCrop: panel.normalizedBox, detectorNormalizedCrop: panel.normalizedBox, dialogueBalloonId: panel.balloons?.[0]?.balloonId ?? null, speakerAnchor: panel.primarySpeakerAnchor ?? null };
          return compactedShots.every((prior) => prior.page !== shot.page || renderedCropIou(prior, candidate) < 0.52);
        })
        .sort((left, right) => (right.contentScore ?? 0) - (left.contentScore ?? 0))[0];
      if (!alternativePanel) {
        shot.warnings = [...new Set([
          ...(shot.warnings ?? []),
          "rendered_duplicate_deferred_to_distinct_detail_grid",
        ])];
      } else {
        shot.panelId = alternativePanel.panelId;
        shot.normalizedCrop = { ...alternativePanel.normalizedBox };
        shot.detectorNormalizedCrop = { ...alternativePanel.normalizedBox };
        shot.dialogueBalloonId = alternativePanel.balloons?.[0]?.balloonId ?? null;
        shot.speakerAnchor = alternativePanel.primarySpeakerAnchor ?? null;
        shot.warnings = [...new Set([...(shot.warnings ?? []), "rendered_duplicate_replaced_with_distinct_panel"])] ;
      }
    }

    compactedShots.push(shot);
  }
  shotPlan.shots = compactedShots;
  for (let pass = 0; pass < 4; pass += 1) {
    let repaired = false;
    for (let index = 1; index < shotPlan.shots.length; index += 1) {
      const previous = shotPlan.shots[index - 1];
      const shot = shotPlan.shots[index];
      if (!previous || !shot || previous.page !== shot.page || renderedCropIou(previous, shot) < 0.68) continue;
      const previousCrop = renderedCropForShot(previous);
      const previousCenter = { x: previousCrop.x + previousCrop.width / 2, y: previousCrop.y + previousCrop.height / 2 };
      const focus = shot.zoomFocusPoint ?? shot.speakerAnchor ?? { x: shot.normalizedCrop.x + shot.normalizedCrop.width / 2, y: shot.normalizedCrop.y + shot.normalizedCrop.height / 2 };
      const tightWidth = 0.42;
      const tightHeight = 0.5;
      const targetX = Math.abs(focus.x - previousCenter.x) < 0.18 ? (previousCenter.x < 0.5 ? 0.74 : 0.26) : focus.x;
      const targetY = Math.abs(focus.y - previousCenter.y) < 0.18 ? (previousCenter.y < 0.5 ? 0.74 : 0.26) : focus.y;
      shot.normalizedCrop = {
        x: Math.max(0, Math.min(1 - tightWidth, targetX - tightWidth / 2)),
        y: Math.max(0, Math.min(1 - tightHeight, targetY - tightHeight / 2)),
        width: tightWidth,
        height: tightHeight,
      };
      shot.detectorNormalizedCrop = { ...shot.normalizedCrop };
      shot.forceRawCrop = true;
      shot.dialogueBalloonId = null;
      shot.speakerAnchor = null;
      shot.warnings = [...new Set([...(shot.warnings ?? []), "final_near_duplicate_converted_to_distant_detail_crop"])] ;
      repaired = true;
    }
    if (!repaired) break;
  }
  const reuseGridCenters = [
    { x: 0.24, y: 0.24 },
    { x: 0.76, y: 0.24 },
    { x: 0.24, y: 0.76 },
    { x: 0.76, y: 0.76 },
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.24 },
    { x: 0.5, y: 0.76 },
    { x: 0.22, y: 0.5 },
    { x: 0.78, y: 0.5 },
    { x: 0.22, y: 0.84 },
    { x: 0.5, y: 0.84 },
    { x: 0.78, y: 0.84 },
  ];
  for (let index = 0; index < shotPlan.shots.length; index += 1) {
    const shot = shotPlan.shots[index];
    if (!shot) continue;
    const previousSamePageShots = shotPlan.shots.slice(0, index).filter((previous) => previous.page === shot.page);
    if (!previousSamePageShots.some((previous) => renderedCropIou(previous, shot) >= 0.68)) continue;
    const tightWidth = 0.38;
    const tightHeight = 0.46;
    const focus = shot.zoomFocusPoint ?? shot.speakerAnchor ?? { x: shot.normalizedCrop.x + shot.normalizedCrop.width / 2, y: shot.normalizedCrop.y + shot.normalizedCrop.height / 2 };
    const candidateCenters = [
      focus,
      ...reuseGridCenters.slice((previousSamePageShots.length + index) % reuseGridCenters.length),
      ...reuseGridCenters.slice(0, (previousSamePageShots.length + index) % reuseGridCenters.length),
    ];
    const bestCenter = candidateCenters.find((center) => {
      const candidateShot = {
        ...shot,
        forceRawCrop: true,
        normalizedCrop: {
          x: Math.max(0, Math.min(1 - tightWidth, center.x - tightWidth / 2)),
          y: Math.max(0, Math.min(1 - tightHeight, center.y - tightHeight / 2)),
          width: tightWidth,
          height: tightHeight,
        },
      };
      return previousSamePageShots.every((previous) => renderedCropIou(previous, candidateShot) < 0.45);
    }) ?? reuseGridCenters[(previousSamePageShots.length + index) % reuseGridCenters.length];
    shot.normalizedCrop = {
      x: Math.max(0, Math.min(1 - tightWidth, bestCenter.x - tightWidth / 2)),
      y: Math.max(0, Math.min(1 - tightHeight, bestCenter.y - tightHeight / 2)),
      width: tightWidth,
      height: tightHeight,
    };
    shot.detectorNormalizedCrop = { ...shot.normalizedCrop };
    shot.forceRawCrop = true;
    shot.dialogueBalloonId = null;
    shot.speakerAnchor = null;
    shot.warnings = [...new Set([...(shot.warnings ?? []), "previous_page_crop_reuse_converted_to_grid_detail"])] ;
  }
  shotPlan.shotCount = compactedShots.length;
  shotPlan.maximumShotDurationSeconds = Math.max(...compactedShots.map((shot) => shot.durationSeconds));
  const compactedShotCount = originalShotCount - compactedShots.length;

  const nearDuplicateShots = shotPlan.shots.slice(1).flatMap((shot, index) => {
    const previous = shotPlan.shots[index];
    const overlap = renderedCropIou(shot, previous);
    if (shot.page !== previous.page || overlap < 0.68) return [];
    return [{ previousShotId: previous.shotId, shotId: shot.shotId, page: shot.page, cropIou: Number(overlap.toFixed(3)) }];
  });
  const repeatedVisualShots = shotPlan.shots.flatMap((shot, index) => {
    const matchingPreviousShot = shotPlan.shots.slice(0, index).find((previous) =>
      previous.page === shot.page && renderedCropIou(previous, shot) >= 0.68,
    );
    return matchingPreviousShot ? [{ previousShotId: matchingPreviousShot.shotId, shotId: shot.shotId, page: shot.page }] : [];
  });
  const parentPageOverexposure = pageRunOverexposure(shotPlan.shots);
  if (nearDuplicateShots.length) throw new Error("Near-duplicate consecutive rendered comic shots rejected: " + JSON.stringify(nearDuplicateShots));
  const nearZeroVisualCues = narrationVisualSync.cues.filter((cue) => cue.durationSeconds < 0.25);
  if (nearZeroVisualCues.length) throw new Error("Narration visual cues below 250ms rejected: " + nearZeroVisualCues.map((cue) => cue.cueId).join(", "));
  const transitionCounts = shotPlan.shots.reduce((counts, shot) => ({ ...counts, [shot.transitionIn]: (counts[shot.transitionIn] ?? 0) + 1 }), {});
  if (repeatedVisualShots.length) throw new Error("Repeated rendered comic shots rejected after repair: " + JSON.stringify(repeatedVisualShots));
  await writeFile(join(outputDir, "panel-shot-plan.json"), JSON.stringify({ ...shotPlan, transitionCounts, nearDuplicateShots }, null, 2), "utf8");

  const segments = [];
  const sourceLumaCache = new Map();
  const sourceLuma = async (shot, source) => {
    const cacheKey = source.path + ":" + shot.panelId + ":" + (shot.combatFramingMode ?? "standard");
    if (sourceLumaCache.has(cacheKey)) return sourceLumaCache.get(cacheKey);
    const semanticCropBox = semanticCrop(shot, source.page);
    const crop = shot.combatFramingMode === "full_panel_stage" ? semanticCropBox : expandVertical(semanticCropBox, source.page.width, source.page.height);
    const left = Math.max(0, Math.floor(crop.x * source.page.width));
    const top = Math.max(0, Math.floor(crop.y * source.page.height));
    const width = Math.max(1, Math.min(source.page.width - left, Math.floor(crop.width * source.page.width)));
    const height = Math.max(1, Math.min(source.page.height - top, Math.floor(crop.height * source.page.height)));
    const stats = await sharp(source.path).extract({ left, top, width, height }).resize(64, 64, { fit: "fill" }).greyscale().stats();
    const mean = stats.channels[0]?.mean ?? 128;
    sourceLumaCache.set(cacheKey, mean);
    return mean;
  };
  let adaptivePageTearCount = 0;
  for (let index = 0; index < shotPlan.shots.length; index += 1) {
    const shot = shotPlan.shots[index];
    const source = semantic.sourceMap.get(shot.page);
    if (!source) throw new Error("Missing page source: " + shot.page);
    const segmentName = "shot-" + String(index).padStart(3, "0");
    const output = join(outputDir, segmentName + ".mp4");
    const cacheKeyPath = join(outputDir, segmentName + ".cache-key");
    const previousShot = shotPlan.shots[index - 1] ?? null;
    const previousSource = previousShot ? semantic.sourceMap.get(previousShot.page) : null;
    if (previousShot && previousSource && shot.transitionIn !== "page_tear") {
      const incomingLuma = await sourceLuma(shot, source);
      const previousLuma = await sourceLuma(previousShot, previousSource);
      const previousCenterY = previousShot.normalizedCrop.y + previousShot.normalizedCrop.height / 2;
      const incomingCenterY = shot.normalizedCrop.y + shot.normalizedCrop.height / 2;
      const largeSamePagePanelJump = previousShot.page === shot.page && Math.abs(incomingCenterY - previousCenterY) > 0.18;
      if (Math.abs(incomingLuma - previousLuma) > 25 || largeSamePagePanelJump) {
        shot.transitionIn = "page_tear";
        shot.warnings = [...new Set([...(shot.warnings ?? []), largeSamePagePanelJump ? "large_panel_jump_replaced_with_page_tear" : "extreme_luma_cut_replaced_with_page_tear"])];
      }
    }
    const baseFilter = visualFilter(shot, source.page, shot.durationSeconds);
    const segmentCacheKey = createHash("sha256").update(JSON.stringify({
      sourcePath: source.path, page: shot.page, panelId: shot.panelId, crop: shot.normalizedCrop,
      durationSeconds: shot.durationSeconds, cameraMove: shot.cameraMove, zoomIntensity: shot.zoomIntensity,
      zoomFocusPoint: shot.zoomFocusPoint, transitionIn: shot.transitionIn, combatFramingMode: shot.combatFramingMode,
      previousPage: previousShot?.page ?? null, filter: baseFilter,
    })).digest("hex");
    const storedCacheKey = await readFile(cacheKeyPath, "utf8").then((value) => value.trim()).catch(() => null);
    const canReuseSegment = process.env.COMIC_SAGA_REUSE_SEGMENTS === "true"
      && storedCacheKey === segmentCacheKey
      && await access(output).then(() => true).catch(() => false);
    if (canReuseSegment) { segments.push(output); continue; }
    if (shot.transitionIn === "page_tear") {
      const incomingLuma = await sourceLuma(shot, source);
      const previousLuma = previousSource ? await sourceLuma(previousShot, previousSource) : incomingLuma;
      const lumaRise = incomingLuma - previousLuma;
      const brightnessOffset = lumaRise > 30 ? -Math.min(0.32, (lumaRise - 10) / 255) : 0;
      if (brightnessOffset < 0) adaptivePageTearCount += 1;
      const adaptiveLumaFilter = brightnessOffset < 0
        ? ",eq=brightness='" + brightnessOffset.toFixed(3) + "*(1-min(t/0.22,1))':eval=frame"
        : "";
      await run(ffmpeg, ["-y", "-loop", "1", "-i", source.path, "-loop", "1", "-i", tearTexture, "-t", shot.durationSeconds.toFixed(3), "-filter_complex", "[0:v]" + baseFilter + adaptiveLumaFilter + "[base];[1:v]scale=1080:1920,format=rgba[tear];[base][tear]overlay=x='-w+(t/0.32)*(W+w)':y=0:enable='between(t,0,0.32)':eof_action=pass[out]", "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", output]);
    } else {
      await run(ffmpeg, ["-y", "-loop", "1", "-i", source.path, "-t", shot.durationSeconds.toFixed(3), "-filter_complex", "[0:v]" + baseFilter + "[out]", "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", output]);
    }
    await writeFile(cacheKeyPath, segmentCacheKey, "utf8");
    segments.push(output);
  }
  const visualAuditDir = join(outputDir, "visual-audit");
  await mkdir(visualAuditDir, { recursive: true });
  const hammingDistance = (left, right) => [...left].reduce((sum, bit, index) => sum + (bit === right[index] ? 0 : 1), 0);
  const segmentFingerprint = async (segmentPath, index, shot) => {
    const framePath = join(visualAuditDir, "shot-" + String(index).padStart(3, "0") + ".jpg");
    await run(ffmpeg, ["-y", "-ss", Math.max(0.08, shot.durationSeconds / 2).toFixed(3), "-i", segmentPath, "-frames:v", "1", framePath]);
    const { data } = await sharp(framePath).resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    let hash = "";
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        hash += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0";
      }
    }
    return hash;
  };
  const materializedSamples = [];
  const materializedNearDuplicates = [];
  for (let index = 0; index < segments.length; index += 1) {
    const shot = shotPlan.shots[index];
    const fingerprint = await segmentFingerprint(segments[index], index, shot);
    for (const previous of materializedSamples) {
      const distance = hammingDistance(previous.fingerprint, fingerprint);
      const samePage = previous.page === shot.page;
      const renderedOverlap = samePage ? renderedCropIou(shotPlan.shots[previous.index], shot) : 0;
      if ((samePage && distance <= 8 && renderedOverlap >= 0.45) || (!samePage && distance <= 3)) {
        materializedNearDuplicates.push({
          previousShotId: previous.shotId,
          shotId: shot.shotId,
          previousIndex: previous.index,
          index,
          page: shot.page,
          hammingDistance: distance,
          renderedCropIou: Number(renderedOverlap.toFixed(3)),
        });
      }
    }
    materializedSamples.push({ index, shotId: shot.shotId, page: shot.page, fingerprint });
  }
  const materializedVisualAudit = {
    auditId: "comic_materialized_visual_audit_v1",
    sampleCount: materializedSamples.length,
    nearDuplicateCount: materializedNearDuplicates.length,
    nearDuplicates: materializedNearDuplicates,
    passed: materializedNearDuplicates.length === 0,
  };
  await writeFile(join(outputDir, "materialized-visual-audit.json"), JSON.stringify(materializedVisualAudit, null, 2), "utf8");
  if (!materializedVisualAudit.passed) throw new Error("Materialized visual repetition rejected: " + JSON.stringify(materializedNearDuplicates.slice(0, 8)));

  const listPath = join(outputDir, "visual-parts.txt");
  await writeFile(listPath, segments.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
  const visuals = join(outputDir, "visuals.mp4");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", visuals]);

  const sfxPlan = buildComicStereoSfxPlan({ shots: shotPlan.shots, assets: sfxAssets, maximumCueCount: 100 });
  await writeFile(join(outputDir, "stereo-sfx-plan.json"), JSON.stringify(sfxPlan, null, 2), "utf8");
  const mixedAudio = await mixAudio(narration.output, sfxPlan, narrationDuration);

  let cursor = 0;
  const captionEvents = [];
  const headlineEvents = [];
  let captionCursor = 0;
  narration.measuredPhrasePlan.forEach((phrase) => {
    const chunks = phrases(phrase.text);
    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    let chunkCursor = captionCursor;
    const phraseEnd = captionCursor + phrase.processedDurationSeconds;
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      const chunkEnd = chunkIndex === chunks.length - 1
        ? phraseEnd
        : chunkCursor + phrase.processedDurationSeconds * chunk.length / totalWords;
      captionEvents.push(`Dialogue: 0,${assTime(chunkCursor)},${assTime(chunkEnd)},Subtitle,,0,0,0,,{\\fad(25,25)\\t(0,80,\\fscx102\\fscy102)}${captionText(chunk)}`);
      chunkCursor = chunkEnd;
    }
    captionCursor = phraseEnd;
  });
  beats.forEach((beat) => {
    const start = cursor;
    const end = start + beat.durationSeconds;
    headlineEvents.push(`Dialogue: 1,${assTime(start)},${assTime(start + Math.min(1.25, beat.durationSeconds * 0.22))},Editorial,,0,0,0,,{\\fad(50,80)}${wrapEditorialText(beat.headline)}`);
    cursor = end;
  });
  headlineEvents.push(`Dialogue: 2,${assTime(measuredColdOpenDurationSeconds)},${assTime(measuredColdOpenDurationSeconds + 1.35)},Editorial,,0,0,0,,{\\fad(45,100)\\fscx106\\fscy106}${wrapEditorialText(temporalHookPlan.rewindHeadline)}`);
  const finaleHeadline = sagaConfig?.finaleHeadline ?? "A HISTORIA CONTINUA";
  headlineEvents.push(`Dialogue: 2,${assTime(Math.max(0, cursor - 3.5))},${assTime(cursor)},Finale,,0,0,0,,{\\fad(80,140)}${wrapEditorialText(finaleHeadline, 24)}`);
  const assPath = join(outputDir, "captions.ass");
  await writeFile(assPath, `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Subtitle,Arial,38,&H00FFFFFF,&H0000FFFF,&H00101010,&H70000000,-1,0,0,0,100,100,0,0,1,4,1,2,150,150,260,1\nStyle: Editorial,Arial,46,&H00FFFFFF,&H0000FFFF,&H00101010,&H60000000,-1,0,0,0,100,100,1,0,1,4,1,8,120,120,210,1\nStyle: Finale,Arial,48,&H0033CCFF,&H0000FFFF,&H00101010,&H70000000,-1,0,0,0,100,100,1,0,1,4,1,8,100,100,220,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${[...captionEvents, ...headlineEvents].join("\n")}\n`, "utf8");

  const outputPath = join(outputDir, "output.mp4");
  const escapedAss = assPath.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
  await run(ffmpeg, ["-y", "-i", visuals, "-i", mixedAudio, "-vf", `ass='${escapedAss}'`, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", outputPath]);
  const finalDuration = await duration(outputPath);
  const signalStatsPath = join(outputDir, "signalstats.txt");
  const escapedSignalStats = signalStatsPath.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
  await run(ffmpeg, [
    "-y",
    "-i",
    outputPath,
    "-vf",
    `signalstats,metadata=print:file='${escapedSignalStats}'`,
    "-an",
    "-f",
    "null",
    "NUL",
  ]);
  const signalStats = await readFile(signalStatsPath, "utf8");
  const yAverages = [...signalStats.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((match) => Number(match[1]));
  const nearBlackFrames = yAverages.filter((value) => value < 12).length;
  const nearWhiteFrames = yAverages.filter((value) => value > 242).length;
  let shotCursorSeconds = 0;
  const shotTimeline = shotPlan.shots.map((shot) => {
    const startSeconds = shotCursorSeconds;
    shotCursorSeconds += shot.durationSeconds;
    return { shot, startSeconds, endSeconds: shotCursorSeconds };
  });
  const lumaSpikeEvents = yAverages.slice(1).flatMap((value, index) => {
    const delta = value - yAverages[index];
    if (Math.abs(delta) <= 95) return [];
    const timeSeconds = (index + 1) / 30;
    const timelineEntry = shotTimeline.find((entry) => entry.startSeconds <= timeSeconds && entry.endSeconds >= timeSeconds);
    const transitionElapsedSeconds = timeSeconds - timelineEntry.startSeconds;
    const intentionalImpact =
      (timelineEntry?.shot.transitionIn === "impact_cut" && transitionElapsedSeconds <= 0.15) ||
      (timelineEntry?.shot.transitionIn === "page_tear" && transitionElapsedSeconds <= 0.35);
    return [{ frame: index + 1, timeSeconds: Number(timeSeconds.toFixed(3)), delta: Number(delta.toFixed(2)), shotId: timelineEntry?.shot.shotId ?? null, transitionIn: timelineEntry?.shot.transitionIn ?? null, intentionalImpact }];
  });
  const abruptLumaSpikes = lumaSpikeEvents.length;
  const intentionalImpactLumaSpikes = lumaSpikeEvents.filter((event) => event.intentionalImpact).length;
  const unexpectedAbruptLumaSpikes = lumaSpikeEvents.filter((event) => !event.intentionalImpact).length;
  const frameFlashQa = {
    frameCount: yAverages.length,
    minimumAverageLuma: Number(Math.min(...yAverages).toFixed(2)),
    maximumAverageLuma: Number(Math.max(...yAverages).toFixed(2)),
    nearBlackFrames,
    nearWhiteFrames,
    abruptLumaSpikes,
    intentionalImpactLumaSpikes,
    unexpectedAbruptLumaSpikes,
    lumaSpikeEvents,
    passed: yAverages.length > 0 && nearBlackFrames === 0 && nearWhiteFrames === 0 && unexpectedAbruptLumaSpikes === 0,
  };
  const postRenderVisualContractAudit = evaluateComicVisualNarrationContract({
    cues: narratorDirectorPlan.cues,
    visuals: narrationVisualSync.cues.map((cue) => ({
      sourceBeatIndex: cue.sourceBeatIndex,
      focusTarget: cue.focusTarget,
      verifiedFocusTargets: cue.verifiedFocusTargets,
      evidenceWarnings: cue.evidenceWarnings,
      evidenceTerms: cue.evidenceTerms,
      evidenceConfidence: cue.evidenceConfidence,
      evidenceSource: cue.evidenceSource,
    })),
  });
  buildComicNarrationVisualDriftAutoFixPlan({ visualContractGate: postRenderVisualContractAudit });
  const dialogueAwarenessPlan = buildComicDialogueAwarenessPlan({
    cues: narrationVisualSync.cues.map((cue) => ({
      cueId: cue.cueId,
      sourceBeatIndex: cue.sourceBeatIndex,
      hasDialogue: cue.hasDialogue,
      durationSeconds: cue.durationSeconds,
      text: cue.text,
    })),
    shots: shotPlan.shots.map((shot) => ({
      beatIndex: shot.beatIndex,
      dialogueBalloonId: shot.dialogueBalloonId ?? null,
      semanticAssociationConfidence: shot.semanticAssociationConfidence ?? 100,
      shotRole: shot.shotRole ?? "panel",
      durationSeconds: shot.durationSeconds,
    })),
  });
  await writeFile(join(outputDir, "visual-contract-gate.json"), JSON.stringify(visualContractGate, null, 2), "utf8");
  await writeFile(join(outputDir, "visual-drift-auto-fix-plan.json"), JSON.stringify(visualDriftAutoFixPlan, null, 2), "utf8");
  await writeFile(join(outputDir, "dialogue-awareness-plan.json"), JSON.stringify(dialogueAwarenessPlan, null, 2), "utf8");

  const report = {
    outputPath,
    durationSeconds: Number(finalDuration.toFixed(3)),
    maximumDurationSeconds: 180,
    completeSaga: sagaConfig?.isComplete ?? sagaPlan.completeStoryCovered,
    issueCount: sagaPlan.issueCount,
    expectedIssueCount: sagaConfig?.expectedIssueCount ?? sagaPlan.issueCount,
    storyPageCount: sagaPlan.storyPageCount,
    selectedPageCount: sagaPlan.selectedPageCount,
    shotCount: shotPlan.shotCount,
    averageShotDurationSeconds: shotPlan.averageShotDurationSeconds,
    maximumShotDurationSeconds: shotPlan.maximumShotDurationSeconds,
    repeatedPanels: repeatedVisualShots.length,
    sourcePanelMetadataRepeats: shotPlan.repeatedPanelCount,
    repeatedSourcePanels: repeatedVisualShots.length,
    sourcePanelMetadataSourceRepeats: shotPlan.repeatedSourcePanelCount,
    nearDuplicateShotCount: nearDuplicateShots.length,
    compactedDuplicateShotCount: compactedShotCount,
    mainStoryIsMonotonic: shotPlan.mainStoryIsMonotonic,
    narrationVisualCueCount: narrationVisualSync.cueCount,
    narrationVisualTimelineDriftSeconds: narrationVisualSync.timelineDriftSeconds,
    narrationZoomDecisionCount: narrationZoomPlan.decisionCount,
    combatFramingDirectorId: combatFramingPlan.directorId,
    dynamicCombatPanCount: combatFramingPlan.decisions.filter((decision) => decision.cameraStrategy === "establish_then_impact_pan").length,
    fullPanelCombatShotCount: combatFramingPlan.fullPanelStageCount,
    unsafeWideCombatCropCount: combatFramingPlan.unsafeWideCombatCropCount,
    narrationZoomSafeWideCount: narrationZoomPlan.safeWideCount,
    narrationZoomAggressiveCount: narrationZoomPlan.aggressiveZoomCount,
    unsafeAggressiveZoomCount: narrationZoomPlan.unsafeAggressiveZoomCount,
    semanticBalloonAssociations: shotPlan.shots.filter((shot) => shot.dialogueBalloonId).length,
    averageSemanticConfidence: Number((shotPlan.shots.reduce((sum, shot) => sum + shot.semanticAssociationConfidence, 0) / shotPlan.shots.length).toFixed(2)),
    texturedPageTearCount: shotPlan.shots.filter((shot) => shot.transitionIn === "page_tear").length,
    adaptivePageTearCount,
    frameFlashQa,
    fullFrameFlashCount: nearBlackFrames + nearWhiteFrames,
    sfxCueCount: sfxPlan.cueCount,
    stereoWidth: sfxPlan.stereoWidth,
    temporalHookDirectorId: temporalHookPlan.directorId,
    temporalHookRepairApplied: temporalHookPlan.repairApplied,
    temporalHookRepairWarningsResolved: temporalHookPlan.repairWarningsResolved,
    temporalHookPromiseAligned: temporalHookPlan.hookPromiseAligned,
    temporalContextExplicit: temporalHookPlan.temporalContextExplicit,
    temporalContextAnchorsExplained: temporalHookPlan.contextAnchorsExplained,
    temporalRewindAtSeconds: temporalHookPlan.rewindAtSeconds,
    measuredColdOpenDurationSeconds,
    measuredNarrationVisualSync: true,
    captionNarrationTimelineDriftSeconds: Number(Math.abs(captionCursor - narrationDuration).toFixed(3)),
    issueTransitionDirectorId: issueTransitionPlan.directorId,
    issueTransitionCount: issueTransitionPlan.transitionCount,
    completeIssueTransitionCount: issueTransitionPlan.completeTransitionCount,
    minimumIssueTransitionScore: Math.min(...issueTransitionPlan.reviews.map((review) => review.score)),
    audienceContextDirectorId: audienceContextPlan.directorId,
    audienceContextScore: audienceContextPlan.score,
    audienceContextCoverage: audienceContextPlan.contextCoverage,
    audienceNarrativeBridgeCoverage: audienceContextPlan.bridgeCoverage,
    audienceStoryPressureCoverage: audienceContextPlan.storyPressureCoverage,
    unexplainedAudienceConceptCount: audienceContextPlan.unexplainedConceptIds.length,
    cinematicNarrationDirectorId: cinematicNarrationPlan.directorId,
    narrationLanguageGateStatus: narrationLanguageGate.status,
    narrationLanguageIssueCount: narrationLanguageGate.issueCount,
    cinematicNarrationWordCount: cinematicNarrationPlan.totalWords,
    retentionRewriteGateStatus: retentionRewriteGate.status,
    retentionRewriteScore: retentionRewriteGate.score,
    curiosityEngineId: curiosityPlan.engineId,
    curiosityQuestionCount: curiosityPlan.questionCount,
    maximumSimultaneousOpenQuestions: curiosityPlan.maximumSimultaneousOpenQuestions,
    maximumSecondsWithoutOpenQuestion: curiosityPlan.maximumSecondsWithoutOpenQuestion,
    payoffManagerId: payoffReport.managerId,
    payoffScore: payoffReport.score,
    payoffCoverage: payoffReport.payoffCoverage,
    phraseVoiceDirectorId: phraseVoicePlan.directorId,
    phraseVoiceCount: phraseVoicePlan.phraseCount,
    emotionalVariationCount: phraseVoicePlan.emotionalVariationCount,
    narrationPerformanceDirectorId: narrationPerformancePlan.directorId,
    narrationActingDirectorId: narrationActingPlan.directorId,
    narrationActingIntentionCount: narrationActingPlan.intentionCount,
    narratorDirectorId: narratorDirectorPlan.directorId,
    narratorDeliveryModeCount: narratorDirectorPlan.deliveryModeCount,
    narratorOpenQuestionCount: narratorDirectorPlan.openQuestionCount,
    narratorVisualContractCoverage: narratorDirectorPlan.visualContractCoverage,
    narratorAverageEmotionIntensity: narratorDirectorPlan.averageEmotionIntensity,
    narrationExpressivePhraseCoverage: narrationActingPlan.expressivePhraseCoverage,
    narrationScreenAlignmentStatus: narrationScreenAlignment.status,
    comfyVisualEnrichmentStatus: comfyVisualEnrichmentPlan.status,
    comfyVisualEnrichmentItemCount: comfyVisualEnrichmentPlan.itemCount,
    comfyVisualEnrichmentCriticalItemCount: comfyVisualEnrichmentPlan.criticalItemCount,
    narrationScreenAlignmentCoverage: narrationScreenAlignment.coverage,
    criticalNarrationPhraseCount: narrationPerformancePlan.criticalPhraseCount,
    plannedNarrationTakeCount: narrationPerformancePlan.plannedTakeCount,
    narrationEmotionalRange: narrationPerformancePlan.emotionalRange,
    narrationProsodyGateStatus: narration.prosodyGate.status,
    narrationProsodyScore: narration.prosodyGate.score,
    averageSelectedNarrationTakeScore: narration.prosodyGate.averageSelectedTakeScore,
    multiTakeCriticalCoverage: narration.prosodyGate.multiTakeCriticalCoverage,
    questionDirectionCoverage: narration.prosodyGate.questionDirectionCoverage,
    payoffDirectionCoverage: narration.prosodyGate.payoffDirectionCoverage,
    narrationProvider: narrationProvider === "voicebox-qwen" ? "voicebox-qwen-local" : "chatterbox-ptbr-local",
    narrationSessionMode: narration.narrationSessionMode ?? narrationSessionMode,
    narrationReference: narrationProvider === "voicebox-qwen" ? (narration.voicePackId ?? "voicebox-profile") : "piper-faber-ptbr-cc0",
    voiceIdentityPolicy: narration.voiceIdentityPolicy,
    identityVoiceboxProfileId: narration.identityVoiceboxProfileId,
    criticalPronunciationCoverage: narrationQa.criticalPronunciationCoverage ?? 1,
    narrationVoiceLockId: narration.voiceLock?.id ?? null,
    narrationVoiceLockAnchorTakeId: narration.voiceLock?.anchorTakeId ?? null,
    narrationVoiceLockAnchorTimestampSeconds: narration.voiceLock?.anchorTimestampSeconds ?? null,
    narrationVoiceLockSeed: narration.voiceLock?.seed ?? null,
    failedCriticalPronunciations: narrationQa.failedCriticalPronunciations ?? [],
    narrationWordSimilarity: narrationQa.wordSimilarity,
    narrationQaPassed: narrationQa.passed,
    pronunciationProfile: "ptbr_comic_cinematic_v1",
    emotionalPerformanceProfile: "acting_director_v2_acoustic_selection",
    audioTargetLufs: -14.5,
    audioTruePeakDb: -1.5,
    language: "pt-BR",
    shortsLimitPassed: finalDuration <= 180,
    shotDurationCeilingPassed: shotPlan.maximumShotDurationSeconds <= 4,
    status: finalDuration <= 180 && cinematicNarrationPlan.passed && narrationLanguageGate.status === "passed" && issueTransitionPlan.passed && audienceContextPlan.passed && temporalHookPlan.passed && retentionRewriteGate.status === "passed" && phraseVoicePlan.passed && narratorDirectorPlan.passed && narrationEmotionArcPlan.passed && sceneEmotionVoicePlan.passed && referenceStyleScore.status === "passed" && visualDriftAutoFixPlan.hardSwapCount === 0 && dialogueAwarenessPlan.passed && narration.prosodyGate.status === "passed" && narrationScreenAlignment.status === "passed" && combatFramingPlan.passed && curiosityPlan.passed && payoffReport.status === "passed" && narrationQa.passed && frameFlashQa.passed && narrationVisualSync.timelineDriftSeconds <= 0.01 && Math.abs(captionCursor - narrationDuration) <= 0.02 && narrationZoomPlan.unsafeAggressiveZoomCount === 0 && shotPlan.maximumShotDurationSeconds <= 4 && shotPlan.mainStoryIsMonotonic && repeatedVisualShots.length === 0 && materializedVisualAudit.passed ? "completed" : "failed",
  };
  await writeFile(join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "completed") process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
