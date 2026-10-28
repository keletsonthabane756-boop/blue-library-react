
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const cleanRole = (role) => {
  const value = String(role || "Member").toLowerCase();

  if (!["admin", "librarian", "member"].includes(value)) {
    return null;
  }

  return value;
};

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  membership_id: user.membership_id,
  membershipId: user.membership_id,
  username: user.username,
  role: user.role.charAt(0).toUpperCase() + user.role.slice(1)
});

const getUserById = async (id) => {
  const [rows] = await db.query(
    "SELECT id, name, membership_id, username, role FROM users WHERE id = ?",
    [id]
  );

  return rows[0] || null;
};

// Create the borrowing table without deleting existing records.
async function initializeDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS borrowings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      book_id INT NOT NULL,
      user_id INT NOT NULL,
      quantity INT NOT NULL,
      remaining_quantity INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_borrowings_book (book_id),
      INDEX idx_borrowings_user (user_id),
      CONSTRAINT fk_borrowings_book
        FOREIGN KEY (book_id) REFERENCES books(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_borrowings_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);

  // Create the default administrator only if it does not already exist.
  const [admins] = await db.query(
    "SELECT id FROM users WHERE username = ?",
    ["admin"]
  );

  if (admins.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);

    await db.query(
      `INSERT INTO users
       (name, membership_id, username, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [
        "Library Administrator",
        "ADMIN001",
        "admin",
        passwordHash,
        "admin"
      ]
    );

    console.log("Default administrator created: username admin");
  }
}

// Basic API test
app.get("/", (req, res) => {
  res.json({ message: "Blue Library API is running!" });
});

// Check backend and MySQL connection
app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DATABASE() AS databaseName"
    );

    res.json({
      status: "success",
      message: "Backend connected to MySQL",
      database: rows[0].databaseName
    });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({
      status: "error",
      message: "Could not connect to the database"
    });
  }
});

// -------------------- BOOKS --------------------

// GET ALL BOOKS
app.get("/api/books", async (req, res) => {
  try {
    const [books] = await db.query(
      "SELECT * FROM books ORDER BY id DESC"
    );

    res.json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({
      message: "Could not fetch books from the database."
    });
  }
});

// ADD A BOOK
app.post("/api/books", async (req, res) => {
  try {
    const { title, author, genre, isbn, quantity } = req.body;

    if (
      typeof title !== "string" || !title.trim() ||
      typeof author !== "string" || !author.trim() ||
      typeof isbn !== "string" || !isbn.trim()
    ) {
      return res.status(400).json({
        message: "Title, author and ISBN are required."
      });
    }

    const copies = Number(quantity ?? 0);

    if (!Number.isInteger(copies) || copies < 0) {
      return res.status(400).json({
        message: "Quantity must be a whole number of zero or more."
      });
    }

    const [result] = await db.query(
      `INSERT INTO books (title, author, genre, isbn, quantity)
       VALUES (?, ?, ?, ?, ?)`,
      [
        title.trim(),
        author.trim(),
        typeof genre === "string" ? genre.trim() : "",
        isbn.trim(),
        copies
      ]
    );

    const [rows] = await db.query(
      "SELECT * FROM books WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error adding book:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "A book with this ISBN already exists."
      });
    }

    res.status(500).json({
      message: "Could not add book to the database."
    });
  }
});

// EDIT A BOOK
app.put("/api/books/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, genre, isbn, quantity } = req.body;

    if (
      !/^\d+$/.test(id) ||
      typeof title !== "string" || !title.trim() ||
      typeof author !== "string" || !author.trim() ||
      typeof isbn !== "string" || !isbn.trim()
    ) {
      return res.status(400).json({
        message: "A valid book ID, title, author and ISBN are required."
      });
    }

    const copies = Number(quantity);

    if (!Number.isInteger(copies) || copies < 0) {
      return res.status(400).json({
        message: "Quantity must be a whole number of zero or more."
      });
    }

    // Do not reduce total stock below the number currently borrowed.
    const [borrowedRows] = await db.query(
      `SELECT COALESCE(SUM(remaining_quantity), 0) AS borrowed
       FROM borrowings WHERE book_id = ?`,
      [id]
    );

    if (copies < Number(borrowedRows[0].borrowed)) {
      return res.status(400).json({
        message: "Quantity cannot be less than the number of copies currently borrowed."
      });
    }

    const [result] = await db.query(
      `UPDATE books
       SET title = ?, author = ?, genre = ?, isbn = ?, quantity = ?
       WHERE id = ?`,
      [
        title.trim(),
        author.trim(),
        typeof genre === "string" ? genre.trim() : "",
        isbn.trim(),
        copies,
        id
      ]
    );

    if (result.affectedRows === 0) {
      const [existing] = await db.query(
        "SELECT id FROM books WHERE id = ?",
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({ message: "Book not found." });
      }
    }

    const [rows] = await db.query(
      "SELECT * FROM books WHERE id = ?",
      [id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating book:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "A book with this ISBN already exists."
      });
    }

    res.status(500).json({
      message: "Could not update book in the database."
    });
  }
});

// DELETE A BOOK
app.delete("/api/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        message: "A valid book ID is required."
      });
    }

    const [result] = await db.query(
      "DELETE FROM books WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Book not found." });
    }

    res.json({ message: "Book deleted successfully." });
  } catch (error) {
    console.error("Error deleting book:", error);

    if (
      error.code === "ER_ROW_IS_REFERENCED_2" ||
      error.code === "ER_ROW_IS_REFERENCED"
    ) {
      return res.status(409).json({
        message: "This book cannot be deleted because it has related records."
      });
    }

    res.status(500).json({
      message: "Could not delete book from the database."
    });
  }
});

// -------------------- LOGIN --------------------

// Verify credentials against MySQL.
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" || !username.trim() ||
      typeof password !== "string" || !password
    ) {
      return res.status(400).json({
        message: "Enter your username and password."
      });
    }

    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username.trim()]
    );

    if (
      rows.length === 0 ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    ) {
      return res.status(401).json({
        message: "Incorrect username or password."
      });
    }

    res.json({
      message: "Login successful.",
      user: publicUser(rows[0])
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Could not log in." });
  }
});

// -------------------- USERS --------------------

// GET USERS (never return password hashes).
app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, membership_id, username, role
       FROM users ORDER BY id DESC`
    );

    res.json(rows.map(publicUser));
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Could not fetch users." });
  }
});

// ADD USER
app.post("/api/users", async (req, res) => {
  try {
    const { name, membershipId, membership_id, username, password, role } = req.body;
    const membership = membershipId ?? membership_id;
    const normalizedRole = cleanRole(role);

    if (
      typeof name !== "string" || !name.trim() ||
      typeof membership !== "string" || !membership.trim() ||
      typeof username !== "string" || !username.trim() ||
      typeof password !== "string" || !password ||
      !normalizedRole
    ) {
      return res.status(400).json({
        message: "Enter a name, membership ID, username, password and valid role."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users
       (name, membership_id, username, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name.trim(),
        membership.trim(),
        username.trim(),
        passwordHash,
        normalizedRole
      ]
    );

    const user = await getUserById(result.insertId);
    res.status(201).json(publicUser(user));
  } catch (error) {
    console.error("Error adding user:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "That username or membership ID is already in use."
      });
    }

    res.status(500).json({ message: "Could not add user." });
  }
});

// EDIT USER
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, membershipId, membership_id, username, password, role } = req.body;
    const membership = membershipId ?? membership_id;
    const normalizedRole = cleanRole(role);

    if (
      !/^\d+$/.test(id) ||
      typeof name !== "string" || !name.trim() ||
      typeof membership !== "string" || !membership.trim() ||
      typeof username !== "string" || !username.trim() ||
      !normalizedRole
    ) {
      return res.status(400).json({
        message: "Enter a valid ID, name, membership ID, username and role."
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM users WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    if (typeof password === "string" && password.length > 0) {
      const passwordHash = await bcrypt.hash(password, 10);

      await db.query(
        `UPDATE users
         SET name = ?, membership_id = ?, username = ?, password_hash = ?, role = ?
         WHERE id = ?`,
        [
          name.trim(),
          membership.trim(),
          username.trim(),
          passwordHash,
          normalizedRole,
          id
        ]
      );
    } else {
      await db.query(
        `UPDATE users
         SET name = ?, membership_id = ?, username = ?, role = ?
         WHERE id = ?`,
        [
          name.trim(),
          membership.trim(),
          username.trim(),
          normalizedRole,
          id
        ]
      );
    }

    res.json(publicUser(await getUserById(id)));
  } catch (error) {
    console.error("Error updating user:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "That username or membership ID is already in use."
      });
    }

    res.status(500).json({ message: "Could not update user." });
  }
});

// DELETE USER
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ message: "A valid user ID is required." });
    }

    if (Number(id) === 1) {
      // The default admin is normally the first user, but also check username below.
      const [adminRows] = await db.query(
        "SELECT username FROM users WHERE id = ?",
        [id]
      );

      if (adminRows[0]?.username === "admin") {
        return res.status(400).json({
          message: "The default administrator cannot be deleted."
        });
      }
    }

    const [result] = await db.query(
      "DELETE FROM users WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);

    if (
      error.code === "ER_ROW_IS_REFERENCED_2" ||
      error.code === "ER_ROW_IS_REFERENCED"
    ) {
      return res.status(409).json({
        message: "This user has transaction or borrowing records and cannot be deleted."
      });
    }

    res.status(500).json({ message: "Could not delete user." });
  }
});

// -------------------- BORROWINGS --------------------

// GET ALL BORROWINGS, INCLUDING FULLY RETURNED RECORDS.
app.get("/api/borrowings", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        br.id,
        br.book_id AS bookId,
        b.title AS bookTitle,
        br.user_id AS userId,
        u.name AS userName,
        br.quantity,
        br.remaining_quantity AS remainingQuantity,
        br.created_at AS date
      FROM borrowings br
      JOIN books b ON b.id = br.book_id
      JOIN users u ON u.id = br.user_id
      ORDER BY br.id DESC
    `);

    res.json(rows.map((row) => ({
      ...row,
      status: Number(row.remainingQuantity) > 0 ? "Borrowed" : "Returned"
    })));
  } catch (error) {
    console.error("Error fetching borrowings:", error);
    res.status(500).json({ message: "Could not fetch borrowing records." });
  }
});

// BORROW BOOK
app.post("/api/borrowings", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const bookId = Number(req.body.bookId ?? req.body.book_id);
    const userId = Number(req.body.userId ?? req.body.user_id);
    const quantity = Number(req.body.quantity);

    if (
      !Number.isInteger(bookId) || bookId < 1 ||
      !Number.isInteger(userId) || userId < 1 ||
      !Number.isInteger(quantity) || quantity < 1
    ) {
      return res.status(400).json({
        message: "Choose a valid book, user and whole-number quantity."
      });
    }

    await connection.beginTransaction();

    const [books] = await connection.query(
      "SELECT id, quantity, title FROM books WHERE id = ? FOR UPDATE",
      [bookId]
    );

    const [users] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );

    if (books.length === 0 || users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Book or user not found." });
    }

    const [activeRows] = await connection.query(
      `SELECT COALESCE(SUM(remaining_quantity), 0) AS borrowed
       FROM borrowings WHERE book_id = ?`,
      [bookId]
    );

    const available = Number(books[0].quantity) - Number(activeRows[0].borrowed);

    if (quantity > available) {
      await connection.rollback();
      return res.status(400).json({
        message: `Only ${Math.max(available, 0)} copies are available.`
      });
    }

    const [result] = await connection.query(
      `INSERT INTO borrowings
       (book_id, user_id, quantity, remaining_quantity)
       VALUES (?, ?, ?, ?)`,
      [bookId, userId, quantity, quantity]
    );

    await connection.query(
      `INSERT INTO transactions (book_id, user_id, transaction_type, quantity)
       VALUES (?, ?, 'borrow', ?)`,
      [bookId, userId, quantity]
    );

    await connection.commit();

    res.status(201).json({
      id: result.insertId,
      bookId,
      bookTitle: books[0].title,
      userId,
      quantity,
      remainingQuantity: quantity,
      status: "Borrowed",
      date: new Date()
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error recording borrowing:", error);
    res.status(500).json({ message: "Could not record this borrowing." });
  } finally {
    connection.release();
  }
});

// RETURN ALL OR PART OF A BORROWING
app.post("/api/borrowings/:id/return", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const quantity = Number(req.body.quantity);

    if (
      !/^\d+$/.test(id) ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        message: "Enter a valid borrowing ID and whole-number return quantity."
      });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, book_id, user_id, remaining_quantity
       FROM borrowings WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Borrowing record not found." });
    }

    const borrowing = rows[0];

    if (quantity > Number(borrowing.remaining_quantity)) {
      await connection.rollback();
      return res.status(400).json({
        message: `Only ${borrowing.remaining_quantity} outstanding copies can be returned.`
      });
    }

    await connection.query(
      `UPDATE borrowings
       SET remaining_quantity = remaining_quantity - ?
       WHERE id = ?`,
      [quantity, id]
    );

    await connection.query(
      `INSERT INTO transactions (book_id, user_id, transaction_type, quantity)
       VALUES (?, ?, 'return', ?)`,
      [borrowing.book_id, borrowing.user_id, quantity]
    );

    await connection.commit();

    res.json({ message: "Return recorded successfully." });
  } catch (error) {
    await connection.rollback();
    console.error("Error recording return:", error);
    res.status(500).json({ message: "Could not record this return." });
  } finally {
    connection.release();
  }
});

// -------------------- STOCK --------------------

// ADD STOCK AND RECORD THE TRANSACTION IN ONE DATABASE TRANSACTION.
app.post("/api/stock/add", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const bookId = Number(req.body.bookId ?? req.body.book_id);
    const quantity = Number(req.body.quantity);
    const userIdValue = req.body.userId ?? req.body.user_id;
    const userId = userIdValue ? Number(userIdValue) : null;

    if (
      !Number.isInteger(bookId) || bookId < 1 ||
      !Number.isInteger(quantity) || quantity < 1 ||
      (userId !== null && (!Number.isInteger(userId) || userId < 1))
    ) {
      return res.status(400).json({
        message: "Choose a valid book and enter a positive whole-number quantity."
      });
    }

    await connection.beginTransaction();

    const [books] = await connection.query(
      "SELECT id FROM books WHERE id = ? FOR UPDATE",
      [bookId]
    );

    if (books.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Book not found." });
    }

    if (userId !== null) {
      const [users] = await connection.query(
        "SELECT id FROM users WHERE id = ?",
        [userId]
      );

      if (users.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "User not found." });
      }
    }

    await connection.query(
      "UPDATE books SET quantity = quantity + ? WHERE id = ?",
      [quantity, bookId]
    );

    await connection.query(
      `INSERT INTO transactions (book_id, user_id, transaction_type, quantity)
       VALUES (?, ?, 'stock_added', ?)`,
      [bookId, userId, quantity]
    );

    const [updatedBooks] = await connection.query(
      "SELECT * FROM books WHERE id = ?",
      [bookId]
    );

    await connection.commit();
    res.json(updatedBooks[0]);
  } catch (error) {
    await connection.rollback();
    console.error("Error adding stock:", error);
    res.status(500).json({ message: "Could not add stock." });
  } finally {
    connection.release();
  }
});

// -------------------- TRANSACTIONS --------------------

// GET TRANSACTION HISTORY
app.get("/api/transactions", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        t.id,
        t.book_id AS bookId,
        b.title AS bookTitle,
        t.user_id AS userId,
        COALESCE(u.name, 'System') AS userName,
        t.transaction_type AS transactionType,
        t.quantity,
        t.transaction_date AS date
      FROM transactions t
      JOIN books b ON b.id = t.book_id
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.transaction_date DESC, t.id DESC
    `);

    res.json(rows.map((row) => ({
      ...row,
      type: row.transactionType === "stock_added"
        ? "Stock Added"
        : row.transactionType.charAt(0).toUpperCase() +
          row.transactionType.slice(1)
    })));
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ message: "Could not fetch transactions." });
  }
});

// Start only after the required database setup succeeds.
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Blue Library API running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not initialize the Blue Library database:", error);
    process.exit(1);
  });
