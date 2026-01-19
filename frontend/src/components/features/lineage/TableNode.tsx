'use client';

import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { TableNodeData, ColumnData } from '@/lib/lineage-types';
import { cn } from '@/lib/utils';

interface TableNodeComponentData extends TableNodeData {
  onColumnClick?: (columnId: string) => void;
  onColumnDoubleClick?: (columnId: string) => void;
  selectedColumnId?: string;
}

// React Flow passes these props to custom nodes
interface TableNodeProps {
  data: TableNodeComponentData;
  selected?: boolean;
}

const HEADER_HEIGHT = 48;
const COLUMN_HEIGHT = 28;
const PADDING_TOP = 8;

function ColumnRow({
  column,
  index,
  isSelected,
  onClick,
  onDoubleClick,
}: {
  column: ColumnData;
  index: number;
  isSelected: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const handleTop = HEADER_HEIGHT + PADDING_TOP + index * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;

  return (
    <div
      className={cn(
        'relative flex items-center justify-between px-2 py-1 text-xs cursor-pointer hover:bg-gray-50',
        column.isHighlighted && 'bg-yellow-100',
        isSelected && 'bg-blue-100'
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Target handle (incoming connections) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${column.name}-target`}
        className="!w-2 !h-2 !bg-gray-400 !border-0"
        style={{ top: handleTop }}
      />

      <div className="flex items-center gap-1.5">
        {/* Connection indicators */}
        {column.hasUpstream && (
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" title="Has upstream sources" />
        )}
        <span className="font-mono">{column.name}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-gray-400 text-[10px]">{column.type || 'unknown'}</span>
        {column.hasDownstream && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Has downstream dependents" />
        )}
      </div>

      {/* Source handle (outgoing connections) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${column.name}-source`}
        className="!w-2 !h-2 !bg-gray-400 !border-0"
        style={{ top: handleTop }}
      />
    </div>
  );
}

export const TableNode = memo(({ data, selected }: TableNodeProps) => {
  const [expanded, setExpanded] = useState(data.isExpanded !== false);

  const {
    label,
    namespace,
    columns = [],
    isHighlighted,
    onColumnClick,
    onColumnDoubleClick,
    selectedColumnId,
  } = data;

  // Truncate namespace for display
  const displayNamespace = namespace.length > 30 ? `...${namespace.slice(-27)}` : namespace;

  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-md border-2 min-w-[220px] max-w-[320px]',
        selected && 'border-blue-500 shadow-lg',
        isHighlighted && 'border-yellow-500',
        !selected && !isHighlighted && 'border-gray-200'
      )}
    >
      {/* Table header */}
      <div
        className={cn(
          'px-3 py-2 rounded-t-lg border-b cursor-pointer flex justify-between items-center',
          selected ? 'bg-blue-50' : 'bg-gray-50'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11h16" />
            </svg>
            <span className="font-semibold text-sm truncate">{label}</span>
          </div>
          <div className="text-xs text-gray-500 truncate mt-0.5" title={namespace}>
            {displayNamespace}
          </div>
        </div>
        <button
          className="ml-2 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Column list */}
      {expanded && (
        <div className="py-1">
          {columns.length > 0 ? (
            columns.map((col, index) => (
              <ColumnRow
                key={col.id}
                column={col}
                index={index}
                isSelected={selectedColumnId === col.id}
                onClick={() => onColumnClick?.(col.id)}
                onDoubleClick={() => onColumnDoubleClick?.(col.id)}
              />
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-400 italic">No columns</div>
          )}
        </div>
      )}

      {/* Collapsed summary */}
      {!expanded && columns.length > 0 && (
        <div className="px-3 py-1.5 text-xs text-gray-500">
          {columns.length} column{columns.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
});

TableNode.displayName = 'TableNode';

export default TableNode;
