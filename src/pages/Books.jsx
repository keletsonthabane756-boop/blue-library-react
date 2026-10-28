
import { useState } from "react";

function Books({ books, setBooks }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    title: "",
    author: "",
    genre: "",
    isbn: "",
    quantity: "",
  };

  const [formData, setFormData] = useState(emptyForm);

  // Update form fields when the user types
  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  // Open the form for adding a book
  function handleAddBook() {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  // Save a new book or update an existing one
  function handleSubmit(event) {
    event.preventDefault();

    const quantity = Number(formData.quantity);

    if (
      !formData.title.trim() ||
      !formData.author.trim() ||
      !formData.genre.trim() ||
      !formData.isbn.trim() ||
      formData.quantity === "" ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      alert("Please complete all fields and enter a valid quantity.");
      return;
    }

    if (editingId !== null) {
      setBooks((previousBooks) =>
        previousBooks.map((book) =>
          book.id === editingId
            ? { ...book, ...formData, quantity }
            : book
        )
      );
    } else {
      const newBook = {
        id: Date.now(),
        ...formData,
        quantity,
      };

      setBooks((previousBooks) => [...previousBooks, newBook]);
    }

    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  // Load a book's details into the form for editing
  function handleEditBook(book) {
    setFormData({
      title: book.title,
      author: book.author,
      genre: book.genre,
      isbn: book.isbn,
      quantity: String(book.quantity),
    });

    setEditingId(book.id);
    setShowForm(true);
  }

  // Delete a book
  function handleDeleteBook(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this book?"
    );

    if (confirmed) {
      setBooks((previousBooks) =>
        previousBooks.filter((book) => book.id !== id)
      );
    }
  }

  // Search by title, author, genre, or ISBN
  const filteredBooks = books.filter((book) => {
    const search = searchTerm.toLowerCase();

    return (
      book.title.toLowerCase().includes(search) ||
      book.author.toLowerCase().includes(search) ||
      book.genre.toLowerCase().includes(search) ||
      book.isbn.toLowerCase().includes(search)
    );
  });

  return (
    <section className="book-page">
      <div className="book-page-heading">
        <div>
          <h2>Books Management</h2>
          <p>Add, search, update, and manage your library books.</p>
        </div>

        <button className="primary-button" onClick={handleAddBook}>
          + Add New Book
        </button>
      </div>

      {showForm && (
        <div className="book-form-card">
          <h3>{editingId !== null ? "Edit Book" : "Add a New Book"}</h3>

          <form onSubmit={handleSubmit}>
            <div className="book-form-grid">
              <label>
                Book Title
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter book title"
                  required
                />
              </label>

              <label>
                Author
                <input
                  name="author"
                  value={formData.author}
                  onChange={handleChange}
                  placeholder="Enter author's name"
                  required
                />
              </label>

              <label>
                Genre
                <input
                  name="genre"
                  value={formData.genre}
                  onChange={handleChange}
                  placeholder="e.g. Fiction"
                  required
                />
              </label>

              <label>
                ISBN
                <input
                  name="isbn"
                  value={formData.isbn}
                  onChange={handleChange}
                  placeholder="Enter ISBN"
                  required
                />
              </label>

              <label>
                Quantity
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="Number of copies"
                  required
                />
              </label>
            </div>

            <div className="book-form-actions">
              <button className="primary-button" type="submit">
                {editingId !== null ? "Save Changes" : "Add Book"}
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData(emptyForm);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="book-table-card">
        <div className="book-table-heading">
          <h3>Book Collection</h3>

          <input
            className="book-search"
            type="search"
            placeholder="Search books..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="books-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Genre</th>
                <th>ISBN</th>
                <th>Quantity</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredBooks.length > 0 ? (
                filteredBooks.map((book) => (
                  <tr key={book.id}>
                    <td>{book.title}</td>
                    <td>{book.author}</td>
                    <td>{book.genre}</td>
                    <td>{book.isbn}</td>
                    <td>{book.quantity}</td>
                    <td>
                      <div className="book-actions">
                        <button
                          className="edit-button"
                          onClick={() => handleEditBook(book)}
                        >
                          Edit
                        </button>

                        <button
                          className="delete-button"
                          onClick={() => handleDeleteBook(book.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-books">
                    {searchTerm
                      ? "No books match your search."
                      : "No books have been added yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="book-count">
          Showing {filteredBooks.length} of {books.length} books
        </p>
      </div>
    </section>
  );
}

export default Books;
