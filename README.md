# MZK-LIST - Personal Anime Collection

MZK-LIST is a full-stack web application designed for anime enthusiasts to track, manage, and curate their personal anime collections. 

Unlike basic list trackers, MZK-LIST offers a seamless, beautiful UI, real-time background processing for importing massive anime lists (XML/JSON), and dynamic metadata fetching from public APIs (Jikan/Kitsu) so you never have to manually input synopsis, cover images, or scores.

## ✨ Features

- **Modern UI**: A responsive, dark-themed, sleek user interface built with React.
- **Robust Import System**: Upload your `MyAnimeList` XML export, or JSON/TXT files. The background worker parses the file, safely avoids duplicates, and pulls in the latest metadata.
- **Live Progress Tracking**: Watch your anime import progress in real-time with a live progress bar and activity log right on your dashboard.
- **Smart Add**: Don't have a list? Add anime directly using the integrated search modal that queries Jikan (MyAnimeList) and Kitsu APIs dynamically.
- **Categorization**: Manage your anime in tabs: *Watching*, *Plan to watch*, *Completed*, *On-Hold*, *Dropped*, and custom categories.
- **Advanced Filtering & Sorting**: Filter your list by format (TV, Movie, OVA, etc.), minimum MAL score, and sort by recently updated, highest score, release year, or alphabetically.
- **Personal Ratings**: Click on any anime card to give it a personal rating out of 10.
- **Safe Deletions**: Easy one-click deletion with a secure confirmation modal.

## 🛠️ Tech Stack

- **Frontend**: React (Vite)
- **Backend**: Python / Django REST Framework
- **Database**: Microsoft SQL Server (via `mssql-django`)

---

## 🚀 Getting Started

Follow these instructions to run the project locally on your machine.

### Prerequisites

You will need the following installed on your machine:
- **Python 3.10+**
- **Node.js 16+**
- **Microsoft SQL Server Express** (or any SQL Server instance)
- **ODBC Driver 17 for SQL Server** (required for Python to connect to SQL Server)

### 1. Database Setup

1. Open SQL Server Management Studio (SSMS) or Azure Data Studio.
2. Connect to your local SQL Server instance (usually `localhost\SQLEXPRESS`).
3. Create a new database named `AniemListDb`:
   ```sql
   CREATE DATABASE [AniemListDb];
   ```

### 2. Backend Setup (Django)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```
3. Install the required Python dependencies:
   ```bash
   pip install django djangorestframework django-cors-headers mssql-django pyodbc requests
   ```
4. Run the database migrations to set up your tables:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```
5. Start the backend development server:
   ```bash
   python manage.py runserver
   ```
   *The backend will now be running on `http://localhost:8000`.*

### 3. Frontend Setup (React)

1. Open a **new terminal window** and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the necessary Node modules:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will typically run on `http://localhost:5173`. Open this URL in your browser.*

---

## 📖 How to Use

### 📥 Importing your MyAnimeList
1. Export your anime list from MyAnimeList (it will download as a `.xml.gz` file which you must extract to get the `.xml` file).
2. On the top right of the MZK-LIST dashboard, click **Upload List** and select your `.xml` file.
3. The background processor will start ingesting your anime. You'll see a real-time progress bar at the top of the page. Because it queries the Jikan API for high-quality images and synopses, it pauses slightly between each anime to respect API rate limits.

### 🔍 Adding Single Anime
1. Click the **Add from MAL** button on the top right.
2. Search for any anime title. 
3. Choose the category you want to add it to, and click **Add**. The anime and all of its rich metadata will instantly be added to your database.

### 📝 Managing your List
- Use the **Category Tabs** to switch between different lists.
- Click **Rate this anime** on any card to input your personal score (decimals are supported!).
- Use the **Delete icon (Trash can)** to permanently remove an anime from your database.
- Use the **Search bar** and **Filter dropdowns** to effortlessly find exactly what you're looking for.
