import type { ActingDirection, ActingIntent, PerformanceVariation } from "./voicebox-qwen-types.js";

const OPENING: Record<ActingIntent, string> = {
  hook: "Comece imediatamente, como quem revela algo impossivel de ignorar",
  context: "Comece proximo e claro, guiando o ouvinte",
  mystery: "Comece contido, como quem conhece um segredo",
  tension: "Comece baixo e controlado, deixando a ameaca crescer",
  action: "Comece firme e avance com urgencia cinematografica",
  reveal: "Comece com expectativa e prepare a revelacao",
  payoff: "Comece seguro e entregue a resposta com peso",
  closing: "Comece desacelerando e conduza ao ultimo impacto",
};

const ENDING: Record<ActingDirection["endingContour"], string> = {
  fall: "termine com firmeza e conclusao",
  rise: "termine como uma pergunta verdadeira",
  suspend: "termine suspenso, deixando a resposta no ar",
  impact: "termine curto, preciso e impactante",
};

const VARIATION: Record<PerformanceVariation, string> = {
  restrained: "Mantenha a emocao por baixo da voz, sem dramatizar demais",
  cinematic: "Conte como um narrador de filme, com progressao emocional natural",
  conversational: "Soe humano e proximo, como quem conta algo fascinante a uma pessoa",
  urgent: "Acelere levemente a progressao e transmita perigo real",
  intimate: "Aproxime a voz, com vulnerabilidade e silencios naturais",
  impactful: "Destaque a virada com energia, sem gritar",
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/[;:]+$/g, "");
}

export class ProsodyInstructionCompiler {
  compile(direction: ActingDirection, variation: PerformanceVariation = "cinematic") {
    const terms = direction.emphasisWords.map(clean).filter(Boolean).slice(0, 2);
    const emphasis = terms.length
      ? `Faca uma pausa breve antes de ${terms.map((term) => '"' + term + '"').join(" e ")} e enfatize ${terms.length > 1 ? "essas expressoes" : "essa expressao"} sem gritar.`
      : "";
    const progression = direction.energy >= 0.72
      ? "Aumente gradualmente a energia ao longo do trecho"
      : direction.energy <= 0.38
        ? "Preserve espaco, respiracao e tensao contida"
        : "Construa a emocao de forma gradual e natural";
    return [
      "Narre em portugues brasileiro.",
      `${OPENING[direction.intent]}, com ${clean(direction.emotion || "emocao coerente")}.`,
      `${progression}.`,
      direction.subtext ? `O subtexto e: ${clean(direction.subtext)}.` : "",
      direction.deliveryGoal ? `O objetivo e ${clean(direction.deliveryGoal)}.` : "",
      `${VARIATION[variation]}.`,
      emphasis,
      `${ENDING[direction.endingContour]}.`,
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 500);
  }
}

