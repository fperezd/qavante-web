/* @tooxs/ui — barrel del design system (Capa 1). Solo primitivos agnósticos de
   dominio. La lógica de negocio, la API y los tokens de dominio viven en cada app. */

export { cn } from "./lib/cn";

export { Button, type ButtonProps } from "./primitives/button";
export { Card, type CardProps } from "./primitives/card";
export { Badge, type BadgeProps } from "./primitives/badge";
export { Input, type InputProps } from "./primitives/input";
export { Empty, type EmptyProps } from "./primitives/empty";
export { Skeleton, type SkeletonProps } from "./primitives/skeleton";
export { InlineError, type InlineErrorProps } from "./primitives/inline-error";
export { AsyncBoundary, type AsyncBoundaryProps } from "./primitives/async-boundary";
export {
  resolveAsyncState,
  type AsyncState,
  type AsyncQueryLike,
} from "./primitives/async-boundary-state";
export { Toaster, toast } from "./primitives/toaster";
export {
  FeatureUnavailableState,
  type FeatureUnavailableStateProps,
} from "./primitives/feature-unavailable-state";
export { SourceTag, type SourceTagProps, type SourceMeta } from "./primitives/source-tag";
export { Logo, type LogoProps } from "./primitives/logo";

export { Collapsible, type CollapsibleProps } from "./primitives/collapsible";
export {
  AreaChartTooxs,
  BarChartTooxs,
  LineChartTooxs,
  type ChartProps,
  type ChartSeries,
  type ChartDatum,
} from "./primitives/chart";
export { DataTable, type DataTableProps } from "./primitives/data-table";
export { reorder, moveColumn } from "./primitives/data-table-utils";
export { Board, type BoardProps } from "./primitives/board";
export {
  type BoardItem,
  type BoardColumn,
  type BoardState,
  moveItem,
  findColumnOf,
} from "./primitives/board-state";
