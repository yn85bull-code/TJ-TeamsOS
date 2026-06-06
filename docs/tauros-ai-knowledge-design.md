# TaurosAI / Knowledge Base Foundation

## Purpose

TaurosAI is the employee-facing AI assistant inside TeamOS.

It is separate from AI Suggestions:

- AI Suggestions: AI proposes work items, replies, tasks, or approval candidates to humans.
- TaurosAI: humans ask questions about internal manuals, rules, FAQ, and business procedures.

## Current Foundation Scope

This phase intentionally builds the base only:

- TaurosAI menu and page key: `tauros_ai`
- Route entry: `/tauros-ai`
- Chat UI with initial message, FAQ buttons, question input, mock answers, references
- Left category and recent question area
- Right reference source and related knowledge area
- Admin/Owner-only knowledge management tab
- Knowledge list and draft registration form
- File upload UI placeholder
- Role permission flags in code
- Supabase SQL foundation for knowledge tables and RLS

The following are not fully implemented yet:

- Real AI model calls
- RAG/vector search
- PDF/Excel/Word text extraction
- Persistent UI CRUD for knowledge
- Persistent chat log writes from the UI
- FAQ candidate approval workflow

## Permission Model

TaurosAI itself is visible to all roles:

- Owner
- Admin
- Manager
- Member

Knowledge management is visible only to Owner/Admin.

Initial permission flags:

- `can_access_tauros_ai`
- `can_manage_tauros_ai_knowledge`
- `can_view_knowledge`
- `can_create_knowledge`
- `can_edit_knowledge`
- `can_delete_knowledge`
- `can_view_knowledge_chat_logs`
- `can_manage_knowledge_visibility`

## Core Rule

If a user cannot view information in TeamOS, TaurosAI must not answer with that information.

This applies especially to:

- Tasks and progress
- Approvals
- Personal work state
- Store or department KPI
- HR information
- Accounting, billing, and payment information
- Hiring candidate information
- Claims, accidents, and trouble records
- Executive materials
- Management documents

## Supabase SQL

Run this SQL after the main schema and role alignment SQL:

```text
supabase/add_tauros_ai_knowledge_20260606.sql
```

It creates:

- `knowledge_items`
- `knowledge_files`
- `knowledge_chat_logs`
- `knowledge_faq_candidates`
- `tauros-ai-knowledge` storage bucket
- RLS policies for role and department based access

## Implementation Roadmap

### Phase 1

- Page and UI foundation
- Text knowledge registration
- File upload plumbing
- Role-based visibility
- Basic Supabase persistence

### Phase 2

- Search registered knowledge
- Chat answer generation with references
- Save chat logs
- Block unauthorized answers

### Phase 3

- File text extraction
- Vector search / RAG
- FAQ candidate generation
- Owner/Admin approval for formal knowledge
