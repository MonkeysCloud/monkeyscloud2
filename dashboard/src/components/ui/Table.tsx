import clsx from "clsx";
import { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No data",
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-700 bg-surface-800/80">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx("px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400", col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-700/50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-surface-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(item)}
                className={clsx(
                  "bg-surface-800/30 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-surface-800"
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={clsx("px-4 py-3 text-surface-300", col.className)}>
                    {col.render ? col.render(item) : (item[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
