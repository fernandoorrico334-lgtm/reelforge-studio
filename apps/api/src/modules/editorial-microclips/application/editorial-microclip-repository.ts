import type {
  CreateEditorialMicroclipInput,
  EditorialMicroclip,
  UpdateEditorialMicroclipInput
} from "../domain/editorial-microclip.js";

export interface EditorialMicroclipRepository {
  listByProjectId(projectId: string): Promise<EditorialMicroclip[]>;
  getById(id: string): Promise<EditorialMicroclip | null>;
  create(input: CreateEditorialMicroclipInput): Promise<EditorialMicroclip>;
  update(
    id: string,
    input: UpdateEditorialMicroclipInput
  ): Promise<EditorialMicroclip | null>;
  delete(id: string): Promise<boolean>;
  countByProjectId(projectId: string): Promise<number>;
}
