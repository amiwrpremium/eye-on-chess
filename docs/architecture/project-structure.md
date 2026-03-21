# Project Structure

```
eye-on-chess/
├── apps/
│   ├── api/                      # Fastify backend
│   │   ├── Dockerfile            # Development Dockerfile
│   │   ├── Dockerfile.prod       # Production multi-stage Dockerfile
│   │   ├── Dockerfile.worker     # Stockfish analysis worker
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema
│   │   │   ├── seed.ts           # Seed script (admin user + site settings)
│   │   │   └── migrations/       # Prisma migrations
│   │   └── src/
│   │       ├── server.ts         # Fastify entry point
│   │       ├── worker.ts         # Analysis worker entry point
│   │       ├── lib/
│   │       │   ├── prisma.ts     # Prisma client instance
│   │       │   ├── redis.ts      # Redis client + presence helpers
│   │       │   ├── jwt.ts        # JWT sign/verify, refresh token utils
│   │       │   ├── socket.ts     # Socket.io setup + auth
│   │       │   ├── settings.ts   # Site settings (DB with env fallback)
│   │       │   ├── elo.ts        # Elo rating calculation
│   │       │   ├── gameClock.ts  # Redis-based game clock management
│   │       │   ├── gameSocket.ts # Socket.io game event handlers
│   │       │   ├── stockfish.ts  # Stockfish UCI engine wrapper
│   │       │   ├── classify.ts   # Move classification logic
│   │       │   └── eco.ts        # ECO opening code lookup
│   │       ├── middleware/
│   │       │   ├── auth.ts       # JWT auth middleware
│   │       │   └── admin.ts      # Admin role check, CSRF, rate limit, audit
│   │       └── routes/
│   │           ├── auth.ts       # /api/auth/* (register, login, refresh, logout, me, preferences)
│   │           ├── users.ts      # /api/users/* (profiles, search)
│   │           ├── friends.ts    # /api/friends/* (friend system)
│   │           ├── games.ts      # /api/games/* (create, challenge, accept/decline)
│   │           ├── analysis.ts   # /api/games/:id/analyze, /analysis
│   │           └── admin.ts      # /api/admin/* (dashboard, users, games, settings, audit)
│   │
│   └── web/                      # Next.js frontend
│       ├── Dockerfile            # Development Dockerfile
│       ├── Dockerfile.prod       # Production multi-stage Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       └── src/
│           ├── middleware.ts      # Next.js route protection
│           ├── lib/
│           │   ├── api.ts        # Axios instance + auto-refresh interceptor
│           │   ├── adminApi.ts   # Admin API helper (CSRF token management)
│           │   └── socket.ts     # Socket.io client + heartbeat
│           ├── stores/
│           │   ├── auth.ts       # Auth state (user, tokens, login/logout)
│           │   └── settings.ts   # User preferences (theme, board, pieces)
│           ├── components/
│           │   ├── ChessBoard.tsx      # Chessground wrapper
│           │   ├── EvaluationBar.tsx   # Vertical eval bar
│           │   ├── EvalGraph.tsx       # SVG evaluation graph
│           │   ├── MoveList.tsx        # Move notation list
│           │   ├── PlayerClock.tsx     # Optimistic countdown clock
│           │   ├── ChallengePopup.tsx  # Incoming challenge modal
│           │   ├── AdminLayout.tsx     # Admin sidebar layout
│           │   ├── ThemeProvider.tsx    # Dark/light mode
│           │   ├── BoardThemeStyles.tsx # Board color themes
│           │   ├── Skeleton.tsx        # Loading skeletons
│           │   ├── ErrorBoundary.tsx   # Error boundary
│           │   ├── Toast.tsx           # Toast notifications
│           │   └── ConfirmModal.tsx    # Confirmation dialog
│           └── app/
│               ├── layout.tsx          # Root layout (theme, error boundary)
│               ├── globals.css         # Tailwind + light mode overrides
│               ├── page.tsx            # Homepage (/ → login/register or /play)
│               ├── login/page.tsx
│               ├── register/page.tsx
│               ├── play/
│               │   ├── page.tsx        # Play hub
│               │   └── friend/page.tsx # Challenge a friend
│               ├── game/
│               │   └── [id]/
│               │       ├── page.tsx          # Live game
│               │       └── analysis/page.tsx # Post-game analysis
│               ├── profile/[username]/page.tsx
│               ├── friends/page.tsx
│               ├── settings/page.tsx
│               ├── board-test/page.tsx  # Component demo
│               └── admin/
│                   ├── layout.tsx       # Admin layout wrapper
│                   ├── page.tsx         # Dashboard
│                   ├── users/page.tsx
│                   ├── games/page.tsx
│                   ├── settings/page.tsx
│                   └── audit-log/page.tsx
│
├── packages/
│   └── chess/                    # Shared TypeScript types
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts          # Color, PieceType, Piece types
│
├── deployment/
│   ├── docker-compose.yml        # Production compose
│   ├── docker-compose.dev.yml    # Development compose
│   └── nginx.conf                # Nginx reverse proxy config
│
├── scripts/
│   └── backup.sh                 # PostgreSQL backup script
│
├── .github/
│   ├── CONTRIBUTING.md
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── docs/                         # Documentation (you are here)
├── Makefile                      # Build/run commands
├── package.json                  # Root monorepo config
├── pnpm-workspace.yaml           # pnpm workspace definition
├── turbo.json                    # Turborepo pipeline config
├── .env.example                  # Environment variable template
├── .gitignore
├── LICENSE                       # MIT
├── README.md
└── PROGRESS.md                   # Development progress tracker
```
