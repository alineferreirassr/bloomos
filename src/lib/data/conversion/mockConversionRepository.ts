import { convertLeadToClient } from "@/modules/leads/services/LeadConversionService";
import type { ConversionRepository } from "@/lib/data/conversion/repository";

export const mockConversionRepository: ConversionRepository = {
  convertLeadToClient,
};
