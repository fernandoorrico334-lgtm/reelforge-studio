import type {
  CreateProductionDiscoveryPackageInput,
  ProductionDiscoveryPackage
} from "../domain/production-discovery.js";
import type { ProductionDiscoveryRepository } from "../application/production-discovery-repository.js";

const packages: ProductionDiscoveryPackage[] = [];

function nowIso() {
  return new Date().toISOString();
}

function sortItems(items: ProductionDiscoveryPackage[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createInMemoryProductionDiscoveryRepository(): ProductionDiscoveryRepository {
  return {
    async list() {
      return sortItems(packages);
    },
    async getById(id) {
      return packages.find((entry) => entry.id === id) ?? null;
    },
    async create(input: CreateProductionDiscoveryPackageInput) {
      const now = nowIso();
      const item: ProductionDiscoveryPackage = {
        id: `pd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        ...input,
        createdAt: now,
        updatedAt: now
      };
      packages.unshift(item);
      return item;
    },
    async update(id, input) {
      const index = packages.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return null;
      }

      const existing = packages[index] as ProductionDiscoveryPackage;
      const updated: ProductionDiscoveryPackage = {
        ...existing,
        ...input,
        updatedAt: nowIso()
      };
      packages[index] = updated;
      return updated;
    }
  };
}
