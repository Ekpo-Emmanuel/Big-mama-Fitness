import { LoginForm } from "@/components/login-form";
export const metadata = {
  title: "Organizer sign in",
  robots: { index: false, follow: false },
};
export default function Login() {
  return (
    <main id="main">
      <LoginForm />
    </main>
  );
}
