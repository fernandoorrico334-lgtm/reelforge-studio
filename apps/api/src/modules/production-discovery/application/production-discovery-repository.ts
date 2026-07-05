import type {
  CreateProductionDiscoveryPackageInput,
  ProductionDiscoveryPackage,
  UpdateProductionDiscoveryPackageInput
} from "../domain/production-discovery.js";

export interface ProductionDiscoveryRepository {
  list(): Promise<ProductionDiscoveryPackage[]>;
  getById(id: string): Promise<ProductionDiscoveryPackage | null>;
  create(
    input: CreateProductionDiscoveryPackageInput
  ): Promise<ProductionDiscoveryPackage>;
  update(
    id: string,
    input: UpdateProductionDiscoveryPackageInput
  ): Promise<ProductionDiscoveryPackage | null>;
}
