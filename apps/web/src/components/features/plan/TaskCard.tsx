'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import clsx from 'clsx';
import type { PlanTask } from '@/types/plan';

interface TaskCardProps {
  task: PlanTask;
  onTaskEdit?: (taskId: string, updates: { title: string; description: string }) => void;
  isSelected?: boolean;
}

/**
 * TaskCard - Displays a plan task with inline editing capability.
 *
 * Normal mode: Shows task name, description, type badge, and file count.
 * Edit mode: Click card to edit title and description inline.
 *
 * Per CONTEXT.md: Only title and description are editable (wave/dependencies stay fixed).
 */
export function TaskCard({ task, onTaskEdit, isSelected }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.name);
  const [editedDescription, setEditedDescription] = useState(task.description);

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Focus title input when entering edit mode
  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [isEditing]);

  // Reset edits when task changes
  useEffect(() => {
    setEditedTitle(task.name);
    setEditedDescription(task.description);
  }, [task.name, task.description]);

  const handleCardClick = useCallback(() => {
    if (!isEditing && onTaskEdit) {
      setIsEditing(true);
    }
  }, [isEditing, onTaskEdit]);

  const handleSave = useCallback(() => {
    if (onTaskEdit) {
      onTaskEdit(task.id, {
        title: editedTitle,
        description: editedDescription,
      });
    }
    setIsEditing(false);
  }, [onTaskEdit, task.id, editedTitle, editedDescription]);

  const handleCancel = useCallback(() => {
    setEditedTitle(task.name);
    setEditedDescription(task.description);
    setIsEditing(false);
  }, [task.name, task.description]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleCancel]
  );

  // Determine badge styling based on task type
  const isCheckpoint = task.type.startsWith('checkpoint:');
  const typeLabel = task.type;

  return (
    <div
      id={`task-${task.id}`}
      data-testid={`task-card-${task.id}`}
      onClick={handleCardClick}
      onKeyDown={!isEditing ? (e) => e.key === 'Enter' && handleCardClick() : undefined}
      tabIndex={isEditing ? -1 : 0}
      role="button"
      aria-label={task.name}
      className={clsx(
        'border rounded-lg p-3 cursor-pointer transition-all',
        'bg-card border-border',
        isEditing && 'shadow-lg ring-2 ring-primary',
        isSelected && !isEditing && 'ring-1 ring-primary/50',
        !isEditing && 'hover:shadow-md'
      )}
    >
      {isEditing ? (
        // Edit mode
        <div className="space-y-3" onKeyDown={handleKeyDown}>
          <div>
            <label htmlFor={`title-${task.id}`} className="sr-only">
              Title
            </label>
            <input
              ref={titleRef}
              id={`title-${task.id}`}
              type="text"
              aria-label="Title"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full px-2 py-1 text-sm font-medium bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`description-${task.id}`} className="sr-only">
              Description
            </label>
            <textarea
              ref={descriptionRef}
              id={`description-${task.id}`}
              aria-label="Description"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={3}
              className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground rounded border border-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        // Display mode
        <>
          <h4 className="font-medium text-foreground">{task.name}</h4>
          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Type badge */}
            <span
              className={clsx(
                'px-2 py-0.5 text-xs rounded',
                isCheckpoint
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              )}
            >
              {typeLabel}
            </span>

            {/* File count badge */}
            {task.files && task.files.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                {task.files.length} files
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
