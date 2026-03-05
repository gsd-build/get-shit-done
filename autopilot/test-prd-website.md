# Task Tracker Website

## Overview

Build a simple task tracker web application with a frontend UI, a REST API backend, and in-memory data persistence. This is a lightweight productivity tool for a single user to manage their daily tasks.

## What It Does

Users can create, view, update, and delete tasks through a clean web interface. Each task has a title, description, status (todo/in-progress/done), and priority (low/medium/high). The API serves as the backend, and all data is stored in memory (no database required).

## Frontend

- Single-page application with a clean, minimal UI
- Task list view showing all tasks grouped by status
- Form to create new tasks (title, description, priority)
- Ability to edit task details inline
- Drag or click to move tasks between status columns (kanban-style)
- Filter tasks by priority
- Responsive layout that works on desktop and mobile

## API

- RESTful endpoints:
  - `GET /api/tasks` — list all tasks (supports query params for filtering)
  - `POST /api/tasks` — create a new task
  - `GET /api/tasks/:id` — get a single task
  - `PUT /api/tasks/:id` — update a task
  - `DELETE /api/tasks/:id` — delete a task
- JSON request/response format
- Basic input validation
- Proper HTTP status codes and error responses

## Data Model

Each task:
- `id` — unique identifier (auto-generated)
- `title` — string, required, max 200 chars
- `description` — string, optional, max 2000 chars
- `status` — enum: todo, in-progress, done
- `priority` — enum: low, medium, high
- `createdAt` — timestamp
- `updatedAt` — timestamp

## Data Persistence

- All data stored in memory (JavaScript Map or array)
- Data resets when the server restarts (this is intentional — no database needed)
- Seed with 5 example tasks on startup for demo purposes

## Constraints

- Single tech stack: Node.js backend serving both the API and static frontend files
- No external databases or services
- No authentication required (single-user tool)
- Must run with a single `npm start` command
