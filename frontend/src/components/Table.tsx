import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Column headings in display order. */
  headers: ReactNode[];
  /** Body rows, typically TableRow elements containing native td cells. */
  children?: ReactNode;
  /** Additional CSS classes applied to the table. */
  className?: string;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Native td cells in the same order as the table headings. */
  children?: ReactNode;
  /** Additional CSS classes applied to the row. */
  className?: string;
}

/** A horizontally scrollable semantic table with styled column headings. */
export function Table({ headers, children, className = '', ...props }: TableProps) {
  return <div className="ym-table-scroll"><table className={`ym-table ${className}`} {...props}><thead><tr>{headers.map((header, index) => <th scope="col" key={index}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

/** A styled table row; supply native td elements as children. */
export function TableRow({ className = '', ...props }: TableRowProps) {
  return <tr className={`ym-table-row ${className}`} {...props} />;
}
