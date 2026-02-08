 #TidalHack2026

> A project developed for TidalHack 2026

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Overview

Describes Presently.ai as an AI-powered presentation practice tool for students, explaining how it helps with rehearsing presentations and building confidence.

## Features

- Upload the presentation/script as a PDF file
- Present using voice recording with allowed retries
- AI evaluates presentation using clear rubric
- Detailed and actionable feedback
- AI audience asks relevant questions in live Q&A session
- Feedback on Q&A session for improvement

## Tech Stack

**Frontend:**
- TypeScript
- Next.js
- TailwindCSS
  

**Additional Tools:**
- Gemini
- Assembly.ai
- MongoDB Atlas
- Eleven Labs

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm or yarn package manager

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/ducphan17/TidalHack2026.git
   cd TidalHack2026
   ```

2. Navigate to the frontend directory
   ```bash
   cd frontend
   ```

3. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

4. Set up environment variables (if applicable)
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Running the Application

1. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. Open your browser and navigate to `http://localhost:3000` (or the port specified)

## 📁 Project Structure

```
TidalHack2026/
├── .vscode/          # VS Code configuration
├── frontend/         # Frontend application
│   ├── src/         # Source files
│   ├── public/      # Static assets
│   └── package.json # Frontend dependencies
├── reference/        # Reference materials and documentation
└── README.md        # Project documentation
```


## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
