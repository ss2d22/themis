"use client";

import {
  type ColumnDef,
  columnSizingFeature,
  createSortedRowModel,
  type RowData,
  rowSortingFeature,
  type SortingState,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { cn } from "./cn";

export const gridFeatures = tableFeatures({
  columnSizingFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

export type Column<T extends RowData> = ColumnDef<typeof gridFeatures, T> & {
  meta?: { align?: "left" | "right"; grow?: boolean };
};

const ROW_HEIGHT = 28;

/**
 * Dense, sortable, virtualised grid. Rows are CSS subgrid divs with ARIA table roles, because virtualised rows
 * cannot live inside a native <table>.
 * Numeric columns align right and use tabular figures so values line up.
 * Holds its frame while data refreshes; rows can link to a detail view.
 */
export function DataTable<T extends RowData>({
  data,
  columns,
  initialSort = [],
  onRowClick,
  rowClassName,
  empty,
  className,
  getRowId,
}: {
  data: T[];
  columns: Column<T>[];
  initialSort?: SortingState;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  empty?: ReactNode;
  className?: string;
  getRowId?: (row: T, index: number) => string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const table = useTable({
    features: gridFeatures,
    columns,
    data,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId,
    defaultColumn: { size: 120, minSize: 48 },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);

  const template = table
    .getAllLeafColumns()
    .map((c) =>
      (c.columnDef as Column<T>).meta?.grow ? `minmax(${c.getSize()}px, 1fr)` : `${c.getSize()}px`,
    )
    .join(" ");

  const rowGrid = { display: "grid", gridTemplateColumns: "subgrid", gridColumn: "1 / -1" } as const;

  return (
    <div ref={scrollRef} className={cn("relative min-h-0 flex-1 overflow-auto", className)}>
      <div
        role="table"
        className="min-w-full text-xs"
        style={{ display: "grid", gridTemplateColumns: template }}
      >
        <div role="row" className="sticky top-0 z-10 border-b border-line bg-panel" style={rowGrid}>
          {table.getFlatHeaders().map((header) => {
            const meta = (header.column.columnDef as Column<T>).meta;
            const sorted = header.column.getIsSorted();
            const content = header.isPlaceholder ? null : <table.FlexRender header={header} />;
            return (
              <div
                key={header.id}
                role="columnheader"
                aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                className={cn(
                  "flex h-7 items-center px-3 font-medium whitespace-nowrap text-ink-3",
                  meta?.align === "right" && "justify-end",
                )}
              >
                {header.column.getCanSort() ? (
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    className="flex items-center gap-1 select-none hover:text-ink-2"
                  >
                    {content}
                    {sorted === "asc" ? (
                      <ArrowUp size={11} />
                    ) : sorted === "desc" ? (
                      <ArrowDown size={11} />
                    ) : null}
                  </button>
                ) : (
                  content
                )}
              </div>
            );
          })}
        </div>

        {padTop > 0 ? <div style={{ gridColumn: "1 / -1", height: padTop }} /> : null}
        {items.map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          const open = onRowClick ? () => onRowClick(row.original) : undefined;
          return (
            <div
              key={row.id}
              role="row"
              tabIndex={open ? 0 : undefined}
              style={rowGrid}
              className={cn(
                "border-b border-line/60 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none",
                open && "cursor-pointer",
                rowClassName?.(row.original),
              )}
              onClick={open}
              onKeyDown={open ? (event) => event.key === "Enter" && open() : undefined}
            >
              {row.getAllCells().map((cell) => {
                const meta = (cell.column.columnDef as Column<T>).meta;
                return (
                  <div
                    key={cell.id}
                    role="cell"
                    className={cn(
                      "flex items-center truncate px-3 text-ink-2",
                      meta?.align === "right" && "num justify-end",
                    )}
                    style={{ height: ROW_HEIGHT - 1 }}
                  >
                    <table.FlexRender cell={cell} />
                  </div>
                );
              })}
            </div>
          );
        })}
        {padBottom > 0 ? <div style={{ gridColumn: "1 / -1", height: padBottom }} /> : null}
      </div>
      {rows.length === 0 ? <div className="absolute inset-x-0 top-7 bottom-0">{empty}</div> : null}
    </div>
  );
}
