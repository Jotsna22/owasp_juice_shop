# Juice Shop Login Lab

A small login and registration form in the spirit of the OWASP Juice Shop customer login. It is a homework lab for checking input, storing passwords safely, and seeing what happens when someone tries SQL injection or cross-site scripting against this form.

The page is plain HTML, CSS, and JavaScript. An Express server repeats the same checks, stores passwords with bcrypt, and reads accounts with bound SQL parameters.

## Run it

Requirements: Node.js 22.5 or newer.

```bash
npm install
npm start
```

Open [http://127.0.0.1:47291](http://127.0.0.1:47291).

A lab account is already loaded:

- Email: `demo@juice.lab`
- Password: `Lemonade1`

Create another account from **Create an account**. The password you type is hashed with bcrypt (cost 10) and only the hash is inserted into SQLite.

## What the form checks

`public/validate.js` is used by the browser and by the server.

- Empty email or password is rejected.
- Email must contain `@` and look like an address.
- Password must be at least 8 characters and at most 72, which is the length bcrypt uses.
- Registration requires the confirmation to match.

The browser runs these checks before `fetch`. The server runs them again on `POST /api/login` and `POST /api/register`, so skipping the page script does not skip the rules.

## How secrets and queries are handled

- Passwords are hashed with `bcrypt.hashSync(password, 10)` and checked with `bcrypt.compareSync`.
- The login query is `SELECT email, password_hash FROM users WHERE email = ?`. The email is a bound parameter.
- Error text and the email you typed are written into the page with `textContent`, not `innerHTML`.
- A successful login sets an `HttpOnly` `SameSite=Strict` session cookie. The page never receives the password hash.
- Responses send a Content-Security-Policy that allows scripts only from this host.
- Login and registration attempts are limited per client address.



## Tests

```bash
npm test
```

The tests cover empty input, the length and `@` rules, a SQL-shaped email, a SQL-shaped password, bcrypt storage, and the session cookie.

## Project layout


| Path                             | Role                                |
| -------------------------------- | ----------------------------------- |
| `public/index.html`              | Login page                          |
| `public/register.html`           | Registration page                   |
| `public/app.js`                  | Login behavior                      |
| `public/register.js`             | Registration behavior               |
| `public/validate.js`             | Shared validation                   |
| `server.js`                      | API, bcrypt, SQLite, session cookie |
| `test/login.test.js`             | API tests                           |
| `submission/HW2B-Juice-Shop.pdf` | Course write-up                     |


