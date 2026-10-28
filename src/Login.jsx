
import { useState } from "react";
import "./Login.css";

const getSavedUsers = () => {
  try {
    const users = JSON.parse(localStorage.getItem("libraryUsers") || "[]");
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
};

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const users = getSavedUsers();
  const setupRequired = !users.some(
    (user) => user.username && user.password
  );

  const handleLogin = (event) => {
    event.preventDefault();
    setMessage("");

    const savedUsers = getSavedUsers();

    const matchedUser = savedUsers.find(
      (user) =>
        user.username?.toLowerCase() ===
          username.trim().toLowerCase() &&
        user.password === password
    );

    if (!matchedUser) {
      setMessage("Incorrect username or password.");
      return;
    }

    const sessionUser = {
      id: matchedUser.id,
      name: matchedUser.name,
      username: matchedUser.username,
      role: matchedUser.role,
    };

    localStorage.setItem(
      "loggedInUser",
      JSON.stringify(sessionUser)
    );

    onLogin(matchedUser);
  };

  const handleSetup = (event) => {
    event.preventDefault();
    setMessage("");

    const savedUsers = getSavedUsers();

    const hasExistingCredentials = savedUsers.some(
      (user) => user.username && user.password
    );

    if (hasExistingCredentials) {
      setMessage(
        "A login account already exists. Please sign in instead."
      );
      return;
    }

    const cleanName = name.trim();
    const cleanMembershipId = membershipId.trim();
    const cleanUsername = username.trim();

    if (
      !cleanName ||
      !cleanMembershipId ||
      !cleanUsername ||
      !password
    ) {
      setMessage("Please complete every field.");
      return;
    }

    if (password.length < 6) {
      setMessage(
        "Please use a password with at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    if (
      savedUsers.some(
        (user) =>
          String(user.membershipId ?? "").toLowerCase() ===
          cleanMembershipId.toLowerCase()
      )
    ) {
      setMessage(
        "That membership ID is already used. Please choose a different ID."
      );
      return;
    }

    const newAdmin = {
      id: makeId(),
      name: cleanName,
      membershipId: cleanMembershipId,
      username: cleanUsername,
      password,
      role: "Admin",
    };

    localStorage.setItem(
      "libraryUsers",
      JSON.stringify([...savedUsers, newAdmin])
    );

    const sessionUser = {
      id: newAdmin.id,
      name: newAdmin.name,
      username: newAdmin.username,
      role: newAdmin.role,
    };

    localStorage.setItem(
      "loggedInUser",
      JSON.stringify(sessionUser)
    );

    onLogin(newAdmin);
  };

  return (
    <div className="login-page">
      <form
        className="login-card"
        onSubmit={setupRequired ? handleSetup : handleLogin}
      >
        <div className="login-icon">📚</div>

        <h1>Community Library</h1>

        <p>
          {setupRequired
            ? "Create the first administrator account to get started."
            : "Sign in to manage your library."}
        </p>

        {message && (
          <div className="login-message" role="alert">
            {message}
          </div>
        )}

        {setupRequired && (
          <>
            <label htmlFor="admin-name">
              Administrator's Full Name
            </label>

            <input
              id="admin-name"
              type="text"
              autoComplete="name"
              placeholder="Enter full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />

            <label htmlFor="admin-membership">
              Administrator Membership ID
            </label>

            <input
              id="admin-membership"
              type="text"
              placeholder="Create or enter a membership ID"
              value={membershipId}
              onChange={(event) =>
                setMembershipId(event.target.value)
              }
              required
            />
          </>
        )}

        <label htmlFor="username">Username</label>

        <input
          id="username"
          type="text"
          autoComplete="username"
          placeholder={
            setupRequired
              ? "Create a username"
              : "Enter your username"
          }
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>

        <input
          id="password"
          type="password"
          autoComplete={
            setupRequired ? "new-password" : "current-password"
          }
          placeholder={
            setupRequired
              ? "Create a password (at least 6 characters)"
              : "Enter your password"
          }
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={setupRequired ? 6 : undefined}
          required
        />

        {setupRequired && (
          <>
            <label htmlFor="confirm-password">
              Confirm Password
            </label>

            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter the password again"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              minLength={6}
              required
            />
          </>
        )}

        <button className="login-button" type="submit">
          {setupRequired
            ? "Create Administrator Account"
            : "Log In"}
        </button>

        <small>
          {setupRequired
            ? "Your existing library records will be kept."
            : "Community Library Management System"}
        </small>
      </form>
    </div>
  );
}

export default Login;
