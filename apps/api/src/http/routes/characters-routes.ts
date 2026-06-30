import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { CharacterRepository } from "../../modules/characters/application/character-repository.js";
import {
  buildBasePromptForCharacter,
  createCharacter,
  createCharacterProfileFromIntake,
  createCharacterReference,
  deleteCharacter,
  deleteCharacterReference,
  getCharacterById,
  listCharacterReferences,
  listCharacters,
  updateCharacter,
  updateCharacterReference
} from "../../modules/characters/application/character-service.js";
import {
  validateCreateCharacterProfileInput,
  validateCreateCharacterReferenceInput,
  validateUpdateCharacterProfileInput,
  validateUpdateCharacterReferenceInput
} from "../../modules/characters/domain/character.js";
import type { IntakeRepository } from "../../modules/intake/application/intake-repository.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "../utils/http-utils.js";

function parseCharacterPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "characters") {
    return null;
  }

  if (segments.length === 1) {
    return { kind: "collection" as const };
  }

  if (segments[1] === "create-from-intake" && segments.length === 3) {
    return {
      kind: "create-from-intake" as const,
      slug: decodeURIComponent(segments[2] ?? "")
    };
  }

  const characterId = decodeURIComponent(segments[1] ?? "");

  if (!characterId) {
    return null;
  }

  if (segments.length === 2) {
    return { kind: "item" as const, characterId };
  }

  if (segments.length === 3 && segments[2] === "build-base-prompt") {
    return { kind: "build-base-prompt" as const, characterId };
  }

  if (segments.length === 3 && segments[2] === "references") {
    return { kind: "references" as const, characterId };
  }

  if (segments.length === 4 && segments[2] === "references") {
    return {
      kind: "reference-item" as const,
      characterId,
      referenceId: decodeURIComponent(segments[3] ?? "")
    };
  }

  return null;
}

interface CharacterRouteDependencies {
  assetRepository: AssetRepository;
  characterRepository: CharacterRepository;
  intakeRepository: IntakeRepository;
}

export async function handleCharacterRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: CharacterRouteDependencies
): Promise<boolean> {
  const match = parseCharacterPath(pathname);

  if (!match) {
    return false;
  }

  const { assetRepository, characterRepository, intakeRepository } = dependencies;

  try {
    if (match.kind === "collection") {
      if (request.method === "GET") {
        sendJson(response, 200, await listCharacters(characterRepository));
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await createCharacter(
            characterRepository,
            validateCreateCharacterProfileInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    if (match.kind === "create-from-intake") {
      if (request.method === "POST") {
        sendJson(
          response,
          201,
          await createCharacterProfileFromIntake(
            characterRepository,
            intakeRepository,
            assetRepository,
            match.slug
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "item") {
      if (request.method === "GET") {
        sendJson(response, 200, await getCharacterById(characterRepository, match.characterId));
        return true;
      }

      if (request.method === "PUT") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          200,
          await updateCharacter(
            characterRepository,
            match.characterId,
            validateUpdateCharacterProfileInput(payload)
          )
        );
        return true;
      }

      if (request.method === "DELETE") {
        await deleteCharacter(characterRepository, match.characterId);
        sendNoContent(response);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "PUT", "DELETE"]);
      return true;
    }

    if (match.kind === "build-base-prompt") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await buildBasePromptForCharacter(characterRepository, match.characterId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "references") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listCharacterReferences(characterRepository, match.characterId)
        );
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await createCharacterReference(
            characterRepository,
            match.characterId,
            validateCreateCharacterReferenceInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    if (match.kind === "reference-item") {
      if (request.method === "PUT") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          200,
          await updateCharacterReference(
            characterRepository,
            match.characterId,
            match.referenceId,
            validateUpdateCharacterReferenceInput(payload)
          )
        );
        return true;
      }

      if (request.method === "DELETE") {
        await deleteCharacterReference(
          characterRepository,
          match.characterId,
          match.referenceId
        );
        sendNoContent(response);
        return true;
      }

      sendMethodNotAllowed(response, ["PUT", "DELETE"]);
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}