# Expanse Tracker

Expanse Tracker is a modern, full-featured expense tracking Progressive Web App (PWA) built with Next.js, React, Firebase, and Tailwind CSS. It allows users to manage expenses and income, visualize spending trends, and securely store data in the cloud.

## Features

- **User Authentication**: Sign up and log in with email/password or Google.
- **Expense & Income Tracking**: Add, edit, and delete transactions with categories, notes, and recurring options.
- **Custom Categories**: Create your own categories in addition to built-in ones.
- **Data Visualization**: Interactive charts (bar, pie, line) for monthly and weekly trends.
- **Transaction History**: Filter, search, sort, and paginate all your transactions.
- **Automatic Archiving**: Transactions are archived monthly for performance and historical access.
- **Profile Management**: Change username, password, and re-authenticate as needed.
- **Responsive UI**: Works great on desktop and mobile.
- **PWA Support**: Installable, offline-ready, and fast.
- **Secure Cloud Storage**: All data is stored in Firebase Firestore with strict security rules.

## Demo

![Expanse Tracker Screenshot](public/icon-512x512.png)  
*Track your expenses with ease!*

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/expanse_tracker.git
cd expanse_tracker
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Configure Firebase

Create a `.env.local` file in the root directory and add your Firebase project credentials:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

> **Note:** You can find these values in your Firebase project settings.

### 4. Run the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

- `src/app/` – Next.js app directory (pages, layouts, routes)
- `src/components/` – Reusable UI and logic components
- `src/lib/` – Firebase and utility functions
- `public/` – Static assets, icons, manifest, service worker
- `storage.rules` – Firebase Storage security rules

---

## Scripts

- `npm run dev` – Start the development server
- `npm run build` – Build for production
- `npm start` – Start the production server
- `npm run lint` – Run ESLint

---

## Technologies Used

- [Next.js](https://nextjs.org/) (App Router, PWA)
- [React](https://react.dev/)
- [Firebase](https://firebase.google.com/) (Auth, Firestore, Storage)
- [Tailwind CSS](https://tailwindcss.com/) & [tw-animate-css](https://github.com/stevenjoezhang/tw-animate-css)
- [Chart.js](https://www.chartjs.org/) & [react-chartjs-2](https://react-chartjs-2.js.org/)
- [Lucide Icons](https://lucide.dev/)
- [SWR](https://swr.vercel.app/) (data fetching)
- [TypeScript](https://www.typescriptlang.org/)

---

## Firebase Setup

1. **Firestore**: Enable Firestore in your Firebase project.
2. **Authentication**: Enable Email/Password and Google sign-in methods.
3. **Storage**: (Optional, for profile photos)  
   Use the provided `storage.rules` for secure access:
   ```js
   service firebase.storage {
     match /b/{bucket}/o {
       match /profile_photos/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /{allPaths=**} {
         allow read, write: if false;
       }
     }
   }
   ```

---

## PWA

- The app is installable and works offline.
- Manifest and service worker are configured via `next-pwa`.
- Customize `public/manifest.json` and icons as needed.

---

## Customization

- **Styling**: Tailwind CSS is used for all styling. Edit `src/app/globals.css` and Tailwind config as needed.
- **Categories**: You can add custom categories in the UI.
- **Charts**: Uses Chart.js for visualizations.

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License

[MIT](LICENSE) (add a LICENSE file if you haven't already)

---

## Acknowledgements

- [Next.js](https://nextjs.org/)
- [Firebase](https://firebase.google.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/)
- [Lucide Icons](https://lucide.dev/)

---

**Happy tracking!**
