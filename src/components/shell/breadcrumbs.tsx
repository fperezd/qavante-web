type BreadcrumbsProps = {
  current: string;
};

export function Breadcrumbs({ current }: BreadcrumbsProps) {
  return <div className="text-sm text-neutral-500">App / {current}</div>;
}
