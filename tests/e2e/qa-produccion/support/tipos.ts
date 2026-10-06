/* Tipos del contrato OpenAPI (sólo tipos: se borran al compilar). NO es un spec. */
import type { components } from "../../../../src/lib/api/types";

type S = components["schemas"];

export type DashboardSummary = S["DashboardSummaryResponse"];
export type BankAccountsResponse = { items: S["BankAccountItem"][] };
export type BankAccount = S["BankAccountItem"];
export type BankMovement = S["BankMovement"];
export type BankMovementsList = S["BankMovementsListResponse"];
export type ReviewQueue = S["ReviewQueueResponse"];
export type ReviewItem = S["ReviewItem"];
export type WorkInbox = S["WorkInboxResponse"];
export type CollectionForecast = S["CollectionForecastResponse"];
export type AccountsPayable = S["AccountsPayableResponse"];
export type SourcesStatus = S["SourcesStatusListResponse"];
export type CanonicalCategories = S["CanonicalCategoriesResponse"];
export type AccountTree = S["ManagementAccountTreeResponse"];
export type AccountNode = S["ManagementAccountNode"];
export type LegalEntities = S["LegalEntitiesResponse"];
