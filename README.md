# Home Briefing Next

A modern, user-friendly web interface for [LVNL Homebriefing](https://hbs.ixosystem.eu/ixo/login.php) - the Dutch flight plan filing system for general aviation pilots.

## Features

- **Modern UI** - Clean, responsive interface built with Next.js and Tailwind CSS
- **Flight Plan Management** - View active and archived flight plans with detailed status information
- **Flight Plan Filing** - Create and validate new flight plans with comprehensive Field 18 and Field 19 support
- **Templates** - Save, load, and manage flight plan templates for frequently flown routes
- **Message History** - View all AFTN messages (FPL, ACK, REJ, DEP, ARR, etc.) for each flight plan
- **Real-time UTC Clock** - Always visible UTC time for flight planning

## Privacy

This application does **not** store your credentials. Your email and password are sent directly to Homebriefing for authentication. We only temporarily store session cookies in memory to maintain your login state. All session data is automatically cleared after 30 minutes of inactivity.

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- SOAP/XML - Communication with Homebriefing API

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/zainspresso/homebriefing-next.git
cd homebriefing-next

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/               # Authentication endpoints
│   │   └── flight-plans/       # Flight plan endpoints
│   ├── dashboard/              # Main dashboard page
│   ├── login/                  # Login page
│   └── new-flight-plan/        # Flight plan creation page
└── lib/
    └── homebriefing/           # Homebriefing API client
        ├── client.ts           # SOAP client implementation
        ├── session.ts          # Session management
        └── types.ts            # TypeScript types
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/init` | POST | Initialize login session |
| `/api/auth/captcha` | GET | Get captcha image |
| `/api/auth/login` | POST | Submit login credentials |
| `/api/auth/logout` | POST | Logout and clear session |
| `/api/auth/check` | GET | Check authentication status |
| `/api/flight-plans` | GET | List flight plans (active/archive) |
| `/api/flight-plans/[flId]/messages` | GET | Get flight plan messages |
| `/api/flight-plans/validate` | POST | Validate a flight plan |
| `/api/flight-plans/templates` | GET | List templates |
| `/api/flight-plans/templates` | POST | Save template |
| `/api/flight-plans/templates/[tplId]` | GET | Get template details |
| `/api/flight-plans/templates/[tplId]` | DELETE | Delete template |

## Disclaimer

This is an unofficial third-party client for LVNL Homebriefing. It is not affiliated with or endorsed by LVNL. Use at your own risk. Always verify your flight plans through official channels before flying.

## License

MIT
