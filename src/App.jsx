
import { useEffect, useMemo, useState } from "react";
import API_URL from "./api";
import "./App.css";

const STORAGE_KEYS = {
  users: "libraryUsers",
  transactions: "libraryTransactions",
  borrowings: "libraryBorrowings",
  loggedInUser: "loggedInUser",
};

const initialUser = {
  id: "admin",
  name: "Library Administrator",
  username: "admin",
  password: "admin123",
  role: "Admin",
};

const readData = (key, fallback = []) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getId = (item) => String(item?.id ?? item?._id ?? "");

function EmptyRow({ columns, message = "No records found." }) {
  return (
    <tr>
      <td colSpan={columns} className="empty-row">
        {message}
      </td>
    </tr>
  );
}

function TransactionTable({ transactions }) {
  if (!transactions.length) {
    return <p className="empty-message">No transactions recorded yet.</p>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Book</th>
            <th>User</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((item) => (
            <tr key={item.id}>
              <td>{item.date}</td>
              <td>{item.type}</td>
              <td>{item.bookTitle}</td>
              <td>{item.userName || "—"}</td>
              <td>{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState(() =>
    readData(STORAGE_KEYS.users, [initialUser])
  );
  const [transactions, setTransactions] = useState(() =>
    readData(STORAGE_KEYS.transactions, [])
  );
  const [borrowings, setBorrowings] = useState(() =>
    readData(STORAGE_KEYS.borrowings, [])
  );
  const [loggedInUser, setLoggedInUser] = useState(() =>
    readData(STORAGE_KEYS.loggedInUser, null)
  );

  const [page, setPage] = useState("Dashboard");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [search, setSearch] = useState("");

  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    genre: "",
    isbn: "",
    quantity: 1,
  });
  const [editingBookId, setEditingBookId] = useState(null);

  const [stockBookId, setStockBookId] = useState("");
  const [stockQuantity, setStockQuantity] = useState(1);

  const [borrowForm, setBorrowForm] = useState({
    bookId: "",
    userId: "",
    quantity: 1,
  });

  const [returnForm, setReturnForm] = useState({
    borrowingId: "",
    quantity: 1,
  });

  const [userForm, setUserForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "Member",
  });
  const [editingUserId, setEditingUserId] = useState(null);

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const navigation = [
    { name: "Dashboard", icon: "▦" },
    { name: "Books", icon: "▤" },
    { name: "Borrow & Return", icon: "↔" },
    { name: "Stock Management", icon: "＋" },
    { name: "Transactions", icon: "☷" },
    { name: "Users", icon: "♙" },
  ];

  // Save local records when they change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.transactions,
      JSON.stringify(transactions)
    );
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.borrowings,
      JSON.stringify(borrowings)
    );
  }, [borrowings]);

  useEffect(() => {
    if (loggedInUser) {
      localStorage.setItem(
        STORAGE_KEYS.loggedInUser,
        JSON.stringify(loggedInUser)
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.loggedInUser);
    }
  }, [loggedInUser]);

  // Load books from the backend database.
  async function loadBooks() {
    setLoadingBooks(true);

    try {
      const response = await fetch(`${API_URL}/books`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load books.");
      }

      setBooks(Array.isArray(data) ? data : data.books || []);
    } catch (error) {
      setNotice(
        `Could not load books from the database: ${error.message}`
      );
      setNoticeType("error");
    } finally {
      setLoadingBooks(false);
    }
  }

  useEffect(() => {
    loadBooks();
  }, []);

  function showNotice(message, type = "success") {
    setNotice(message);
    setNoticeType(type);
  }

  function clearNotice() {
    setNotice("");
  }

  function availableCopies(book) {
    const borrowed = borrowings
      .filter(
        (item) =>
          String(item.bookId) === getId(book) &&
          item.status === "Borrowed"
      )
      .reduce((total, item) => total + Number(item.quantity || 0), 0);

    return Math.max(0, Number(book.quantity || 0) - borrowed);
  }

  function borrowedCopies(book) {
    return borrowings
      .filter(
        (item) =>
          String(item.bookId) === getId(book) &&
          item.status === "Borrowed"
      )
      .reduce((total, item) => total + Number(item.quantity || 0), 0);
  }

  function addTransaction(type, book, userName, quantity) {
    const transaction = {
      id: makeId(),
      date: new Date().toLocaleString(),
      type,
      bookTitle: book.title,
      bookId: getId(book),
      userName: userName || "—",
      quantity: Number(quantity),
    };

    setTransactions((current) => [transaction, ...current]);
  }

  function resetBookForm() {
    setBookForm({
      title: "",
      author: "",
      genre: "",
      isbn: "",
      quantity: 1,
    });
    setEditingBookId(null);
  }

  async function saveBook(event) {
    event.preventDefault();

    const title = bookForm.title.trim();
    const author = bookForm.author.trim();
    const genre = bookForm.genre.trim();
    const isbn = bookForm.isbn.trim();
    const quantity = Number(bookForm.quantity);

    if (!title || !author || !isbn) {
      showNotice("Please enter the title, author and ISBN.", "error");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      showNotice("Quantity must be a whole number of zero or more.", "error");
      return;
    }

    const duplicate = books.some(
      (book) =>
        String(book.isbn).toLowerCase() === isbn.toLowerCase() &&
        getId(book) !== String(editingBookId)
    );

    if (duplicate) {
      showNotice("A book with that ISBN already exists.", "error");
      return;
    }

    if (editingBookId !== null) {
      const oldBook = books.find(
        (book) => getId(book) === String(editingBookId)
      );

      if (oldBook && quantity < borrowedCopies(oldBook)) {
        showNotice(
          "Quantity cannot be lower than the number of copies currently borrowed.",
          "error"
        );
        return;
      }
    }

    const payload = { title, author, genre, isbn, quantity };

    try {
      const editing = editingBookId !== null;
      const url = editing
        ? `${API_URL}/books/${editingBookId}`
        : `${API_URL}/books`;

      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save the book.");
      }

      await loadBooks();
      resetBookForm();
      showNotice(editing ? "Book updated successfully." : "Book added successfully.");
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  function startBookEdit(book) {
    setBookForm({
      title: book.title || "",
      author: book.author || "",
      genre: book.genre || "",
      isbn: book.isbn || "",
      quantity: Number(book.quantity || 0),
    });

    setEditingBookId(getId(book));
    setPage("Books");
    clearNotice();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteBook(book) {
    if (
      !window.confirm(
        `Are you sure you want to delete "${book.title}"?`
      )
    ) {
      return;
    }

    if (borrowedCopies(book) > 0) {
      showNotice(
        "This book cannot be deleted while copies are borrowed.",
        "error"
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/books/${getId(book)}`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete the book.");
      }

      await loadBooks();
      showNotice("Book deleted successfully.");
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  function addStock(event) {
    event.preventDefault();

    const book = books.find(
      (item) => getId(item) === String(stockBookId)
    );
    const quantity = Number(stockQuantity);

    if (!book) {
      showNotice("Please select a book.", "error");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      showNotice("Enter a quantity greater than zero.", "error");
      return;
    }

    // Stock additions must be saved to MySQL through the book update API.
    updateStockInDatabase(book, quantity);
  }

  async function updateStockInDatabase(book, addedQuantity) {
    try {
      const response = await fetch(
        `${API_URL}/books/${getId(book)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: book.title,
            author: book.author,
            genre: book.genre || "",
            isbn: book.isbn,
            quantity: Number(book.quantity || 0) + addedQuantity,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update stock.");
      }

      addTransaction("Stock Added", book, loggedInUser?.name, addedQuantity);
      setStockQuantity(1);
      await loadBooks();
      showNotice("Stock added successfully.");
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  function borrowBook(event) {
    event.preventDefault();

    const book = books.find(
      (item) => getId(item) === String(borrowForm.bookId)
    );
    const user = users.find(
      (item) => getId(item) === String(borrowForm.userId)
    );
    const quantity = Number(borrowForm.quantity);

    if (!book || !user) {
      showNotice("Please select a book and a user.", "error");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      showNotice("Quantity must be a whole number greater than zero.", "error");
      return;
    }

    if (quantity > availableCopies(book)) {
      showNotice(
        `Only ${availableCopies(book)} copies are available.`,
        "error"
      );
      return;
    }

    const borrowing = {
      id: makeId(),
      bookId: getId(book),
      bookTitle: book.title,
      userId: getId(user),
      userName: user.name,
      quantity,
      date: new Date().toLocaleString(),
      status: "Borrowed",
    };

    setBorrowings((current) => [borrowing, ...current]);
    addTransaction("Borrow", book, user.name, quantity);

    setBorrowForm({ bookId: "", userId: "", quantity: 1 });
    showNotice("Book borrowed successfully.");
  }

  function returnBook(event) {
    event.preventDefault();

    const borrowing = borrowings.find(
      (item) =>
        item.id === returnForm.borrowingId &&
        item.status === "Borrowed"
    );

    const quantity = Number(returnForm.quantity);

    if (!borrowing) {
      showNotice("Please select an active borrowing record.", "error");
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > Number(borrowing.quantity)
    ) {
      showNotice(
        `Enter a whole number between 1 and ${borrowing.quantity}.`,
        "error"
      );
      return;
    }

    const book = books.find(
      (item) => getId(item) === String(borrowing.bookId)
    );

    if (!book) {
      showNotice("The book could not be found.", "error");
      return;
    }

    setBorrowings((current) =>
      current.flatMap((item) => {
        if (item.id !== borrowing.id) return [item];

        const remaining = Number(item.quantity) - quantity;

        if (remaining === 0) {
          return [{ ...item, quantity: 0, status: "Returned" }];
        }

        return [
          {
            ...item,
            quantity: remaining,
          },
        ];
      })
    );

    addTransaction("Return", book, borrowing.userName, quantity);
    setReturnForm({ borrowingId: "", quantity: 1 });
    showNotice("Book returned successfully.");
  }

  function saveUser(event) {
    event.preventDefault();

    const name = userForm.name.trim();
    const username = userForm.username.trim();
    const password = userForm.password;

    if (!name || !username) {
      showNotice("Please enter a name and username.", "error");
      return;
    }

    if (editingUserId === null && !password) {
      showNotice("Please enter a password for the new user.", "error");
      return;
    }

    const duplicate = users.some(
      (user) =>
        user.username.toLowerCase() === username.toLowerCase() &&
        getId(user) !== String(editingUserId)
    );

    if (duplicate) {
      showNotice("That username is already in use.", "error");
      return;
    }

    if (editingUserId !== null) {
      const existing = users.find(
        (user) => getId(user) === String(editingUserId)
      );

      if (!existing) return;

      const updatedUser = {
        ...existing,
        name,
        username,
        role: userForm.role,
        ...(password ? { password } : {}),
      };

      setUsers((current) =>
        current.map((user) =>
          getId(user) === String(editingUserId) ? updatedUser : user
        )
      );

      if (getId(loggedInUser) === String(editingUserId)) {
        setLoggedInUser(updatedUser);
      }

      showNotice("User updated successfully.");
    } else {
      const newUser = {
        id: makeId(),
        name,
        username,
        password,
        role: userForm.role,
      };

      setUsers((current) => [...current, newUser]);
      showNotice("User added successfully.");
    }

    resetUserForm();
  }

  function editUser(user) {
    setUserForm({
      name: user.name || "",
      username: user.username || "",
      password: "",
      role: user.role || "Member",
    });

    setEditingUserId(getId(user));
    clearNotice();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetUserForm() {
    setUserForm({
      name: "",
      username: "",
      password: "",
      role: "Member",
    });
    setEditingUserId(null);
  }

  function deleteUser(user) {
    if (getId(user) === getId(loggedInUser)) {
      showNotice("You cannot delete the account you are currently using.", "error");
      return;
    }

    if (user.username === "admin") {
      showNotice("The default administrator account cannot be deleted.", "error");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete the user "${user.name}"?`
      )
    ) {
      return;
    }

    setUsers((current) =>
      current.filter((item) => getId(item) !== getId(user))
    );

    showNotice("User deleted successfully.");
  }

  function login(event) {
    event.preventDefault();

    const username = loginForm.username.trim().toLowerCase();
    const user = users.find(
      (item) =>
        item.username.toLowerCase() === username &&
        item.password === loginForm.password
    );

    if (!user) {
      showNotice("Incorrect username or password.", "error");
      return;
    }

    setLoggedInUser(user);
    setPage("Dashboard");
    setLoginForm({ username: "", password: "" });
    clearNotice();
  }

  function logout() {
    if (!window.confirm("Are you sure you want to log out?")) return;

    setLoggedInUser(null);
    setPage("Dashboard");
    clearNotice();
  }

  const filteredBooks = useMemo(() => {
    const term = search.toLowerCase().trim();

    return books.filter((book) =>
      [book.title, book.author, book.genre, book.isbn]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [books, search]);

  const totalCopies = books.reduce(
    (total, book) => total + Number(book.quantity || 0),
    0
  );

  const totalAvailable = books.reduce(
    (total, book) => total + availableCopies(book),
    0
  );

  const lowStockBooks = books.filter(
    (book) => availableCopies(book) < 2
  );

  const activeBorrowings = borrowings.filter(
    (item) => item.status === "Borrowed"
  );

  const recentTransactions = transactions.slice(0, 5);

  if (!loggedInUser) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand-logo" style={{ margin: "0 auto 16px" }}>
            BL
          </div>

          <h1>Blue Library</h1>
          <p>Library Management System</p>

          {notice && (
            <div className={`alert ${noticeType === "error" ? "alert-error" : "alert-success"}`}>
              {notice}
            </div>
          )}

          <form onSubmit={login}>
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, username: event.target.value })
                }
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, password: event.target.value })
                }
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit">Log In</button>
          </form>

          <p style={{ marginTop: 18, fontSize: 12 }}>
            Default login: admin / admin123
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">BL</div>
          <div>
            <h2>Blue Library</h2>
            <span>Management System</span>
          </div>
        </div>

        <div className="sidebar-label">MAIN MENU</div>

        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={page === item.name ? "nav-link active" : "nav-link"}
              onClick={() => {
                setPage(item.name);
                clearNotice();
                setSearch("");
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p style={{ color: "#d6e2f2", fontSize: 12 }}>
            Signed in as
          </p>
          <strong>{loggedInUser.name}</strong>
          <p style={{ color: "#c5d6ed", fontSize: 12 }}>
            {loggedInUser.role}
          </p>
          <button className="nav-link" onClick={logout}>
            <span className="nav-icon">↪</span>
            Log Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>
              {page === "Dashboard"
                ? "Dashboard"
                : page}
            </h1>
            <p>
              Welcome back, {loggedInUser.name}. Here's your library overview.
            </p>
          </div>

          <div className="account-info">
            <strong>{loggedInUser.role}</strong>
          </div>
        </header>

        {notice && (
          <div className={`alert ${noticeType === "error" ? "alert-error" : "alert-success"}`}>
            {notice}
          </div>
        )}

        {page === "Dashboard" && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">▤</div>
                <p>Total Book Titles</p>
                <h2>{books.length}</h2>
                <p>Different books in the library</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon">▣</div>
                <p>Total Copies</p>
                <h2>{totalCopies}</h2>
                <p>Copies registered in the database</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon">↔</div>
                <p>Available Copies</p>
                <h2>{totalAvailable}</h2>
                <p>Copies currently available to borrow</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon">!</div>
                <p>Low Stock Titles</p>
                <h2>{lowStockBooks.length}</h2>
                <p>Books with fewer than two available copies</p>
              </div>
            </div>

            <section className="panel">
              <div className="section-header">
                <h2>Book Availability</h2>
                <button
                  className="secondary-button"
                  onClick={() => setPage("Books")}
                >
                  View All Books
                </button>
              </div>

              {loadingBooks ? (
                <p>Loading books...</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Genre</th>
                        <th>Total Copies</th>
                        <th>Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {books.slice(0, 6).map((book) => (
                        <tr key={getId(book)}>
                          <td>{book.title}</td>
                          <td>{book.author}</td>
                          <td>{book.genre || "—"}</td>
                          <td>{book.quantity}</td>
                          <td>{availableCopies(book)}</td>
                        </tr>
                      ))}

                      {!books.length && (
                        <EmptyRow columns={5} message="No books have been added yet." />
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel">
              <h2>Recent Transactions</h2>
              <TransactionTable transactions={recentTransactions} />
            </section>
          </>
        )}

        {page === "Books" && (
          <>
            <section className="panel">
              <h2>{editingBookId !== null ? "Edit Book" : "Add New Book"}</h2>

              <form onSubmit={saveBook}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="book-title">Book Title *</label>
                    <input
                      id="book-title"
                      value={bookForm.title}
                      onChange={(event) =>
                        setBookForm({ ...bookForm, title: event.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="book-author">Author *</label>
                    <input
                      id="book-author"
                      value={bookForm.author}
                      onChange={(event) =>
                        setBookForm({ ...bookForm, author: event.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="book-genre">Genre</label>
                    <input
                      id="book-genre"
                      value={bookForm.genre}
                      onChange={(event) =>
                        setBookForm({ ...bookForm, genre: event.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="book-isbn">ISBN *</label>
                    <input
                      id="book-isbn"
                      value={bookForm.isbn}
                      onChange={(event) =>
                        setBookForm({ ...bookForm, isbn: event.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="book-quantity">Initial Total Copies</label>
                    <input
                      id="book-quantity"
                      type="number"
                      min="0"
                      step="1"
                      value={bookForm.quantity}
                      onChange={(event) =>
                        setBookForm({ ...bookForm, quantity: event.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit">
                    {editingBookId !== null ? "Save Changes" : "Add Book"}
                  </button>

                  {editingBookId !== null && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={resetBookForm}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="panel">
              <div className="section-header">
                <h2>Book Collection</h2>
                <span>{books.length} titles</span>
              </div>

              <div className="toolbar">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, author, genre or ISBN..."
                  aria-label="Search books"
                />
                <button className="secondary-button" onClick={loadBooks}>
                  Refresh Books
                </button>
              </div>

              {loadingBooks ? (
                <p>Loading books...</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Genre</th>
                        <th>ISBN</th>
                        <th>Total</th>
                        <th>Available</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBooks.map((book) => (
                        <tr key={getId(book)}>
                          <td>{book.title}</td>
                          <td>{book.author}</td>
                          <td>{book.genre || "—"}</td>
                          <td>{book.isbn}</td>
                          <td>{book.quantity}</td>
                          <td>{availableCopies(book)}</td>
                          <td>
                            <button
                              className="secondary-button"
                              onClick={() => startBookEdit(book)}
                            >
                              Edit
                            </button>
                            <button
                              className="danger-button"
                              onClick={() => deleteBook(book)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}

                      {!filteredBooks.length && (
                        <EmptyRow columns={7} message="No matching books found." />
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {page === "Borrow & Return" && (
          <>
            <section className="panel">
              <h2>Borrow a Book</h2>

              <form onSubmit={borrowBook}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="borrow-book">Select Book *</label>
                    <select
                      id="borrow-book"
                      value={borrowForm.bookId}
                      onChange={(event) =>
                        setBorrowForm({ ...borrowForm, bookId: event.target.value })
                      }
                      required
                    >
                      <option value="">Choose a book</option>
                      {books
                        .filter((book) => availableCopies(book) > 0)
                        .map((book) => (
                          <option key={getId(book)} value={getId(book)}>
                            {book.title} — {availableCopies(book)} available
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="borrow-user">Select User *</label>
                    <select
                      id="borrow-user"
                      value={borrowForm.userId}
                      onChange={(event) =>
                        setBorrowForm({ ...borrowForm, userId: event.target.value })
                      }
                      required
                    >
                      <option value="">Choose a user</option>
                      {users.map((user) => (
                        <option key={getId(user)} value={getId(user)}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="borrow-quantity">Quantity *</label>
                    <input
                      id="borrow-quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={borrowForm.quantity}
                      onChange={(event) =>
                        setBorrowForm({ ...borrowForm, quantity: event.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <button type="submit">Record Borrowing</button>
              </form>
            </section>

            <section className="panel">
              <h2>Return a Book</h2>

              <form onSubmit={returnBook}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="return-borrowing">Active Borrowing *</label>
                    <select
                      id="return-borrowing"
                      value={returnForm.borrowingId}
                      onChange={(event) => {
                        const selected = activeBorrowings.find(
                          (item) => item.id === event.target.value
                        );

                        setReturnForm({
                          borrowingId: event.target.value,
                          quantity: selected ? selected.quantity : 1,
                        });
                      }}
                      required
                    >
                      <option value="">Choose a borrowing record</option>
                      {activeBorrowings.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.bookTitle} — {item.userName} ({item.quantity} copies)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="return-quantity">Quantity to Return *</label>
                    <input
                      id="return-quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={returnForm.quantity}
                      onChange={(event) =>
                        setReturnForm({ ...returnForm, quantity: event.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <button type="submit">Record Return</button>
              </form>
            </section>

            <section className="panel">
              <h2>Current Borrowings</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>Borrower</th>
                      <th>Quantity</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {borrowings.map((item) => (
                      <tr key={item.id}>
                        <td>{item.bookTitle}</td>
                        <td>{item.userName}</td>
                        <td>{item.quantity}</td>
                        <td>{item.date}</td>
                        <td>
                          <span className={`status ${item.status === "Returned" ? "status-returned" : "status-borrowed"}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {!borrowings.length && (
                      <EmptyRow columns={5} message="No borrowing records yet." />
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === "Stock Management" && (
          <>
            <section className="panel">
              <h2>Add Stock</h2>
              <p>Add new physical copies to a book already registered in the library.</p>

              <form onSubmit={addStock}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="stock-book">Select Book *</label>
                    <select
                      id="stock-book"
                      value={stockBookId}
                      onChange={(event) => setStockBookId(event.target.value)}
                      required
                    >
                      <option value="">Choose a book</option>
                      {books.map((book) => (
                        <option key={getId(book)} value={getId(book)}>
                          {book.title} — current total: {book.quantity}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="stock-quantity">Copies to Add *</label>
                    <input
                      id="stock-quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={stockQuantity}
                      onChange={(event) => setStockQuantity(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit">Add Stock</button>
              </form>
            </section>

            <section className="panel">
              <h2>Low Stock Books</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Total Copies</th>
                      <th>Available Copies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockBooks.map((book) => (
                      <tr key={getId(book)}>
                        <td>{book.title}</td>
                        <td>{book.author}</td>
                        <td>{book.quantity}</td>
                        <td>{availableCopies(book)}</td>
                      </tr>
                    ))}

                    {!lowStockBooks.length && (
                      <EmptyRow columns={4} message="No low-stock books." />
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === "Transactions" && (
          <section className="panel">
            <div className="section-header">
              <h2>Transaction History</h2>
              <span>{transactions.length} records</span>
            </div>

            <TransactionTable transactions={transactions} />
          </section>
        )}

        {page === "Users" && (
          <>
            <section className="panel">
              <h2>{editingUserId !== null ? "Edit User" : "Add New User"}</h2>

              <form onSubmit={saveUser}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="user-name">Full Name *</label>
                    <input
                      id="user-name"
                      value={userForm.name}
                      onChange={(event) =>
                        setUserForm({ ...userForm, name: event.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="user-username">Username *</label>
                    <input
                      id="user-username"
                      value={userForm.username}
                      onChange={(event) =>
                        setUserForm({ ...userForm, username: event.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="user-password">
                      Password {editingUserId === null ? "*" : "(leave blank to keep current)"}
                    </label>
                    <input
                      id="user-password"
                      type="password"
                      value={userForm.password}
                      onChange={(event) =>
                        setUserForm({ ...userForm, password: event.target.value })
                      }
                      autoComplete="new-password"
                      required={editingUserId === null}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="user-role">Role *</label>
                    <select
                      id="user-role"
                      value={userForm.role}
                      onChange={(event) =>
                        setUserForm({ ...userForm, role: event.target.value })
                      }
                    >
                      <option value="Member">Member</option>
                      <option value="Librarian">Librarian</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit">
                    {editingUserId !== null ? "Save User Changes" : "Add User"}
                  </button>

                  {editingUserId !== null && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={resetUserForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="panel">
              <h2>Registered Users</h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={getId(user)}>
                        <td>{user.name}</td>
                        <td>{user.username}</td>
                        <td>{user.role}</td>
                        <td>
                          <button
                            className="secondary-button"
                            onClick={() => editUser(user)}
                          >
                            Edit
                          </button>
                          <button
                            className="danger-button"
                            onClick={() => deleteUser(user)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!users.length && (
                      <EmptyRow columns={4} message="No users registered." />
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <footer style={{ marginTop: 25, padding: "15px 0" }}>
          Blue Library Management System
        </footer>
      </main>
    </div>
  );
}
