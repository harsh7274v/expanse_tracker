import { LoginForm } from "../components/login-form"

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-200">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  )
}
