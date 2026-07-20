import assert from "node:assert/strict";
import {
  buildComicStoryCompressionPlan,
  validateComicStoryCompressionPlan
} from "@reelforge/media-beast";

const plan = buildComicStoryCompressionPlan({
  targetDurationSeconds: 56,
  maximumDurationSeconds: 59,
  wordsPerSecond: 2.55,
  beats: [
    { role: "hook", text: "Nem a Liga da Justica estava preparada para ver Godzilla atravessar a cidade como uma forca da natureza.", pageNumbers: [3], importance: 1 },
    { role: "setup", text: "Enquanto civis fogem, Flash abre caminho e o Lanterna Verde tenta conter a destruicao antes que ela alcance toda a cidade.", pageNumbers: [4, 5, 6], importance: 0.9 },
    { role: "escalation", text: "Mas cada ataque so deixa o monstro mais furioso. A Liga percebe que nao enfrenta um vilao comum, e sim uma criatura que nao negocia nem recua.", pageNumbers: [7, 8, 9, 10], importance: 1 },
    { role: "turn", text: "Quando as defesas falham, Superman entra no combate como a ultima chance de impedir que tudo vire ruina.", pageNumbers: [11, 12, 13], importance: 1 },
    { role: "climax", text: "Ele parte para cima de Godzilla esperando vencer pela forca, mas o confronto mostra algo assustador: ate o homem mais poderoso do planeta pode parecer pequeno diante daquele monstro.", pageNumbers: [14, 15, 16, 17, 18], importance: 1 },
    { role: "resolution", text: "A Liga sobrevive ao primeiro choque, mas entende que nao conseguira vencer lutando separada. Agora os herois precisam encontrar outra estrategia antes do proximo ataque.", pageNumbers: [19, 20, 21, 22, 23, 24, 25], importance: 1 },
    { role: "sting", text: "Porque aquela batalha estava apenas comecando.", pageNumbers: [26, 27], importance: 0.9 }
  ]
});

const validation = validateComicStoryCompressionPlan(plan);
assert.equal(validation.passed, true, validation.blockers.join(", "));
assert.equal(plan.storySpineComplete, true);
assert.ok(plan.estimatedDurationSeconds <= 59);
assert.ok(plan.compressedWordCount >= 110);
assert.ok(plan.compressedWordCount <= plan.maximumWordCount);
assert.deepEqual(plan.chronologicalPages, Array.from({ length: 25 }, (_, index) => index + 3));
assert.ok(plan.visualMomentTarget >= 18 && plan.visualMomentTarget <= 24);

console.log(JSON.stringify({
  directorId: plan.directorId,
  sourceWordCount: plan.sourceWordCount,
  compressedWordCount: plan.compressedWordCount,
  estimatedDurationSeconds: plan.estimatedDurationSeconds,
  visualMomentTarget: plan.visualMomentTarget,
  storySpineComplete: plan.storySpineComplete,
  status: "completed"
}, null, 2));
