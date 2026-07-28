# Backend-for-Frontend (BFF)

The BFF layer sits between the Next.js frontend and the domain modules.
All API routes under /src/app/api/ should delegate to BFF handlers here.

## Convention
- Each BFF file corresponds to a frontend-facing API resource.
- BFF handlers call domain module functions, never raw SQL.
- BFF enforces authentication and authorization before calling domain logic.
- BFF is the ONLY layer that the frontend (React Server Components, client components) should call.

## Phase 1 Status
Empty — awaiting Phase 2+ implementation.
