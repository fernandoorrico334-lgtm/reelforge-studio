import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.renderJob.deleteMany();
  await prisma.mediaCandidate.deleteMany();
  await prisma.mediaCollection.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.videoProject.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.channel.deleteMany();

  const animeLore = await prisma.channel.create({
    data: {
      name: "Anime Lore",
      niche: "Universos anime, teorias e explicacoes de lore",
      language: "pt-BR",
      visualStyle: "Cortes dramaticos, overlays editoriais e close-ups intensos",
      narrativeTone: "Analitico com suspense",
      defaultTemplate: "anime_dark",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "high",
      defaultAudioMood: "dark_suspense",
      defaultCaptionStyle: "anime_punch",
      defaultVisualPreset: "mystery",
      defaultDurationTarget: 32,
      defaultSceneDuration: 4.2,
      preferredAssetCategories: JSON.stringify([
        "PANEL",
        "BACKGROUND",
        "CHARACTER"
      ]),
      preferredAssetTags: JSON.stringify([
        "anime",
        "lore",
        "uchiha",
        "suspense"
      ])
    }
  });

  await prisma.channel.create({
    data: {
      name: "HQs Comentadas",
      niche: "Resumos e opinioes sobre quadrinhos e sagas classicas",
      language: "pt-BR",
      visualStyle: "Painel editorial com zooms ritmados e captions bold",
      narrativeTone: "Explicativo com energia de review",
      defaultTemplate: "comic_drama",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultAudioMood: "documentary_bed",
      defaultCaptionStyle: "comic_pop",
      defaultVisualPreset: "drama",
      defaultDurationTarget: 38,
      defaultSceneDuration: 4.8,
      preferredAssetCategories: JSON.stringify([
        "COVER",
        "PANEL",
        "SCREENSHOT"
      ]),
      preferredAssetTags: JSON.stringify([
        "hq",
        "comic",
        "review",
        "batman"
      ])
    }
  });

  await prisma.channel.create({
    data: {
      name: "Curiosidades Sombrias",
      niche: "Historias inquietantes, misterios e curiosidades obscuras",
      language: "pt-BR",
      visualStyle: "Texturas escuras, silhuetas e contraste alto",
      narrativeTone: "Misterioso e provocativo",
      defaultTemplate: "true_crime",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "high",
      defaultAudioMood: "horror_tension",
      defaultCaptionStyle: "horror_whisper",
      defaultVisualPreset: "horror",
      defaultDurationTarget: 34,
      defaultSceneDuration: 4,
      preferredAssetCategories: JSON.stringify([
        "BROLL",
        "BACKGROUND",
        "SCREENSHOT"
      ]),
      preferredAssetTags: JSON.stringify([
        "sombrio",
        "misterio",
        "crime",
        "arquivo"
      ])
    }
  });

  const uchihaPanel = await prisma.asset.create({
    data: {
      filename: "uchiha-panel-01.png",
      originalName: "uchiha-panel-01.png",
      path: "storage/assets/panel/image/uchiha-panel-01.png",
      type: "IMAGE",
      category: "PANEL",
      franchise: "Naruto",
      character: "Itachi Uchiha",
      emotion: "MYSTERIOUS",
      tags: JSON.stringify(["anime", "lore", "uchiha", "hook"]),
      licenseType: "editorial-reference",
      copyrightRisk: "HIGH",
      recommendedUse: "Aberturas de reels narrativos",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: 284000
    }
  });

  const corridorShot = await prisma.asset.create({
    data: {
      filename: "village-corridor-shot.jpg",
      originalName: "village-corridor-shot.jpg",
      path: "storage/assets/background/image/village-corridor-shot.jpg",
      type: "IMAGE",
      category: "BACKGROUND",
      franchise: "Naruto",
      emotion: "DARK",
      tags: JSON.stringify(["anime", "vila", "suspense"]),
      licenseType: "editorial-reference",
      copyrightRisk: "HIGH",
      recommendedUse: "Planos de respiracao entre falas densas",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      extension: ".jpg",
      fileSize: 412000
    }
  });

  await prisma.asset.create({
    data: {
      filename: "batman-cover-issue-01.jpg",
      originalName: "batman-cover-issue-01.jpg",
      path: "storage/assets/cover/image/batman-cover-issue-01.jpg",
      type: "IMAGE",
      category: "COVER",
      franchise: "Batman",
      character: "Batman",
      emotion: "DARK",
      tags: JSON.stringify(["hq", "batman", "capa"]),
      licenseType: "editorial-reference",
      copyrightRisk: "HIGH",
      recommendedUse: "Capas e aberturas de episodios comentados",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      extension: ".jpg",
      fileSize: 503000
    }
  });

  await prisma.asset.create({
    data: {
      filename: "shadow-realm-clip.mp4",
      originalName: "shadow-realm-clip.mp4",
      path: "storage/assets/broll/video/shadow-realm-clip.mp4",
      type: "VIDEO",
      category: "BROLL",
      emotion: "TENSE",
      tags: JSON.stringify(["sombrio", "misterio", "broll"]),
      licenseType: "owned-original",
      copyrightRisk: "LOW",
      recommendedUse: "Textura de transicao para blocos sombrios",
      duration: 4.2,
      width: 1080,
      height: 1920,
      mimeType: "video/mp4",
      extension: ".mp4",
      fileSize: 2480000
    }
  });

  const ambientTrack = await prisma.asset.create({
    data: {
      filename: "ambient-dark-bed.wav",
      originalName: "ambient-dark-bed.wav",
      path: "storage/assets/track/music/ambient-dark-bed.wav",
      type: "MUSIC",
      category: "TRACK",
      emotion: "DARK",
      tags: JSON.stringify(["audio", "music", "dark", "bed"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Base musical para narrativas sombrias",
      duration: 18,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: 1640000
    }
  });

  const stadiumHypeTrack = await prisma.asset.create({
    data: {
      filename: "stadium-hype-phonk.wav",
      originalName: "stadium-hype-phonk.wav",
      path: "storage/assets/track/music/stadium-hype-phonk.wav",
      type: "MUSIC",
      category: "TRACK",
      emotion: "EPIC",
      tags: JSON.stringify(["audio", "music", "football", "hype", "phonk"]),
      licenseType: "royalty-free-local",
      copyrightRisk: "LOW",
      recommendedUse: "Reels esportivos com cortes rapidos e microclips",
      duration: 22,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: 2380000
    }
  });

  const documentaryBedTrack = await prisma.asset.create({
    data: {
      filename: "documentary-clean-bed.wav",
      originalName: "documentary-clean-bed.wav",
      path: "storage/assets/track/music/documentary-clean-bed.wav",
      type: "MUSIC",
      category: "TRACK",
      emotion: "CURIOUS",
      tags: JSON.stringify(["audio", "music", "documentary", "clean"]),
      licenseType: "licensed-pack",
      copyrightRisk: "LOW",
      recommendedUse: "Documentarios, curiosidades e storytelling limpo",
      duration: 24,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: 2520000
    }
  });

  const voiceStub = await prisma.asset.create({
    data: {
      filename: "narration-guide.wav",
      originalName: "narration-guide.wav",
      path: "storage/assets/track/audio/narration-guide.wav",
      type: "AUDIO",
      category: "TRACK",
      emotion: "NEUTRAL",
      tags: JSON.stringify(["audio", "voiceover", "guide"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Guia de narracao para testes locais",
      duration: 14,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: 1280000
    }
  });

  const hitSfx = await prisma.asset.create({
    data: {
      filename: "impact-hit.wav",
      originalName: "impact-hit.wav",
      path: "storage/assets/effect/sfx/impact-hit.wav",
      type: "SFX",
      category: "EFFECT",
      emotion: "TENSE",
      tags: JSON.stringify(["audio", "sfx", "impact"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Impacto de corte ou revelacao",
      duration: 0.6,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: 64000
    }
  });

  const whistleSfx = await prisma.asset.create({
    data: {
      filename: "stadium-whistle.wav",
      originalName: "stadium-whistle.wav",
      path: "storage/assets/effect/sfx/stadium-whistle.wav",
      type: "SFX",
      category: "EFFECT",
      emotion: "EPIC",
      tags: JSON.stringify(["audio", "sfx", "football", "whistle"]),
      licenseType: "royalty-free-local",
      copyrightRisk: "LOW",
      recommendedUse: "Transicoes e impacto em reels de futebol",
      duration: 0.9,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: 96000
    }
  });

  await prisma.musicAssetProfile.createMany({
    data: [
      {
        assetId: ambientTrack.id,
        title: "Ambient Dark Bed",
        artist: "ReelForge Seed Library",
        sourceType: "user_owned",
        licenseStatus: "owned",
        mood: "dark",
        genre: "cinematic",
        bpm: 88,
        bpmConfidence: 0.62,
        energy: "medium",
        useCase: "true_crime",
        durationSeconds: 18,
        loudness: -17.8,
        beatMarkers: JSON.stringify([
          { timeSeconds: 0, strength: 0.62, confidence: 0.5 },
          { timeSeconds: 4.1, strength: 0.71, confidence: 0.58 },
          { timeSeconds: 8.2, strength: 0.77, confidence: 0.64 },
          { timeSeconds: 12.3, strength: 0.8, confidence: 0.66 }
        ]),
        energyTimeline: JSON.stringify([
          { timeSeconds: 0, energy: 34 },
          { timeSeconds: 6, energy: 48 },
          { timeSeconds: 12, energy: 58 },
          { timeSeconds: 18, energy: 44 }
        ]),
        notes: "Base sombria para true crime e misterio.",
        safetyWarning: null
      },
      {
        assetId: stadiumHypeTrack.id,
        title: "Stadium Hype Phonk",
        artist: "ReelForge Seed Library",
        sourceType: "royalty_free",
        licenseStatus: "royalty_free",
        mood: "hype",
        genre: "phonk",
        bpm: 156,
        bpmConfidence: 0.74,
        energy: "extreme",
        useCase: "football",
        durationSeconds: 22,
        loudness: -12.4,
        beatMarkers: JSON.stringify([
          { timeSeconds: 0.48, strength: 0.82, confidence: 0.72 },
          { timeSeconds: 1.24, strength: 0.86, confidence: 0.74 },
          { timeSeconds: 2.01, strength: 0.88, confidence: 0.76 },
          { timeSeconds: 2.77, strength: 0.91, confidence: 0.77 }
        ]),
        energyTimeline: JSON.stringify([
          { timeSeconds: 0, energy: 66 },
          { timeSeconds: 6, energy: 81 },
          { timeSeconds: 12, energy: 92 },
          { timeSeconds: 18, energy: 86 }
        ]),
        notes: "Ideal para cortes rapidos, football_hype e viral_fast_cut.",
        safetyWarning: null
      },
      {
        assetId: documentaryBedTrack.id,
        title: "Documentary Clean Bed",
        artist: "ReelForge Seed Library",
        sourceType: "licensed_pack",
        licenseStatus: "licensed",
        mood: "documentary",
        genre: "ambient",
        bpm: 96,
        bpmConfidence: 0.58,
        energy: "low",
        useCase: "documentary",
        durationSeconds: 24,
        loudness: -18.6,
        beatMarkers: JSON.stringify([
          { timeSeconds: 0, strength: 0.54, confidence: 0.43 },
          { timeSeconds: 5.2, strength: 0.6, confidence: 0.46 },
          { timeSeconds: 10.4, strength: 0.64, confidence: 0.49 }
        ]),
        energyTimeline: JSON.stringify([
          { timeSeconds: 0, energy: 24 },
          { timeSeconds: 8, energy: 32 },
          { timeSeconds: 16, energy: 36 },
          { timeSeconds: 24, energy: 28 }
        ]),
        notes: "Cama discreta para explicacao e documentario.",
        safetyWarning: null
      }
    ]
  });

  await prisma.sfxAssetProfile.createMany({
    data: [
      {
        assetId: hitSfx.id,
        title: "Impact Hit",
        category: "impact",
        intensity: "high",
        durationSeconds: 0.6,
        useCase: "impact_moment",
        licenseStatus: "owned",
        notes: "Impacto curto para cortes e revelacoes."
      },
      {
        assetId: whistleSfx.id,
        title: "Stadium Whistle",
        category: "whistle",
        intensity: "high",
        durationSeconds: 0.9,
        useCase: "football",
        licenseStatus: "royalty_free",
        notes: "Entrada esportiva e transicao de microclip."
      }
    ]
  });

  await prisma.videoProject.create({
    data: {
      title: "A queda do cla Uchiha em 3 atos",
      status: "SCENE_PLANNING",
      channelId: animeLore.id,
      script:
        "Hook sobre o misterio do cla. Contexto rapido sobre a tensao politica. Fechamento com pergunta para a audiencia.",
      durationTarget: 30,
      format: "9:16",
      templateId: "anime_dark",
      defaultCaptionStyle: "anime_punch",
      backgroundMusicAssetId: ambientTrack.id,
      musicPresetId: "true_crime_dark",
      voiceoverAssetId: voiceStub.id,
      audioMood: "dark_suspense",
      musicVolume: 0.16,
      voiceVolume: 1,
      sfxVolume: 0.72,
      enableAudioDucking: true,
      duckingLevel: 0.35,
      scenes: {
        create: [
          {
            order: 1,
            title: "Hook sombrio",
            narrationText:
              "Pouca gente percebe como a tragedia comecou muito antes da noite final.",
            captionText: "A historia comecou antes do massacre",
            duration: 7.5,
            emotion: "MYSTERIOUS",
            assetId: uchihaPanel.id,
            visualPreset: "mystery",
            transition: "flash-cut",
            captionStyle: "anime_punch",
            captionPosition: "split",
            captionEmphasisWords: JSON.stringify(["historia", "massacre"]),
            energyLevel: 88,
            sfxAssetId: hitSfx.id,
            sfxStartTime: 0.2,
            sfxVolume: 0.74
          },
          {
            order: 2,
            title: "Contexto do conflito",
            narrationText:
              "A ruptura entre poder, vigilancia e medo transformou cada gesto em suspeita.",
            captionText: "Quando medo e poder se misturam",
            duration: 11,
            emotion: "DARK",
            assetId: corridorShot.id,
            visualPreset: "horror",
            transition: "fade",
            captionStyle: "horror_whisper",
            captionPosition: "lower-third",
            captionEmphasisWords: JSON.stringify(["medo", "poder"]),
            energyLevel: 64,
            sfxAssetId: hitSfx.id,
            sfxStartTime: 0.9,
            sfxVolume: 0.62
          },
          {
            order: 3,
            title: "Cliffhanger final",
            narrationText:
              "E se o verdadeiro ponto de nao retorno tiver acontecido muito antes do que contam?",
            captionText: "O ponto de nao retorno veio antes?",
            duration: 8.5,
            emotion: "CURIOUS",
            visualPreset: "suspense",
            transition: "hard-cut",
            captionEmphasisWords: JSON.stringify(["ponto", "retorno"]),
            energyLevel: 74,
            sfxAssetId: hitSfx.id,
            sfxStartTime: 0.35,
            sfxVolume: 0.68
          }
        ]
      }
    }
  });

  await prisma.channel.update({
    where: {
      id: animeLore.id
    },
    data: {
      defaultMusicAssetId: ambientTrack.id,
      defaultVoiceoverAssetId: voiceStub.id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });

