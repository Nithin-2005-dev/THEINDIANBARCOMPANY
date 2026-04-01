import * as React from "react"
import styles from "./Table.module.css"

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
}

interface TableSectionProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
}

export const TableContainer = React.forwardRef<HTMLDivElement, TableContainerProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={joinClasses(styles.container, className)} {...props}>
      {children}
    </div>
  ),
)
TableContainer.displayName = "TableContainer"

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, children, ...props }, ref) => (
    <table ref={ref} className={joinClasses(styles.table, className)} {...props}>
      {children}
    </table>
  ),
)
Table.displayName = "Table"

export const TableHeader = React.forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className, children, ...props }, ref) => (
    <thead ref={ref} className={joinClasses(styles.header, className)} {...props}>
      {children}
    </thead>
  ),
)
TableHeader.displayName = "TableHeader"

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className, children, ...props }, ref) => (
    <tbody ref={ref} className={joinClasses(styles.body, className)} {...props}>
      {children}
    </tbody>
  ),
)
TableBody.displayName = "TableBody"

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, children, ...props }, ref) => (
    <tr ref={ref} className={joinClasses(styles.row, className)} {...props}>
      {children}
    </tr>
  ),
)
TableRow.displayName = "TableRow"

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, children, ...props }, ref) => (
    <th ref={ref} className={joinClasses(styles.head, className)} {...props}>
      {children}
    </th>
  ),
)
TableHead.displayName = "TableHead"

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, children, ...props }, ref) => (
    <td ref={ref} className={joinClasses(styles.cell, className)} {...props}>
      {children}
    </td>
  ),
)
TableCell.displayName = "TableCell"

export const TableFooter = React.forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className, children, ...props }, ref) => (
    <tfoot ref={ref} className={joinClasses(styles.footer, className)} {...props}>
      {children}
    </tfoot>
  ),
)
TableFooter.displayName = "TableFooter"
