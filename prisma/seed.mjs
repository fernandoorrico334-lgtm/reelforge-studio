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

