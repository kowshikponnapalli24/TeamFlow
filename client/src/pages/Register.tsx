import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      await register(name, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="brand">
          <div className="brand-mark">T</div>
          <span>TeamFlow</span>
        </div>

        <div className="brand-message">
          <span className="eyebrow">YOUR WORKSPACE STARTS HERE</span>
          <h1>Bring your people and projects together.</h1>
          <p>
            Create your account and start organizing work with clarity and
            confidence.
          </p>
        </div>

        <p className="brand-footer">Your team's work, connected.</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-container">
          <div className="mobile-brand brand">
            <div className="brand-mark">T</div>
            <span>TeamFlow</span>
          </div>

          <span className="eyebrow">GET STARTED</span>
          <h2>Create your account</h2>
          <p className="auth-subtitle">
            Enter your details to create your TeamFlow account.
          </p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="name">Full name</label>
            <div className="input-wrapper">
              <UserRound size={18} />
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <label htmlFor="email">Email address</label>
            <div className="input-wrapper">
              <Mail size={18} />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <LockKeyhole size={18} />
              <input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <button className="primary-button auth-submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}