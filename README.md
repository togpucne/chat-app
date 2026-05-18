# Judo Chat

A full-stack, real-time messaging application engineered with a decoupled architecture using the MERN stack (MongoDB, Express, React, Node.js). The project focuses on robust client-side state management, persistent bidirectional communications, secure authentication sessions, and cloud-hosted media optimization.

---

## Technical Highlights & Architecture

*   **Persistent Real-Time Sync**: Configured with Socket.io to establish persistent, low-latency WebSocket connections for instant message transmission and active user presence tracking.
*   **Performance-Optimized State**: Managed client-side state using Zustand stores, ensuring predictable unidirectional data flows and optimized rendering cycles without the boilerplate of Redux.
*   **Secure Session Persistence**: Implemented cookie-based JSON Web Tokens (JWT) for secure session persistence, coupled with custom Express middleware for routing protection and bcryptjs for server-side password hashing.
*   **Cloud Media Hosting**: Integrated Cloudinary SDK to handle base64 image uploads, offloading storage and processing overhead from the application server.
*   **Dynamic Theme Compiler**: Styled with TailwindCSS and DaisyUI, supporting 30+ persisted theme configurations handled via a central React theme provider and stored locally.
*   **Network Resilience**: Imconfigured connection resilience strategies in Mongoose (using IPv4 resolution) and Express (custom DNS resolution arrays) to address unstable ISP database connections.

---

## Technology Stack

### Backend
*   **Runtime Environment**: Node.js (ES Modules)
*   **Web Framework**: Express 5
*   **Database Engine**: MongoDB & Mongoose ORM
*   **Real-time Communication**: Socket.io
*   **Media Hosting & CDN**: Cloudinary
*   **Security & Encryption**: bcryptjs, jsonwebtoken, cookie-parser

### Frontend
*   **Core Library**: React 19 (Vite)
*   **State Management**: Zustand
*   **Routing**: React Router 7
*   **Styling**: TailwindCSS & DaisyUI
*   **Icons & Toast Notifications**: Lucide React, React Hot Toast
*   **HTTP Client**: Axios

---

## System Directory Tree

```text
judo_chat/
├── backend/                  # REST API & WebSocket Server
│   ├── src/
│   │   ├── controllers/      # Route controllers (Auth, Messages)
│   │   ├── lib/              # Connectors & Utilities (DB, Socket, Cloudinary, JWT)
│   │   ├── middleware/       # Route guards (protectRoute)
│   │   ├── models/           # Mongoose schemas (User, Message)
│   │   ├── routes/           # Express router declarations
│   │   ├── seeds/            # Database initialization scripts
│   │   └── index.js          # App bootstrap file
│   ├── .env                  # Environment configuration keys
│   └── package.json
│
└── frontend/                 # Client Application
    ├── src/
    │   ├── components/       # Reusable components & skeleton loaders
    │   ├── constants/        # Global system variables (Themes, etc.)
    │   ├── lib/              # HTTP Client setups (Axios configurations)
    │   ├── pages/            # Page view controllers
    │   ├── store/            # Zustand global stores (Auth, Chat, Theme)
    │   ├── App.jsx           # Main routing entry point
    │   └── main.jsx          # DOM mounting point
    └── package.json
```

---

## Setup and Installation

### Prerequisites
*   Node.js (v16+)
*   MongoDB Instance (Local database or MongoDB Atlas cloud URI)
*   Cloudinary Account

### 1. Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root of `backend/` and configure:
   ```env
   PORT=5001
   MONGODB_URI=your_mongodb_connection_uri
   JWT_SECRET=your_jwt_signing_secret
   NODE_ENV=development
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
4. Optional: Seed the database with 16 sample user profiles for local testing:
   ```bash
   node src/seeds/user.seed.js
   ```
5. Start server in development mode:
   ```bash
   npm run dev
   ```

### 2. Frontend Configuration
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch Vite dev server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## API Documentation

### Authentication `/api/auth`

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/api/auth/signup` | Creates a new user profile in the database | No |
| **POST** | `/api/auth/login` | Authenticates credentials and issues a cookie-based JWT | No |
| **POST** | `/api/auth/logout` | Revokes cookie token and clears the user session | No |
| **PUT** | `/api/auth/update-profile` | Uploads and updates the user avatar via Cloudinary | Yes |
| **GET** | `/api/auth/check` | Validates current token state on client bootstrapper | Yes |

### Messages `/api/messages`

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **GET** | `/api/messages/users` | Retrieves list of users for sidebar navigation | Yes |
| **GET** | `/api/messages/:id` | Retrieves chat message logs between two specific users | Yes |
| **POST** | `/api/messages/send/:id` | Posts a message (supports text and base64 images) | Yes |

---

## License
This project is licensed under the ISC License.
